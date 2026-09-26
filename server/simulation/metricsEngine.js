/**
 * Simulation metrics — synthetic outcomes only, not health endpoints.
 *
 * Units:
 * - totalCost: currency units (CNY, synthetic)
 * - stockoutRate: fraction of unmet demand units
 * - fillRate: fraction of demand filled
 * - avgAccessTimeDays: mean patient wait proxy (days until demand filled from stock or arrival)
 * - inventoryTurnover: demand fulfilled / average inventory
 * - avgDeliveryTimeDays: mean shipment transit days
 * - inequityGap*: max-min across region types for stockout or wait
 * - giniCoverage: Gini on regional fill rates (0=equal, 1=max inequality)
 */

const PRIORITY_WEIGHT = { essential: 3, 'chronic-care': 2, routine: 1 };

function computeRunMetrics(runLog, instance, policyId) {
  const { scenario } = instance;
  const weights = scenario.metricsWeights || {};
  const stockoutW = weights.stockoutPenaltyByPriority || { essential: 50, 'chronic-care': 35, routine: 15 };
  const waitW = weights.waitingTimePenaltyPerDay ?? 8;
  const ineqW = weights.inequityPenaltyPerGap ?? 120;

  let totalDemand = 0;
  let totalFilled = 0;
  let totalStockout = 0;
  let weightedStockoutPenalty = 0;
  let totalCost = runLog.totalCost || 0;
  let waitSum = 0;
  let waitCount = 0;
  let transitSum = 0;
  let transitCount = 0;
  let inventorySum = 0;
  let inventoryDays = 0;
  const priorityAgg = {
    essential: { demand: 0, stockout: 0 },
    'chronic-care': { demand: 0, stockout: 0 },
    routine: { demand: 0, stockout: 0 },
  };

  const byRegion = {};
  for (const day of runLog.daily) {
    for (const rt of ['urban', 'suburban', 'rural']) {
      if (!byRegion[rt]) {
        byRegion[rt] = { demand: 0, filled: 0, stockout: 0, waitSum: 0, waitN: 0 };
      }
    }
    for (const row of day.pharmacyResults) {
      const r = byRegion[row.regionType];
      r.demand += row.demand;
      r.filled += row.filled;
      r.stockout += row.stockout;
      r.waitSum += row.waitDays * row.demand;
      r.waitN += row.demand;
      totalDemand += row.demand;
      totalFilled += row.filled;
      totalStockout += row.stockout;
      waitSum += row.waitDays * row.demand;
      waitCount += row.demand;
      for (const sd of row.stockoutByDrug || []) {
        const pw = stockoutW[sd.priority] ?? 15;
        weightedStockoutPenalty += sd.units * pw * PRIORITY_WEIGHT[sd.priority];
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

  const stockoutRate = totalDemand > 0 ? totalStockout / totalDemand : 0;
  const fillRate = totalDemand > 0 ? totalFilled / totalDemand : 1;
  const avgAccessTimeDays = waitCount > 0 ? waitSum / waitCount : 0;
  const avgDeliveryTimeDays = transitCount > 0 ? transitSum / transitCount : 0;
  const avgInventory = inventoryDays > 0 ? inventorySum / inventoryDays : 0;
  const inventoryTurnover = avgInventory > 0 ? totalFilled / avgInventory : 0;

  const regional = {};
  for (const [rt, r] of Object.entries(byRegion)) {
    regional[rt] = {
      demand: r.demand,
      fillRate: r.demand > 0 ? r.filled / r.demand : 1,
      stockoutRate: r.demand > 0 ? r.stockout / r.demand : 0,
      avgAccessTimeDays: r.waitN > 0 ? r.waitSum / r.waitN : 0,
      serviceCoverage: r.demand > 0 ? r.filled / r.demand : 1,
    };
  }

  const essentialStockoutRate = rate(priorityAgg.essential);
  const chronicStockoutRate = rate(priorityAgg['chronic-care']);
  const routineStockoutRate = rate(priorityAgg.routine);
  const orderFillRate = fillRate;

  const stockoutRates = Object.values(regional).map((x) => x.stockoutRate);
  const waitTimes = Object.values(regional).map((x) => x.avgAccessTimeDays);
  const fillRates = Object.values(regional).map((x) => x.fillRate);

  const stockoutGap = Math.max(...stockoutRates) - Math.min(...stockoutRates);
  const waitGap = Math.max(...waitTimes) - Math.min(...waitTimes);
  const giniCoverage = gini(fillRates);
  const resilience = computeResilienceMetrics(runLog.daily, scenario);
  const serviceInequalityIndex = (stockoutGap + waitGap + (1 - giniCoverage)) / 3;

  const waitingTimePenalty = waitSum * waitW;
  const inequityPenalty = (stockoutGap + waitGap) * ineqW;
  const compositeScore = totalCost + weightedStockoutPenalty + waitingTimePenalty + inequityPenalty;

  return {
    policyId,
    totalCost,
    stockoutRate,
    fillRate,
    orderFillRate,
    essentialStockoutRate,
    chronicStockoutRate,
    routineStockoutRate,
    avgAccessTimeDays,
    inventoryTurnover,
    avgDeliveryTimeDays,
    regional,
    resilience,
    serviceInequalityIndex,
    equity: {
      stockoutGap,
      waitGap,
      giniCoverage,
      serviceInequalityIndex,
      definition: 'Gini on regional fill rates; gaps are max-min across urban/suburban/rural; serviceInequalityIndex averages normalized gaps.',
    },
    penalties: {
      weightedStockoutPenalty,
      waitingTimePenalty,
      inequityPenalty,
      compositeScore,
      units: { cost: 'synthetic CNY', time: 'days', score: 'synthetic penalty units' },
    },
    disclaimer: 'Metrics describe synthetic simulation outputs only, not real-world health or operational outcomes.',
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
  const events = scenario?.events || [];
  const lastEnd = events.reduce((m, e) => Math.max(m, e.endDay ?? e.startDay ?? 0), -1);
  const preDays = daily.filter((d) => d.day < (events[0]?.startDay ?? 999));
  const baseline = preDays.length
    ? preDays.reduce((s, d) => s + (d.dailyStockoutRate || 0), 0) / preDays.length
    : (daily[0]?.dailyStockoutRate ?? 0);
  let recoveryDay = null;
  if (lastEnd >= 0) {
    for (const d of daily) {
      if (d.day <= lastEnd) continue;
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
    definition: 'Recovery = first day after last event when daily stockout rate ≤ 110% of pre-event baseline.',
  };
}

function aggregateReplicates(metricsList) {
  if (!metricsList.length) return null;
  const keys = [
    'totalCost', 'stockoutRate', 'fillRate', 'essentialStockoutRate', 'chronicStockoutRate',
    'avgAccessTimeDays', 'inventoryTurnover', 'avgDeliveryTimeDays', 'serviceInequalityIndex',
  ];
  const summary = {};
  for (const k of keys) {
    const vals = metricsList.map((m) => m[k]);
    summary[k] = stats(vals);
  }
  summary.replicates = metricsList.length;
  summary.replicateStockoutRates = metricsList.map((m) => m.stockoutRate);
  return summary;
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
  aggregateReplicates,
  PRIORITY_WEIGHT,
};
