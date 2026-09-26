/**
 * Simulation metrics — synthetic access delay, not clinical wait times.
 */

const { PRIORITY_WEIGHT } = require('./simulationConstants');
const { lastEventEndDay } = require('./eventUtils');

function computeServiceInequalityIndex({
  stockoutGap,
  waitGap,
  giniCoverage,
  maxRelevantWaitDays = 30,
  weights = { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 },
}) {
  const normalizedStockoutGap = Math.min(Math.max(stockoutGap, 0), 1);
  const normalizedWaitGap = Math.min(Math.max(waitGap / maxRelevantWaitDays, 0), 1);
  const normalizedGini = Math.min(Math.max(giniCoverage, 0), 1);
  const wSum = weights.stockout + weights.wait + weights.gini;
  const index = (
    weights.stockout * normalizedStockoutGap
    + weights.wait * normalizedWaitGap
    + weights.gini * normalizedGini
  ) / wSum;
  return Math.min(Math.max(index, 0), 1);
}

function computeRunMetrics(runLog, instance, policyId) {
  const { scenario } = instance;
  const weights = scenario.metricsWeights || {};
  const ineqWeights = scenario.metricsWeights?.serviceInequalityWeights ?? { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 };
  const maxWait = scenario.metricsWeights?.maxRelevantWaitDays ?? 30;
  const waitW = weights.waitingTimePenaltyPerDay ?? 8;
  const ineqW = weights.inequityPenaltyPerGap ?? 120;

  let totalDemand = 0;
  let totalFilled = 0;
  let totalStockout = 0;
  let weightedStockoutPenalty = 0;
  let totalCost = runLog.totalCost || 0;
  let accessDelayUnitDays = 0;
  let transitSum = 0;
  let transitCount = 0;
  let inventorySum = 0;
  let inventoryDays = 0;
  let permanentlyUnmet = 0;
  let eventuallyFilled = 0;

  const priorityAgg = {
    essential: { demand: 0, stockout: 0 },
    'chronic-care': { demand: 0, stockout: 0 },
    routine: { demand: 0, stockout: 0 },
  };

  const byRegion = {};
  for (const day of runLog.daily) {
    for (const rt of ['urban', 'suburban', 'rural']) {
      if (!byRegion[rt]) {
        byRegion[rt] = { demand: 0, filled: 0, stockout: 0, accessDelayUnitDays: 0 };
      }
    }
    accessDelayUnitDays += day.dailyAccessDelayUnitDays ?? 0;
    for (const row of day.pharmacyResults) {
      const r = byRegion[row.regionType];
      r.demand += row.demand;
      r.filled += row.filled;
      r.stockout += row.stockout;
      r.accessDelayUnitDays += row.accessDelayUnitDays ?? 0;
      totalDemand += row.demand;
      totalFilled += row.filled;
      totalStockout += row.stockout;
      for (const sd of row.stockoutByDrug || []) {
        const drug = instance.drugs?.find((d) => d.id === sd.drugId);
        const pw = drug?.stockoutPenalty ?? weights.stockoutPenaltyByPriority?.[sd.priority] ?? 15;
        weightedStockoutPenalty += sd.units * pw * (PRIORITY_WEIGHT[sd.priority] ?? 1);
      }
    }
    inventorySum += day.totalInventory;
    inventoryDays += 1;
    for (const [pk, row] of Object.entries(day.priorityTotals || {})) {
      if (!priorityAgg[pk]) continue;
      priorityAgg[pk].demand += row.demand;
      priorityAgg[pk].stockout += row.stockout;
    }
    for (const sh of day.shipments || []) {
      transitSum += sh.transitDays * sh.qty;
      transitCount += sh.qty;
    }
  }

  for (const row of runLog.pharmacyStatesSummary || []) {
    permanentlyUnmet += row.permanentlyUnmetUnits ?? 0;
    eventuallyFilled += row.eventuallyFilledUnits ?? 0;
  }

  const stockoutRate = totalDemand > 0 ? totalStockout / totalDemand : 0;
  const fillRate = totalDemand > 0 ? totalFilled / totalDemand : 1;
  const avgSyntheticAccessDelayDays = totalDemand > 0 ? accessDelayUnitDays / totalDemand : 0;
  const avgDeliveryTimeDays = transitCount > 0 ? transitSum / transitCount : 0;
  const avgInventory = inventoryDays > 0 ? inventorySum / inventoryDays : 0;
  const inventoryTurnover = avgInventory > 0 ? totalFilled / avgInventory : 0;

  const regional = {};
  for (const [rt, r] of Object.entries(byRegion)) {
    regional[rt] = {
      demand: r.demand,
      fillRate: r.demand > 0 ? r.filled / r.demand : 1,
      stockoutRate: r.demand > 0 ? r.stockout / r.demand : 0,
      avgSyntheticAccessDelayDays: r.demand > 0 ? r.accessDelayUnitDays / r.demand : 0,
      serviceCoverage: r.demand > 0 ? r.filled / r.demand : 1,
    };
  }

  const stockoutRates = Object.values(regional).map((x) => x.stockoutRate);
  const waitTimes = Object.values(regional).map((x) => x.avgSyntheticAccessDelayDays);
  const fillRates = Object.values(regional).map((x) => x.fillRate);

  const stockoutGap = stockoutRates.length ? Math.max(...stockoutRates) - Math.min(...stockoutRates) : 0;
  const waitGap = waitTimes.length ? Math.max(...waitTimes) - Math.min(...waitTimes) : 0;
  const giniCoverage = gini(fillRates);
  const resilience = computeResilienceMetrics(runLog.daily, scenario);
  const serviceInequalityIndex = computeServiceInequalityIndex({
    stockoutGap,
    waitGap,
    giniCoverage,
    maxRelevantWaitDays: maxWait,
    weights: ineqWeights,
  });

  const waitingTimePenalty = accessDelayUnitDays * waitW;
  const inequityPenalty = serviceInequalityIndex * ineqW;

  return {
    policyId,
    totalCost,
    stockoutRate,
    fillRate,
    orderFillRate: fillRate,
    essentialStockoutRate: rate(priorityAgg.essential),
    chronicStockoutRate: rate(priorityAgg['chronic-care']),
    routineStockoutRate: rate(priorityAgg.routine),
    avgSyntheticAccessDelayDays,
    avgAccessTimeDays: avgSyntheticAccessDelayDays,
    inventoryTurnover,
    avgDeliveryTimeDays,
    permanentlyUnmetUnits: permanentlyUnmet,
    eventuallyFilledUnits: eventuallyFilled,
    backlogUnitDaysTotal: accessDelayUnitDays,
    regional,
    resilience,
    serviceInequalityIndex,
    equity: {
      stockoutGap,
      waitGap,
      giniCoverage,
      serviceInequalityIndex,
      formula: 'weighted mean of normalized stockoutGap, waitGap/maxWait, giniCoverage in [0,1]',
    },
    penalties: {
      weightedStockoutPenalty,
      waitingTimePenalty,
      inequityPenalty,
      compositeScore: totalCost + weightedStockoutPenalty + waitingTimePenalty + inequityPenalty,
    },
    disclaimer: 'Synthetic simulation metrics only.',
  };
}

function gini(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let num = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      num += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return num / (2 * n * n * mean);
}

function rate(agg) {
  return agg.demand > 0 ? agg.stockout / agg.demand : 0;
}

function computeResilienceMetrics(daily, scenario) {
  const lastEnd = lastEventEndDay(scenario);
  const firstStart = scenario?.events?.length
    ? Math.min(...scenario.events.map((e) => e.startDay))
    : 999;
  const preDays = daily.filter((d) => d.day < firstStart);
  const baseline = preDays.length
    ? preDays.reduce((s, d) => s + (d.dailyStockoutRate || 0), 0) / preDays.length
    : (daily[0]?.dailyStockoutRate ?? 0);
  let recoveryDay = null;
  if (lastEnd >= 0) {
    for (const d of daily) {
      if (d.day < lastEnd) continue;
      if ((d.dailyStockoutRate ?? 1) <= baseline * 1.1 + 0.001) {
        recoveryDay = d.day;
        break;
      }
    }
  }
  const disruptionPeak = daily.length
    ? Math.max(...daily.map((d) => d.dailyStockoutRate || 0))
    : 0;
  return {
    baselinePreDisruptionStockoutRate: baseline,
    disruptionPeakStockoutRate: disruptionPeak,
    lastDisruptionEndDay: lastEnd,
    recoveryDay,
    daysToRecover: recoveryDay != null && lastEnd >= 0 ? recoveryDay - lastEnd : null,
  };
}

function aggregateReplicates(metricsList) {
  if (!metricsList.length) return null;
  const keys = [
    'totalCost', 'stockoutRate', 'fillRate', 'essentialStockoutRate', 'chronicStockoutRate',
    'avgSyntheticAccessDelayDays', 'serviceInequalityIndex', 'avgDeliveryTimeDays',
  ];
  const summary = {};
  for (const k of keys) {
    const vals = metricsList.map((m) => m[k] ?? m.avgAccessTimeDays);
    summary[k] = stats(vals);
  }
  summary.replicates = metricsList.length;
  summary.replicateStockoutRates = metricsList.map((m) => m.stockoutRate);
  return summary;
}

function aggregateRegionalReplicates(results) {
  if (!results?.length) return null;
  const regions = ['urban', 'suburban', 'rural'];
  const out = {};
  for (const rt of regions) {
    const stockoutRates = [];
    const fillRates = [];
    const delays = [];
    for (const r of results) {
      const reg = r.metrics?.regional?.[rt];
      if (!reg) continue;
      stockoutRates.push(reg.stockoutRate);
      fillRates.push(reg.fillRate);
      delays.push(reg.avgSyntheticAccessDelayDays ?? reg.avgAccessTimeDays ?? 0);
    }
    if (stockoutRates.length) {
      out[rt] = {
        stockoutRate: stats(stockoutRates),
        fillRate: stats(fillRates),
        avgSyntheticAccessDelayDays: stats(delays),
      };
    }
  }
  return out;
}

function aggregateDailyTimeSeries(results) {
  if (!results?.length) return null;
  const maxDay = Math.max(...results.map((r) => r.runLog?.daily?.length ?? 0));
  const series = [];
  for (let day = 0; day < maxDay; day += 1) {
    const stockoutRates = [];
    const fillRates = [];
    for (const r of results) {
      const d = r.runLog?.daily?.[day];
      if (d) {
        stockoutRates.push(d.dailyStockoutRate ?? 0);
        fillRates.push(d.dailyFillRate ?? 0);
      }
    }
    if (stockoutRates.length) {
      series.push({
        day,
        dailyStockoutRate: stats(stockoutRates),
        dailyFillRate: stats(fillRates),
      });
    }
  }
  return series;
}

function pairedPolicyComparison(resultsByPolicy) {
  const policies = Object.keys(resultsByPolicy);
  if (policies.length < 2) return null;
  const n = Math.min(...policies.map((p) => resultsByPolicy[p].length));
  const pairs = [];
  for (let i = 0; i < policies.length - 1; i += 1) {
    for (let j = i + 1; j < policies.length; j += 1) {
      const a = policies[i];
      const b = policies[j];
      const diffs = [];
      for (let k = 0; k < n; k += 1) {
        diffs.push(resultsByPolicy[a][k].metrics.stockoutRate - resultsByPolicy[b][k].metrics.stockoutRate);
      }
      pairs.push({ policyA: a, policyB: b, stockoutRateDiff: stats(diffs), pairedReplicates: n });
    }
  }
  return pairs;
}

function stats(vals) {
  const n = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const ci95 = 1.96 * (std / Math.sqrt(n));
  return { mean, std, ci95Low: mean - ci95, ci95High: mean + ci95, n };
}

module.exports = {
  computeRunMetrics,
  computeServiceInequalityIndex,
  aggregateReplicates,
  aggregateRegionalReplicates,
  aggregateDailyTimeSeries,
  pairedPolicyComparison,
  PRIORITY_WEIGHT,
};
