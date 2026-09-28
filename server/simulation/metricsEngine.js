/**
 * Simulation metrics — synthetic outcomes only (not clinical endpoints).
 * Formal definitions, units, directions and ranges: docs/metrics.md.
 */

const { PRIORITY_WEIGHT } = require('./simulationConstants');
const { lastEventEndDay } = require('./eventUtils');
const { REGION_TYPES } = require('./scenarioSchema');
const { createRng } = require('./rng');

const RECOVERY_LEVELS = [0.9, 0.95, 0.99];
const SMOOTHING_DAYS = 7;
const WARMUP_SKIP_DAYS = 7;

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

/** Region-level daily totals; derived from pharmacyResults for hand-built logs without regionDaily. */
function regionDailyOf(day) {
  if (day.regionDaily) return day.regionDaily;
  const out = {};
  for (const row of day.pharmacyResults || []) {
    const r = out[row.regionType] || (out[row.regionType] = {
      demand: 0, filled: 0, stockout: 0, essDemand: 0, essFilled: 0, essStockout: 0, backlog: 0, delayUnitDays: 0,
    });
    r.demand += row.demand;
    r.filled += row.filled;
    r.stockout += row.stockout;
    r.backlog += row.backlogUnits ?? 0;
    r.delayUnitDays += row.accessDelayUnitDays ?? 0;
    for (const sd of row.stockoutByDrug || []) {
      if (sd.priority === 'essential') r.essStockout += sd.units;
    }
  }
  return out;
}

function weightedPenaltyOf(day, instance, weights) {
  if (typeof day.weightedStockoutPenalty === 'number') return day.weightedStockoutPenalty;
  let total = 0;
  for (const row of day.pharmacyResults || []) {
    for (const sd of row.stockoutByDrug || []) {
      const drug = instance.drugs?.find((d) => d.id === sd.drugId);
      const pw = drug?.stockoutPenalty ?? weights.stockoutPenaltyByPriority?.[sd.priority] ?? 15;
      total += sd.units * pw * (PRIORITY_WEIGHT[sd.priority] ?? 1);
    }
  }
  return total;
}

function computeRunMetrics(runLog, instance, policyId) {
  const { scenario } = instance;
  const weights = scenario.metricsWeights || {};
  const ineqWeights = weights.serviceInequalityWeights ?? { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 };
  const maxWait = weights.maxRelevantWaitDays ?? 30;
  const waitW = weights.waitingTimePenaltyPerDay ?? 8;
  const ineqW = weights.inequityPenaltyPerGap ?? 120;
  const onset = firstEventStartDay(scenario);

  let totalDemand = 0;
  let totalFilled = 0;
  let totalStockout = 0;
  let weightedStockoutPenalty = 0;
  let accessDelayUnitDays = 0;
  let transitSum = 0;
  let transitCount = 0;
  let inventorySum = 0;
  let maxBacklog = 0;
  const priorityAgg = {
    essential: { demand: 0, filled: 0, stockout: 0 },
    'chronic-care': { demand: 0, filled: 0, stockout: 0 },
    routine: { demand: 0, filled: 0, stockout: 0 },
  };
  const byRegion = {};
  const byRegionPost = {};
  const blank = () => ({ demand: 0, filled: 0, stockout: 0, essDemand: 0, essFilled: 0, essStockout: 0, delayUnitDays: 0 });

  for (const day of runLog.daily) {
    accessDelayUnitDays += day.dailyAccessDelayUnitDays ?? 0;
    const rd = regionDailyOf(day);
    for (const [rt, r] of Object.entries(rd)) {
      const agg = byRegion[rt] || (byRegion[rt] = blank());
      const post = byRegionPost[rt] || (byRegionPost[rt] = blank());
      for (const k of Object.keys(agg)) {
        agg[k] += r[k] || 0;
        if (onset != null && day.day >= onset) post[k] += r[k] || 0;
      }
      totalDemand += r.demand;
      totalFilled += r.filled;
      totalStockout += r.stockout;
    }
    weightedStockoutPenalty += weightedPenaltyOf(day, instance, weights);
    inventorySum += day.totalInventory ?? 0;
    maxBacklog = Math.max(maxBacklog, day.totalBacklog ?? 0);
    for (const [pk, row] of Object.entries(day.priorityTotals || {})) {
      if (!priorityAgg[pk]) continue;
      priorityAgg[pk].demand += row.demand;
      priorityAgg[pk].filled += row.filled ?? 0;
      priorityAgg[pk].stockout += row.stockout;
    }
    if (typeof day.transitUnitDays === 'number') {
      transitSum += day.transitUnitDays;
      transitCount += day.shippedUnits ?? 0;
    } else {
      for (const sh of day.shipments || []) {
        transitSum += sh.transitDays * sh.qty;
        transitCount += sh.qty;
      }
    }
  }

  let permanentlyUnmet = 0;
  let eventuallyFilled = 0;
  for (const row of runLog.pharmacyStatesSummary || []) {
    permanentlyUnmet += row.permanentlyUnmetUnits ?? 0;
    eventuallyFilled += row.eventuallyFilledUnits ?? 0;
  }

  const days = runLog.daily.length || 1;
  const stockoutRate = totalDemand > 0 ? totalStockout / totalDemand : 0;
  const fillRate = totalDemand > 0 ? totalFilled / totalDemand : 1;
  const avgSyntheticAccessDelayDays = totalDemand > 0 ? accessDelayUnitDays / totalDemand : 0;
  const avgDeliveryTimeDays = transitCount > 0 ? transitSum / transitCount : 0;
  const avgInventory = inventorySum / days;
  const inventoryTurnover = avgInventory > 0 ? totalFilled / avgInventory : 0;

  const regional = {};
  for (const rt of REGION_TYPES) {
    const r = byRegion[rt];
    if (!r) continue;
    const post = byRegionPost[rt];
    regional[rt] = {
      demand: r.demand,
      fillRate: r.demand > 0 ? r.filled / r.demand : 1,
      stockoutRate: r.demand > 0 ? r.stockout / r.demand : 0,
      essentialFillRate: r.essDemand > 0 ? r.essFilled / r.essDemand : (r.demand > 0 ? 1 - r.essStockout / r.demand : 1),
      essentialFillRatePostOnset: post && post.essDemand > 0 ? post.essFilled / post.essDemand : null,
      essentialUnmetUnits: r.essStockout,
      avgSyntheticAccessDelayDays: r.demand > 0 ? r.delayUnitDays / r.demand : 0,
      serviceCoverage: r.demand > 0 ? r.filled / r.demand : 1,
    };
  }

  const regionVals = Object.values(regional);
  const stockoutRates = regionVals.map((x) => x.stockoutRate);
  const waitTimes = regionVals.map((x) => x.avgSyntheticAccessDelayDays);
  const fillRates = regionVals.map((x) => x.fillRate);
  const essFill = regionVals.map((x) => x.essentialFillRate);
  const essFillPost = regionVals.map((x) => x.essentialFillRatePostOnset).filter((x) => x != null);

  const stockoutGap = spread(stockoutRates);
  const waitGap = spread(waitTimes);
  const giniCoverage = gini(fillRates);
  const serviceInequalityIndex = computeServiceInequalityIndex({
    stockoutGap,
    waitGap,
    giniCoverage,
    maxRelevantWaitDays: maxWait,
    weights: ineqWeights,
  });

  const resilience = computeResilienceMetrics(runLog.daily, scenario);
  const last = runLog.daily[runLog.daily.length - 1];
  const waits = waitingTimeStats(runLog.waitHistogram);
  const counters = runLog.counters || {};
  const sameDayUnfilledUnits = totalStockout;

  return {
    policyId,
    totalCost: runLog.totalCost || 0,
    costs: runLog.costs || null,
    overallFillRate: fillRate,
    essentialMedicineFillRate: rateFilled(priorityAgg.essential),
    regionalServiceGap: spread(essFill),
    sameDayUnfilledUnits,
    sameDayUnfilledRate: stockoutRate,
    cumulativeUnmetDemand: sameDayUnfilledUnits,
    lateFilledUnits: eventuallyFilled,
    lateFilledRate: totalDemand > 0 ? eventuallyFilled / totalDemand : 0,
    horizonEndUnmetUnits: permanentlyUnmet,
    horizonEndUnmetRate: totalDemand > 0 ? permanentlyUnmet / totalDemand : 0,
    backlogArea: accessDelayUnitDays,
    stockoutIncidentRate: counters.demandLines > 0 ? counters.stockoutIncidents / counters.demandLines : 0,
    essentialStockoutIncidentRate: counters.essDemandLines > 0 ? counters.essStockoutIncidents / counters.essDemandLines : 0,
    meanWaitingTime: waits.all.mean,
    p95WaitingTime: waits.all.p95,
    meanWaitingTimeEssential: waits.essential.mean,
    p95WaitingTimeEssential: waits.essential.p95,
    waitingTimeCensoredUnits: waits.all.censoredUnits,
    recoveryTime90: resilience.timeToRecovery90,
    recoveryTime95: resilience.timeToRecovery95,
    recoveryTime99: resilience.timeToRecovery99,
    lateralTransferUnits: counters.transferUnits ?? 0,
    lateralTransferCount: counters.transfers ?? 0,
    backupSupplierUnits: counters.upstreamUnitsByTier?.backup ?? 0,
    stockoutRate,
    fillRate,
    orderFillRate: fillRate,
    essentialFillRate: rateFilled(priorityAgg.essential),
    essentialStockoutRate: rate(priorityAgg.essential),
    chronicStockoutRate: rate(priorityAgg['chronic-care']),
    routineStockoutRate: rate(priorityAgg.routine),
    worstRegionEssentialFillRate: essFill.length ? Math.min(...essFill) : 1,
    worstRegionEssentialFillRatePostOnset: essFillPost.length ? Math.min(...essFillPost) : null,
    minRegionalServiceLevel: fillRates.length ? Math.min(...fillRates) : 1,
    essentialServiceGap: spread(essFill),
    cumulativeUnmetEssentialDemand: priorityAgg.essential.stockout,
    maxBacklog,
    backlogAtHorizon: last?.totalBacklog ?? 0,
    serviceLossAUC: resilience.serviceLossAUC,
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
      essentialServiceGap: spread(essFill),
      serviceInequalityIndex,
      formula: 'weighted mean of normalized stockoutGap, waitGap/maxWait, giniCoverage in [0,1]',
    },
    penalties: {
      weightedStockoutPenalty,
      waitingTimePenalty: accessDelayUnitDays * waitW,
      inequityPenalty: serviceInequalityIndex * ineqW,
      compositeScore: (runLog.totalCost || 0) + weightedStockoutPenalty + accessDelayUnitDays * waitW + serviceInequalityIndex * ineqW,
    },
    disclaimer: 'Synthetic simulation metrics only.',
  };
}

/**
 * Waiting time per demanded unit (days) from the run's histograms: units filled on the day of
 * demand wait 0, backordered units wait (day handed out − day demanded), units still backordered at
 * the horizon enter with their censored wait (horizon − day demanded), so the mean and p95 are lower
 * bounds whenever censoredUnits > 0.
 */
function waitingTimeStats(hist) {
  const summarize = (served, censored) => {
    const rows = [];
    for (const [w, u] of Object.entries(served || {})) rows.push([Number(w), u]);
    let censoredUnits = 0;
    for (const [w, u] of Object.entries(censored || {})) { rows.push([Number(w), u]); censoredUnits += u; }
    const total = rows.reduce((s, [, u]) => s + u, 0);
    if (total <= 0) return { mean: 0, p95: 0, units: 0, censoredUnits: 0 };
    rows.sort((a, b) => a[0] - b[0]);
    const meanW = rows.reduce((s, [w, u]) => s + w * u, 0) / total;
    let cum = 0;
    let p95 = rows[rows.length - 1][0];
    for (const [w, u] of rows) {
      cum += u;
      if (cum >= 0.95 * total - 1e-9) { p95 = w; break; }
    }
    return { mean: meanW, p95, units: total, censoredUnits };
  };
  return {
    all: summarize(hist?.all, hist?.censoredAll),
    essential: summarize(hist?.essential, hist?.censoredEssential),
  };
}

function spread(vals) {
  return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
}

function gini(values) {
  if (!values.length) return 0;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let num = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) num += Math.abs(values[i] - values[j]);
  }
  return num / (2 * n * n * mean);
}

function rate(agg) {
  return agg.demand > 0 ? agg.stockout / agg.demand : 0;
}

function rateFilled(agg) {
  return agg.demand > 0 ? (agg.demand - agg.stockout) / agg.demand : 1;
}

function firstEventStartDay(scenario) {
  return scenario?.events?.length ? Math.min(...scenario.events.map((e) => e.startDay)) : null;
}

/**
 * Resilience on the daily essential fill rate EF_t (falls back to overall fill rate).
 *   baseline B   = mean EF_t over warm-up days [7, onset)
 *   AUC          = Σ_{t ≥ onset} max(0, B − EF_t)                         (fraction·days, lower is better)
 *   S_t          = trailing 7-day mean of EF_t; trough = min_{t ≥ onset} S_t
 *   T_p          = 0 if trough ≥ p·B; else max(0, t* − end) with t* the first day ≥ trough day with S_t ≥ p·B;
 *                  null if not reached within the horizon (right-censored)
 *   slope        = (S_{t*95} − trough) / (t*95 − troughDay)                  (fraction per day)
 */
function computeResilienceMetrics(daily, scenario) {
  const onset = firstEventStartDay(scenario);
  const end = lastEventEndDay(scenario);
  const ef = daily.map((d) => d.dailyEssentialFillRate ?? d.dailyFillRate ?? (1 - (d.dailyStockoutRate ?? 0)));
  const sr = daily.map((d) => d.dailyStockoutRate ?? 0);

  const warm = daily.map((d, i) => i).filter((i) => (onset == null || daily[i].day < onset) && daily[i].day >= WARMUP_SKIP_DAYS);
  const warmIdx = warm.length ? warm : daily.map((d, i) => i).filter((i) => onset == null || daily[i].day < onset);
  const baseline = warmIdx.length ? mean(warmIdx.map((i) => ef[i])) : (ef[0] ?? 1);
  const baselineStockout = warmIdx.length ? mean(warmIdx.map((i) => sr[i])) : (sr[0] ?? 0);

  const smoothed = ef.map((_, i) => mean(ef.slice(Math.max(0, i - SMOOTHING_DAYS + 1), i + 1)));
  const out = {
    baselineEssentialFillRate: baseline,
    baselinePreDisruptionStockoutRate: baselineStockout,
    disruptionPeakStockoutRate: sr.length ? Math.max(...sr) : 0,
    firstDisruptionStartDay: onset,
    lastDisruptionEndDay: end,
    serviceLossAUC: 0,
    serviceLossAbsolute: ef.reduce((s, v) => s + (1 - v), 0),
    troughEssentialFillRate: null,
    troughDay: null,
    timeToRecovery90: null,
    timeToRecovery95: null,
    timeToRecovery99: null,
    recoveredWithinHorizon: {},
    recoverySlope: null,
    recoveryDay: null,
    daysToRecover: null,
  };
  if (onset == null) return out;

  const postIdx = daily.map((d, i) => i).filter((i) => daily[i].day >= onset);
  out.serviceLossAUC = postIdx.reduce((s, i) => s + Math.max(0, baseline - ef[i]), 0);
  if (!postIdx.length) return out;

  let troughI = postIdx[0];
  for (const i of postIdx) if (smoothed[i] < smoothed[troughI]) troughI = i;
  out.troughEssentialFillRate = smoothed[troughI];
  out.troughDay = daily[troughI].day;

  for (const p of RECOVERY_LEVELS) {
    const key = `timeToRecovery${Math.round(p * 100)}`;
    const target = p * baseline;
    if (smoothed[troughI] >= target - 1e-12) {
      out[key] = 0;
      out.recoveredWithinHorizon[key] = true;
      if (p === 0.95) out.recoveryDay = daily[troughI].day;
      continue;
    }
    const hit = postIdx.find((i) => i >= troughI && smoothed[i] >= target - 1e-12);
    out.recoveredWithinHorizon[key] = hit != null;
    if (hit != null) {
      out[key] = Math.max(0, daily[hit].day - end);
      if (p === 0.95) {
        out.recoveryDay = daily[hit].day;
        out.recoverySlope = hit > troughI ? (smoothed[hit] - smoothed[troughI]) / (daily[hit].day - daily[troughI].day) : null;
      }
    }
  }
  out.daysToRecover = out.timeToRecovery95;
  return out;
}

function mean(vals) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Primary reported metrics with direction ('higher' | 'lower' is better). */
const PRIMARY_METRICS = [
  { key: 'overallFillRate', better: 'higher' },
  { key: 'essentialMedicineFillRate', better: 'higher' },
  { key: 'worstRegionEssentialFillRate', better: 'higher' },
  { key: 'regionalServiceGap', better: 'lower' },
  { key: 'cumulativeUnmetDemand', better: 'lower' },
  { key: 'backlogArea', better: 'lower' },
  { key: 'stockoutIncidentRate', better: 'lower' },
  { key: 'horizonEndUnmetRate', better: 'lower' },
  { key: 'meanWaitingTime', better: 'lower' },
  { key: 'p95WaitingTime', better: 'lower' },
  { key: 'recoveryTime90', better: 'lower' },
  { key: 'recoveryTime95', better: 'lower' },
  { key: 'recoveryTime99', better: 'lower' },
  { key: 'serviceLossAUC', better: 'lower' },
  { key: 'totalCost', better: 'lower' },
];

const SUMMARY_KEYS = [
  ...PRIMARY_METRICS.map((m) => m.key),
  'sameDayUnfilledRate', 'lateFilledRate', 'horizonEndUnmetUnits', 'lateFilledUnits',
  'essentialStockoutIncidentRate', 'meanWaitingTimeEssential', 'p95WaitingTimeEssential',
  'lateralTransferUnits', 'backupSupplierUnits',
  'stockoutRate', 'fillRate', 'essentialFillRate', 'essentialStockoutRate', 'chronicStockoutRate',
  'avgSyntheticAccessDelayDays', 'serviceInequalityIndex', 'avgDeliveryTimeDays',
  'minRegionalServiceLevel', 'essentialServiceGap', 'cumulativeUnmetEssentialDemand', 'maxBacklog', 'backlogAtHorizon',
];

const BOOTSTRAP_SEED = 20240901;
const BOOTSTRAP_RESAMPLES = 2000;

/**
 * Paired percentile bootstrap of the mean difference over common random-number replicates.
 * Resamples replicate indices with a fixed seed, so the CI is reproducible.
 */
function pairedBootstrap(diffs, { resamples = BOOTSTRAP_RESAMPLES, seed = BOOTSTRAP_SEED } = {}) {
  const n = diffs.length;
  if (!n) return null;
  const rng = createRng(`bootstrap:${seed}`);
  const m = mean(diffs);
  const means = new Float64Array(resamples);
  for (let b = 0; b < resamples; b += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += diffs[Math.floor(rng.next() * n)];
    means[b] = s / n;
  }
  means.sort();
  const q = (p) => means[Math.min(resamples - 1, Math.max(0, Math.floor(p * resamples)))];
  const sd = n > 1 ? Math.sqrt(diffs.reduce((acc, v) => acc + (v - m) ** 2, 0) / (n - 1)) : 0;
  return {
    meanDiff: m,
    sd,
    ci95Low: q(0.025),
    ci95High: q(0.975),
    n,
    resamples,
    bootstrapSeed: seed,
    wins: diffs.filter((d) => d > 1e-12).length,
    losses: diffs.filter((d) => d < -1e-12).length,
    ties: diffs.filter((d) => Math.abs(d) <= 1e-12).length,
  };
}

/**
 * Price of Equity of policy A relative to a reference (default: cost-only):
 *   PoE = (C_A − C_ref) / C_ref       (relative extra total cost; may be negative)
 * computed on paired replicate means.
 */
function priceOfEquity(costA, costRef) {
  if (!(costRef > 0)) return null;
  return (costA - costRef) / costRef;
}

function aggregateReplicates(metricsList) {
  if (!metricsList.length) return null;
  const summary = {};
  for (const k of SUMMARY_KEYS) {
    const vals = metricsList.map((m) => m[k]).filter((v) => typeof v === 'number');
    if (vals.length) summary[k] = stats(vals);
  }
  summary.replicates = metricsList.length;
  summary.replicateStockoutRates = metricsList.map((m) => m.stockoutRate);
  return summary;
}

function aggregateRegionalReplicates(results) {
  if (!results?.length) return null;
  const out = {};
  for (const rt of REGION_TYPES) {
    const stockoutRates = [];
    const fillRates = [];
    const essFill = [];
    const delays = [];
    for (const r of results) {
      const reg = r.metrics?.regional?.[rt];
      if (!reg) continue;
      stockoutRates.push(reg.stockoutRate);
      fillRates.push(reg.fillRate);
      essFill.push(reg.essentialFillRate ?? reg.fillRate);
      delays.push(reg.avgSyntheticAccessDelayDays ?? reg.avgAccessTimeDays ?? 0);
    }
    if (stockoutRates.length) {
      out[rt] = {
        stockoutRate: stats(stockoutRates),
        fillRate: stats(fillRates),
        essentialFillRate: stats(essFill),
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
    const essFill = [];
    for (const r of results) {
      const d = r.runLog?.daily?.[day];
      if (d) {
        stockoutRates.push(d.dailyStockoutRate ?? 0);
        fillRates.push(d.dailyFillRate ?? 0);
        essFill.push(d.dailyEssentialFillRate ?? d.dailyFillRate ?? 0);
      }
    }
    if (stockoutRates.length) {
      series.push({
        day,
        dailyStockoutRate: stats(stockoutRates),
        dailyFillRate: stats(fillRates),
        dailyEssentialFillRate: stats(essFill),
      });
    }
  }
  return series;
}

/**
 * Paired comparisons (A − B) on every PRIMARY_METRICS key, matched by seed (common random numbers).
 * Recovery times that are null (not recovered within the horizon) are excluded pairwise and counted.
 */
function pairedPolicyComparison(resultsByPolicy, { keys = PRIMARY_METRICS.map((m) => m.key), referencePolicy = 'cost-first' } = {}) {
  const policies = Object.keys(resultsByPolicy);
  if (policies.length < 2) return null;
  const bySeed = Object.fromEntries(policies.map((p) => [p, new Map(resultsByPolicy[p].map((r) => [r.seed, r]))]));
  const pairs = [];
  for (let i = 0; i < policies.length - 1; i += 1) {
    for (let j = i + 1; j < policies.length; j += 1) {
      const a = policies[i];
      const b = policies[j];
      const common = [...bySeed[a].keys()].filter((s) => bySeed[b].has(s));
      const metrics = {};
      for (const key of keys) {
        const diffs = [];
        let excluded = 0;
        for (const s of common) {
          const va = bySeed[a].get(s).metrics[key];
          const vb = bySeed[b].get(s).metrics[key];
          if (typeof va === 'number' && typeof vb === 'number') diffs.push(va - vb);
          else excluded += 1;
        }
        metrics[key] = diffs.length ? { ...pairedBootstrap(diffs), excludedPairs: excluded } : null;
      }
      pairs.push({ policyA: a, policyB: b, pairedReplicates: common.length, metrics });
    }
  }
  let poe = null;
  if (resultsByPolicy[referencePolicy]) {
    const refCost = mean(resultsByPolicy[referencePolicy].map((r) => r.metrics.totalCost));
    poe = Object.fromEntries(policies.map((p) => [p, priceOfEquity(mean(resultsByPolicy[p].map((r) => r.metrics.totalCost)), refCost)]));
  }
  return { referencePolicy, priceOfEquity: poe, pairs };
}

/** Student-t critical value (two-sided 95%) — normal approximation above 30 df. */
function t95(df) {
  const table = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
    2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
    2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  if (df <= 0) return 0;
  return df <= 30 ? table[df - 1] : 1.96 + 2.4 / df;
}

function stats(vals) {
  const n = vals.length;
  const m = vals.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? vals.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const half = t95(n - 1) * (std / Math.sqrt(n));
  return { mean: m, std, ci95Low: m - half, ci95High: m + half, n };
}

module.exports = {
  computeRunMetrics,
  computeServiceInequalityIndex,
  computeResilienceMetrics,
  aggregateReplicates,
  aggregateRegionalReplicates,
  aggregateDailyTimeSeries,
  pairedPolicyComparison,
  pairedBootstrap,
  priceOfEquity,
  waitingTimeStats,
  stats,
  gini,
  PRIMARY_METRICS,
  SUMMARY_KEYS,
  BOOTSTRAP_SEED,
  RECOVERY_LEVELS,
  PRIORITY_WEIGHT,
};
