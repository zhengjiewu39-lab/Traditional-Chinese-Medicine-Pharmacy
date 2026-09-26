/**
 * ERRRA heuristic — Equity-constrained Resilient Rolling-horizon Allocation.
 *
 * Solved daily with information available on day t only. Two lexicographic stages:
 *
 * Stage 1 (guarantee, cost-agnostic): water-filling that maximizes
 *     min_r [ min(SR_r(x), φ) − β (v_r − 1) ]
 *   over essential lines, where SR_r(x) = Σ_{l∈E_r} min(a_l + x_l, n_l) / Σ_{l∈E_r} n_l
 *   is the projected essential service rate of region r over the rolling horizon,
 *   a_l = onHand + onOrder, n_l = projected need (horizon demand + safety + backlog),
 *   subject to per-warehouse dispatch capacity and per-warehouse SKU stock.
 *
 * Stage 2 (efficiency, cost-aware): with the stage-1 allocation fixed (so the stage-1
 *   worst-region level cannot decrease), add further units only where the expected
 *   net benefit (avoided stockout penalty + avoided synthetic delay − procurement,
 *   transport, fixed order and expected holding cost) is positive, processing
 *   essential → chronic-care → routine tiers, and without pushing any region's
 *   projected essential SR above (current worst SR + δ) unless the worst region can no
 *   longer be improved (no leveling down).
 *
 * This is a heuristic, not an exact optimizer, except for the single-resource stage-1
 * problem where unit-step water-filling is exact (see server/simulation/__tests__/errra.test.js).
 */

const { REGION_TYPES } = require('./scenarioSchema');

const EPS = 1e-9;

function regionSR(cov, need) {
  return need > EPS ? cov / need : 1;
}

/**
 * Stage 1 water-filling.
 * @param {Array} lines — { key, regionType, warehouseId, drugId, v, avail, need, pharmacyIndex }
 * @param {Object} capRemaining — warehouseId → units (mutated)
 * @param {Object} stockRemaining — warehouseId → drugId → units (mutated)
 * @returns {{ alloc: Map<string, number>, order: string[], regionalSR: Object, stage1Value: number }}
 */
function waterFillStage1(lines, capRemaining, stockRemaining, {
  serviceFloor = 1,
  beta = 0,
  batchFraction = 0.1,
  regions = REGION_TYPES,
} = {}) {
  const alloc = new Map();
  const order = [];
  const byRegion = Object.fromEntries(regions.map((r) => [r, []]));
  const need = Object.fromEntries(regions.map((r) => [r, 0]));
  const cov = Object.fromEntries(regions.map((r) => [r, 0]));
  const vuln = Object.fromEntries(regions.map((r) => [r, 1]));

  for (const l of lines) {
    if (!byRegion[l.regionType]) continue;
    byRegion[l.regionType].push(l);
    need[l.regionType] += l.need;
    cov[l.regionType] += Math.min(l.avail, l.need);
    vuln[l.regionType] = l.v ?? 1;
  }

  const lineCov = (l) => Math.min(l.avail + (alloc.get(l.key) || 0), l.need);
  const lineRoom = (l) => {
    const gap = Math.max(0, l.need - l.avail - (alloc.get(l.key) || 0));
    const cap = capRemaining[l.warehouseId] ?? 0;
    const stock = stockRemaining[l.warehouseId]?.[l.drugId] ?? 0;
    return Math.max(0, Math.floor(Math.min(gap, cap, stock)));
  };

  const floor = Math.max(0, Math.min(1, serviceFloor));
  let guard = 0;
  while (floor > 0 && guard < 200000) {
    guard += 1;
    let best = null;
    for (const r of regions) {
      if (need[r] <= EPS) continue;
      const sr = regionSR(cov[r], need[r]);
      if (sr >= floor - EPS) continue;
      const feasible = byRegion[r].filter((l) => lineRoom(l) > 0);
      if (!feasible.length) continue;
      const key = sr - beta * (vuln[r] - 1);
      if (!best || key < best.key - EPS || (Math.abs(key - best.key) <= EPS && vuln[r] > vuln[best.r])) {
        best = { r, key, feasible };
      }
    }
    if (!best) break;

    let line = null;
    let lineRatio = Infinity;
    for (const l of best.feasible) {
      const ratio = l.need > EPS ? lineCov(l) / l.need : 1;
      if (ratio < lineRatio - EPS || (Math.abs(ratio - lineRatio) <= EPS && l.pharmacyIndex < line.pharmacyIndex)) {
        line = l;
        lineRatio = ratio;
      }
    }
    const toFloor = Math.max(1, Math.ceil(floor * need[best.r] - cov[best.r]));
    const chunk = Math.max(1, Math.min(
      lineRoom(line),
      toFloor,
      Math.max(1, Math.ceil(batchFraction * line.need)),
    ));
    const before = lineCov(line);
    alloc.set(line.key, (alloc.get(line.key) || 0) + chunk);
    if (!order.includes(line.key)) order.push(line.key);
    capRemaining[line.warehouseId] -= chunk;
    stockRemaining[line.warehouseId][line.drugId] -= chunk;
    cov[best.r] += lineCov(line) - before;
  }

  const regionalSR = {};
  for (const r of regions) if (need[r] > EPS) regionalSR[r] = regionSR(cov[r], need[r]);
  const vals = Object.values(regionalSR);
  return {
    alloc,
    order,
    regionalSR,
    need,
    cov,
    stage1Value: vals.length ? Math.min(...vals) : 1,
  };
}

/**
 * Full daily ERRRA plan.
 * @param {Array} lines — all pharmacy×SKU lines with fields from policyEngine.buildLines
 *   plus { stage2Qty, stage2Net(qTotal, opened) } helpers.
 */
function planErrra({ lines, capRemaining, stockRemaining, params }) {
  const {
    serviceFloor = 0.95,
    maxRegionalGap = 0.1,
    vulnerabilityBeta = 0.05,
    batchFraction = 0.1,
    useServiceFloor = true,
    useVulnerability = true,
    useEssentialPriority = true,
  } = params;

  const stage1Lines = lines.filter((l) => (useEssentialPriority ? l.priority === 'essential' : true));
  const s1 = waterFillStage1(stage1Lines, capRemaining, stockRemaining, {
    serviceFloor: useServiceFloor ? serviceFloor : 0,
    beta: useVulnerability ? vulnerabilityBeta : 0,
    batchFraction,
  });

  const alloc = new Map(s1.alloc);
  const reasons = new Map();
  for (const k of s1.alloc.keys()) reasons.set(k, 'ERRRA stage 1: raise worst-region projected essential service toward floor');
  const rankOrder = [...s1.order];
  const decisions = [];

  const essLineByKey = new Map(stage1Lines.map((l) => [l.key, l]));
  const regionCov = { ...s1.cov };
  const regionNeed = { ...s1.need };
  const srOf = (r) => regionSR(regionCov[r], regionNeed[r]);
  const essRegions = () => REGION_TYPES.filter((r) => regionNeed[r] > EPS);
  const worstRegion = () => essRegions().reduce((w, r) => (w == null || srOf(r) < srOf(w) ? r : w), null);
  const regionImprovable = (r) => stage1Lines.some((l) => l.regionType === r
    && (l.need - l.avail - (alloc.get(l.key) || 0)) > EPS
    && (capRemaining[l.warehouseId] ?? 0) >= 1
    && (stockRemaining[l.warehouseId]?.[l.drugId] ?? 0) >= 1);

  const tierOf = (l) => {
    if (!useEssentialPriority) return 0;
    return { essential: 0, 'chronic-care': 1, routine: 2 }[l.priority] ?? 2;
  };

  const candidates = lines
    .map((l) => {
      const already = alloc.get(l.key) || 0;
      const extra = Math.max(0, l.stage2Target - already);
      return { l, extra, already };
    })
    .filter((c) => c.extra > 0)
    .map((c) => ({ ...c, eval: c.l.evaluate(c.already + c.extra, c.already) }))
    .sort((a, b) => tierOf(a.l) - tierOf(b.l) || b.eval.netPerUnit - a.eval.netPerUnit
      || a.l.pharmacyIndex - b.l.pharmacyIndex);

  let gapRelaxed = false;
  const deferredByGap = [];

  const tryAllocate = (c, secondPass) => {
    const { l } = c;
    if (c.eval.net <= 0) {
      if (!secondPass) decisions.push({ key: l.key, stage: 2, selected: false, notSelectedReason: 'negative_net_benefit', net: c.eval.net });
      return;
    }
    let qty = Math.floor(Math.min(
      c.extra,
      capRemaining[l.warehouseId] ?? 0,
      stockRemaining[l.warehouseId]?.[l.drugId] ?? 0,
    ));
    if (qty <= 0) {
      if (!secondPass) decisions.push({ key: l.key, stage: 2, selected: false, notSelectedReason: 'capacity_or_stock_exhausted' });
      return;
    }
    const essLine = essLineByKey.get(l.key);
    if (essLine) {
      const w = worstRegion();
      const r = l.regionType;
      if (w && r !== w) {
        const lineGap = Math.max(0, l.need - l.avail - (alloc.get(l.key) || 0));
        const covIncrease = Math.min(qty, lineGap);
        const allowedCov = Math.max(0, Math.floor((srOf(w) + maxRegionalGap) * regionNeed[r] - regionCov[r]));
        const allowedByGap = covIncrease <= allowedCov ? qty : allowedCov;
        if (allowedByGap < qty) {
          if (regionImprovable(w)) {
            if (!secondPass) deferredByGap.push(c);
            qty = allowedByGap;
          } else {
            gapRelaxed = true;
          }
        }
      }
    }
    if (qty <= 0) return;
    const before = essLine ? Math.min(l.avail + (alloc.get(l.key) || 0), l.need) : 0;
    alloc.set(l.key, (alloc.get(l.key) || 0) + qty);
    capRemaining[l.warehouseId] -= qty;
    stockRemaining[l.warehouseId][l.drugId] -= qty;
    c.extra -= qty;
    if (essLine) regionCov[l.regionType] += Math.min(l.avail + alloc.get(l.key), l.need) - before;
    if (!rankOrder.includes(l.key)) rankOrder.push(l.key);
    if (!reasons.has(l.key)) reasons.set(l.key, `ERRRA stage 2: positive net benefit (tier ${tierOf(l)})`);
  };

  for (const c of candidates) tryAllocate(c, false);
  for (const c of deferredByGap) if (c.extra > 0) tryAllocate(c, true);

  const regionalSRAfter = Object.fromEntries(essRegions().map((r) => [r, srOf(r)]));
  const srVals = Object.values(regionalSRAfter);
  const projectedGap = srVals.length ? Math.max(...srVals) - Math.min(...srVals) : 0;
  const worstAfter = srVals.length ? Math.min(...srVals) : 1;

  return {
    alloc,
    rankOrder,
    reasons,
    decisions,
    diagnostics: {
      solver: 'ERRRA heuristic (water-filling stage 1 + greedy net-benefit stage 2)',
      status: 'heuristic_complete',
      stage1Value: s1.stage1Value,
      worstRegionProjectedSR: worstAfter,
      serviceFloor: useServiceFloor ? serviceFloor : null,
      floorSatisfied: useServiceFloor ? s1.stage1Value >= serviceFloor - EPS : null,
      maxRegionalGap,
      projectedGap,
      gapSatisfied: projectedGap <= maxRegionalGap + EPS,
      gapConstraintRelaxed: gapRelaxed,
      regionalSRBeforeStage2: s1.regionalSR,
      regionalSRAfter,
      stage1Units: [...s1.alloc.values()].reduce((a, b) => a + b, 0),
      totalUnits: [...alloc.values()].reduce((a, b) => a + b, 0),
    },
  };
}

module.exports = { planErrra, waterFillStage1, regionSR };
