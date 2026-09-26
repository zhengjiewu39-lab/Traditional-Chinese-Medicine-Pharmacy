/**
 * Regional under-service signals computed from a trailing window of realized history.
 *
 * For each region r over the last W days:
 *   EF_r = essential units filled from stock / essential units demanded     (essential fill rate)
 *   BR_r = end-of-day backlog units / units demanded                         (backlog rate)
 *   AD_r = backlog unit-days / units demanded                                (synthetic access delay, days)
 *
 * Deficit (≥ 0, and exactly 0 for every region when regions perform identically):
 *   deficit_r = (max_r' EF_r' − EF_r) + (BR_r − min_r' BR_r') + (AD_r − min_r' AD_r') / maxWaitDays
 */

const { REGION_TYPES } = require('./scenarioSchema');

const EPS = 1e-12;

function emptyRegionRow() {
  return { demand: 0, filled: 0, essDemand: 0, essFilled: 0, backlog: 0, delayUnitDays: 0 };
}

function summarizeWindow(history, window = 7) {
  const rows = history.slice(-window);
  const agg = Object.fromEntries(REGION_TYPES.map((rt) => [rt, emptyRegionRow()]));
  for (const day of rows) {
    for (const rt of REGION_TYPES) {
      const d = day[rt];
      if (!d) continue;
      for (const k of Object.keys(agg[rt])) agg[rt][k] += d[k] || 0;
    }
  }
  const stats = {};
  for (const rt of REGION_TYPES) {
    const a = agg[rt];
    stats[rt] = {
      essentialFillRate: a.essDemand > 0 ? a.essFilled / a.essDemand : 1,
      fillRate: a.demand > 0 ? a.filled / a.demand : 1,
      backlogRate: a.demand > 0 ? a.backlog / a.demand : 0,
      accessDelayDays: a.demand > 0 ? a.delayUnitDays / a.demand : 0,
      observedDemand: a.demand,
    };
  }
  return stats;
}

function computeRegionalDeficits(regionalStats, { maxWaitDays = 30, regions = REGION_TYPES } = {}) {
  const present = regions.filter((rt) => regionalStats[rt]);
  if (!present.length) return {};
  const ef = present.map((rt) => regionalStats[rt].essentialFillRate ?? 1);
  const br = present.map((rt) => regionalStats[rt].backlogRate ?? 0);
  const ad = present.map((rt) => regionalStats[rt].accessDelayDays ?? 0);
  const maxEf = Math.max(...ef);
  const minBr = Math.min(...br);
  const minAd = Math.min(...ad);
  const worstEf = Math.min(...ef);

  const out = {};
  present.forEach((rt, i) => {
    const fillDeficit = Math.max(0, maxEf - ef[i]);
    const backlogDeficit = Math.max(0, br[i] - minBr);
    const delayDeficit = Math.max(0, ad[i] - minAd) / maxWaitDays;
    const deficit = fillDeficit + backlogDeficit + delayDeficit;
    out[rt] = {
      fillDeficit,
      backlogDeficit,
      delayDeficit,
      deficit: deficit > EPS ? deficit : 0,
      isWorstRegion: fillDeficit > EPS && Math.abs(ef[i] - worstEf) < EPS,
    };
  });
  return out;
}

module.exports = { summarizeWindow, computeRegionalDeficits, emptyRegionRow };
