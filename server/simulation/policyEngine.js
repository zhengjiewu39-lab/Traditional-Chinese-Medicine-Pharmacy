/**
 * Replenishment policies. All reorder quantities are computed from the inventory position
 *   IP = onHand + onOrder − backlog
 * (onOrder = units shipped by the warehouse or a lateral donor and not yet received), so a line
 * with an order in transit is not re-ordered for the same need.
 *
 * Every policy returns candidates with priorityScore (higher = served first) and priorityReason.
 * decideReplenishment applies one selection gate to all policies:
 *   qty > 0, expectedBenefit > 0, priorityScore > minPriorityScore, the serving warehouse holds
 *   stock of the SKU, and the warehouse has non-zero dispatch and truck capacity.
 * Selected orders are ranked by priorityScore; tieBreak (region, pharmacy, SKU) applies only to
 * exactly equal scores. Downstream dispatch and truck allocation keep this rank (or ration
 * proportionally for policies whose mechanism is proportional rationing).
 */

const { PRIORITY_WEIGHT } = require('./simulationConstants');
const {
  transportCostPerUnit,
  computeTransitDays,
  arrivalLagDays,
  NEUTRAL_FACTORS,
  tieBreak,
} = require('./distributionEngine');
const { inventoryPosition } = require('./inventoryEngine');
const { forecastFor } = require('./forecastEngine');
const { computeRegionalNeed } = require('./equitySignals');
const { effectiveDispatchCap } = require('./dispatchEngine');
const { expectedShortfall, inv: normInv } = require('./normalDist');
const { planErrra } = require('./errra');

const ERRRA_DEFAULTS = {
  serviceFloor: 0.95,
  maxRegionalGap: 0.10,
  vulnerabilityBeta: 0.05,
  projectionZ: 1.0,
  batchFraction: 0.1,
  disruptionBufferDays: 2,
  surgeDetectionRatio: 1.15,
  useServiceFloor: true,
  useVulnerability: true,
  useRollingHorizon: true,
  useEssentialPriority: true,
  useCompoundAwareness: true,
  useLateralTransfers: true,
  useSupplierRedundancy: true,
};

const EQUITY_AWARE_WEIGHTS = { stockout: 1, wait: 0.5, inequity: 2, cost: 0.01 };

const POLICIES = {
  'fixed-allocation': {
    id: 'fixed-allocation',
    shortName: 'fixed-allocation',
    name: 'Fixed allocation baseline',
    version: '4.0.0',
    algorithm: 'Periodic review (review day staggered by pharmacy index mod R) with a static order-up-to target = planning-prior daily demand × (nominal lead L + review period R + safetyDays); qty = max(0, target − IP); ignores observed demand and disruptions; shortages rationed proportionally; priorityScore = expected shortfall reduction per unit',
    params: { reviewPeriodDays: 3, safetyDays: 3 },
    rationing: 'proportional',
  },
  'reorder-point': {
    id: 'reorder-point',
    shortName: 'tuned-sQ',
    name: 'Tuned (s, Q) reorder-point baseline',
    version: '4.0.0',
    algorithm: 's = μL + z·σ·√L (nominal lead L incl. 1-day review); Q = max(1, round(qScale·√(2μK/h))); when IP ≤ s order n·Q with n = ⌈(s − IP)/Q⌉ (smallest multiple of Q that lifts IP above s); z, qScale per SKU × region type calibrated on calibration seeds disjoint from evaluation seeds; shortages rationed proportionally; priorityScore = expected shortfall reduction per unit',
    params: { z: 1.65, qScale: 1.0, perLine: null },
    rationing: 'proportional',
  },
  'cost-first': {
    id: 'cost-first',
    shortName: 'cost-only',
    name: 'Cost-only net-benefit heuristic',
    version: '4.0.0',
    algorithm: '(s, S) with cost-derived parameters: s = μτ + z*·σ√τ, z* = Φ⁻¹((p − c)/(p + hτ)), S = s + Q_EOQ; line selected only if expected avoided stockout penalty − (procurement + transport + fixed order + expected holding) > 0; ranked by net benefit per unit; no regional or vulnerability term',
    params: {},
  },
  'equity-aware': {
    id: 'equity-aware',
    shortName: 'weighted-equity',
    name: 'Weighted equity-aware heuristic',
    version: '4.0.0',
    algorithm: '(s, S) with s = μτ + z·σ√τ, S = s + Q_EOQ; ranked by weighted score = w_s·pw·ΔE[shortfall]·(1 + λ·needScore_r) + w_w·v·backlog − w_c·cost (λ = w_inequity), needScore_r = (1 − EF_r)·(v_r / max v)·(1 + min(1, BR_r)); a single weighted sum, no service floor',
    params: { z: 1.65 },
  },
  'equity-constrained-rolling-horizon': {
    id: 'equity-constrained-rolling-horizon',
    shortName: 'ERRRA',
    name: 'Equity-constrained Resilient Rolling-horizon Allocation (ERRRA allocation heuristic)',
    version: '2.0.0',
    algorithm: 'Daily two-stage lexicographic allocation heuristic: (1) water-filling max–min of projected regional essential service up to floor φ under warehouse dispatch capacity and stock; (2) cost-aware net-benefit additions by priority tier subject to regional gap ≤ δ (no leveling down)',
    params: { ...ERRRA_DEFAULTS },
  },
};

const ABLATIONS = {
  'errra-no-floor': { useServiceFloor: false, label: 'ERRRA − minimum service floor' },
  'errra-no-vulnerability': { useVulnerability: false, label: 'ERRRA − vulnerability weights' },
  'errra-no-rolling': { useRollingHorizon: false, label: 'ERRRA − rolling-horizon adaptation' },
  'errra-no-essential-priority': { useEssentialPriority: false, label: 'ERRRA − essential-medicine priority' },
  'errra-no-compound-awareness': { useCompoundAwareness: false, label: 'ERRRA − compound disruption awareness' },
  'errra-no-transfers': { useLateralTransfers: false, label: 'ERRRA − lateral emergency transfers' },
  'errra-no-supplier-redundancy': { useSupplierRedundancy: false, label: 'ERRRA − backup supplier redundancy' },
};

const ABLATION_POLICIES = Object.fromEntries(Object.entries(ABLATIONS).map(([id, a]) => {
  const { label, ...flags } = a;
  return [id, {
    id,
    shortName: id,
    name: label,
    version: POLICIES['equity-constrained-rolling-horizon'].version,
    algorithm: `Ablation of ERRRA allocation heuristic: ${Object.keys(flags).join(', ')} = false`,
    params: { ...ERRRA_DEFAULTS, ...flags },
    ablationOf: 'equity-constrained-rolling-horizon',
  }];
}));

const POLICY_ALIASES = {
  'fixed-allocation-v1': 'fixed-allocation',
  'reorder-point-v1': 'reorder-point',
  'tuned-sQ': 'reorder-point',
  'cost-first-v1': 'cost-first',
  'cost-only': 'cost-first',
  'equity-aware-v1': 'equity-aware',
  'weighted-equity': 'equity-aware',
  errra: 'equity-constrained-rolling-horizon',
  ERRRA: 'equity-constrained-rolling-horizon',
};

function resolvePolicyId(id) {
  if (!id) return null;
  if (POLICIES[id] || ABLATION_POLICIES[id]) return id;
  return POLICY_ALIASES[id] || null;
}

function listPolicies() {
  return Object.values(POLICIES);
}

function listAblations() {
  return Object.values(ABLATION_POLICIES);
}

function getPolicy(id) {
  const canonical = resolvePolicyId(id);
  if (!canonical) return null;
  return POLICIES[canonical] || ABLATION_POLICIES[canonical];
}

function resolveParams(policyId, scenario, override) {
  const canonical = resolvePolicyId(policyId);
  const policy = getPolicy(canonical);
  return {
    minPriorityScore: 0,
    ...(policy?.params || {}),
    ...(scenario?.policyParams?.[canonical] || {}),
    ...(override || {}),
  };
}

function stockoutPenaltyPerUnit(drug, scenario) {
  return drug.stockoutPenalty ?? scenario.metricsWeights?.stockoutPenaltyByPriority?.[drug.priority] ?? 15;
}

function isErrraFamily(policyId) {
  return policyId === 'equity-constrained-rolling-horizon' || Boolean(ABLATION_POLICIES[policyId]);
}

/**
 * Expected economics of shipping q units to a line with inventory position ip, over the
 * replenishment cycle τ_c = τ + Q/μ with demand D ~ N(μτ_c, σ²τ_c). Stockout loss appears
 * only on the benefit side (never also as a cost).
 *   ΔES     = E[(D − ip)⁺] − E[(D − ip − q)⁺]
 *   benefit = (p + w·τ/2) · ΔES                        (avoided penalty + avoided synthetic delay)
 *   cost    = (c_proc + c_trans)·q + K·1[line not yet opened today] + h·q·q/(2μ)
 * with Q = min(√(2μK/h), μ·maxCycleDays).
 */
function lineEconomics(line, q, alreadyOpened = false) {
  if (q <= 0) return { q: 0, deltaShortfall: 0, benefit: 0, cost: 0, net: 0, netPerUnit: 0 };
  const esBefore = expectedShortfall(line.ip, line.muCycle, line.sigmaCycle);
  const esAfter = expectedShortfall(line.ip + q, line.muCycle, line.sigmaCycle);
  const deltaShortfall = Math.max(0, esBefore - esAfter);
  const benefit = (line.penalty + line.delayPenaltyPerDay * line.tau / 2) * deltaShortfall;
  const variable = (line.procurement + line.transport) * q;
  const fixed = alreadyOpened ? 0 : line.orderCost;
  const holding = line.holding * q * (q / (2 * Math.max(line.mu, 0.1)));
  const cost = variable + fixed + holding;
  const net = benefit - cost;
  return { q, deltaShortfall, benefit, cost, variable, fixed, holding, net, netPerUnit: net / q };
}

/** (s, S) order quantity: when IP ≤ s order up to s + Q, Q = line.cycleQ. */
function batchOrderQty(line, s, Q) {
  if (line.ip > s) return 0;
  return Math.max(0, Math.ceil(s + Q - line.ip));
}

function newsvendorZ(line) {
  if (line.penalty <= line.procurement + line.transport) return null;
  const cr = (line.penalty - line.procurement - line.transport) / (line.penalty + line.holding * line.tau);
  return Math.max(-1, Math.min(3, normInv(Math.min(0.999, Math.max(0.001, cr)))));
}

/** Build one planning line per pharmacy × SKU from current state and history-only forecasts. */
function buildLines(ctx, { adaptiveForecast = true, useCurrentFactors = true, bufferDays = 0, surgeRatio = Infinity } = {}) {
  const { instance, pharmacyStates, forecasts, eventFactors } = ctx;
  const { pharmacies, drugs, scenario } = instance;
  const orderCost = scenario.logistics?.orderCost ?? 25;
  const maxCycleDays = scenario.logistics?.maxCycleDays ?? 30;
  const delayPenaltyPerDay = scenario.metricsWeights?.waitingTimePenaltyPerDay ?? 8;
  const stateById = new Map(pharmacyStates.map((s) => [s.id, s]));
  const factors = useCurrentFactors && eventFactors ? eventFactors : NEUTRAL_FACTORS;
  const lines = [];

  for (const ph of pharmacies) {
    const st = stateById.get(ph.id);
    if (!st) continue;
    const rt = ph.regionType;
    const supplySideDisruption = useCurrentFactors && eventFactors && (
      (eventFactors.supplyByWarehouse?.[ph.warehouseId] ?? 1) < 1
      || (eventFactors.transit[rt] ?? 1) > 1
      || (eventFactors.lead[rt] ?? 1) > 1
    );
    drugs.forEach((drug, drugIndex) => {
      const fc = forecastFor(forecasts, ph.id, drug.id, adaptiveForecast);
      const raw = forecasts[ph.id][drug.id];
      const demandSurge = adaptiveForecast && raw.prior > 0 && raw.mean / raw.prior >= surgeRatio;
      const transit = computeTransitDays(ph, scenario.regions[rt], drug, { eventFactors: factors }, scenario);
      const lead = arrivalLagDays(transit);
      const buffer = (supplySideDisruption || demandSurge) ? bufferDays : 0;
      const tau = lead + 1 + buffer;
      const onHand = st.onHand[drug.id] || 0;
      const onOrder = st.onOrder?.[drug.id] || 0;
      const backlog = st.backlog[drug.id] || 0;
      const holdingRate = drug.holdingCostPerUnitDay ?? 0.02;
      const eoqUnits = Math.sqrt((2 * Math.max(fc.mean, 0.1) * orderCost) / Math.max(holdingRate, 1e-4));
      const cycleQ = Math.max(1, Math.round(Math.min(eoqUnits, Math.max(fc.mean, 0.1) * maxCycleDays)));
      const tauCycle = tau + cycleQ / Math.max(fc.mean, 0.1);
      lines.push({
        key: `${ph.id}|${drug.id}`,
        pharmacyId: ph.id,
        pharmacyIndex: ph.index ?? 0,
        drugIndex,
        warehouseId: ph.warehouseId,
        drugId: drug.id,
        regionType: rt,
        priority: drug.priority,
        pw: PRIORITY_WEIGHT[drug.priority] ?? 1,
        v: ph.vulnerabilityWeight ?? 1,
        prior: raw.prior,
        mu: fc.mean,
        sigma: fc.sigma,
        lead,
        tau,
        muTau: fc.mean * tau,
        sigmaTau: fc.sigma * Math.sqrt(tau),
        cycleQ,
        tauCycle,
        muCycle: fc.mean * tauCycle,
        sigmaCycle: fc.sigma * Math.sqrt(tauCycle),
        onHand,
        onOrder,
        backlog,
        ip: inventoryPosition(st, drug.id),
        penalty: stockoutPenaltyPerUnit(drug, scenario),
        procurement: drug.unitProcurementCost ?? 2,
        transport: transportCostPerUnit(ph, scenario),
        holding: holdingRate,
        orderCost,
        delayPenaltyPerDay,
        disruptionObserved: Boolean(supplySideDisruption || demandSurge),
      });
    });
  }
  return lines;
}

function candidate(line, qty, extra) {
  return {
    pharmacyId: line.pharmacyId,
    warehouseId: line.warehouseId,
    drugId: line.drugId,
    regionType: line.regionType,
    priority: line.priority,
    inventoryPosition: line.ip,
    onHand: line.onHand,
    onOrder: line.onOrder,
    backlog: line.backlog,
    requestQty: qty,
    qty,
    line,
    ...extra,
  };
}

/** Expected shortfall reduction per shipped unit (used as priorityScore by the rationing baselines). */
function shortfallReductionPerUnit(econ) {
  return econ.q > 0 ? econ.deltaShortfall / econ.q : 0;
}

function fixedAllocation(ctx, params) {
  const lines = buildLines(ctx, { adaptiveForecast: false, useCurrentFactors: false });
  const out = [];
  for (const l of lines) {
    if (ctx.day % params.reviewPeriodDays !== l.pharmacyIndex % params.reviewPeriodDays) continue;
    const coverDays = l.lead + params.reviewPeriodDays + params.safetyDays;
    const target = Math.ceil(l.prior * coverDays);
    const qty = Math.max(0, Math.ceil(target - l.ip));
    if (qty <= 0) continue;
    const econ = lineEconomics(l, qty, false);
    out.push(candidate(l, qty, {
      expectedBenefit: econ.benefit,
      marginalCost: econ.cost,
      priorityScore: shortfallReductionPerUnit(econ),
      target,
      priorityReason: `fixed-allocation: review day, IP ${l.ip.toFixed(1)} < static target ${target} (prior × (L ${l.lead} + R ${params.reviewPeriodDays} + safety ${params.safetyDays})d)`,
    }));
  }
  return { candidates: out };
}

/** (s, Q) parameters for a line; params.perLine['drugId|regionType'] overrides the uniform z/qScale. */
function reorderPointParams(line, params) {
  const own = params.perLine?.[`${line.drugId}|${line.regionType}`];
  const z = own?.z ?? params.z;
  const qScale = own?.qScale ?? params.qScale;
  const L = line.lead + 1;
  const s = line.mu * L + z * line.sigma * Math.sqrt(L);
  const eoqUnits = Math.sqrt((2 * Math.max(line.mu, 0.1) * line.orderCost) / Math.max(line.holding, 1e-4));
  const Q = Math.max(1, Math.round(qScale * eoqUnits));
  return { s, Q, z, qScale };
}

function reorderPoint(ctx, params) {
  const lines = buildLines(ctx, { adaptiveForecast: true, useCurrentFactors: false });
  const out = [];
  for (const l of lines) {
    const { s, Q, z, qScale } = reorderPointParams(l, params);
    if (l.ip > s) continue;
    const n = Math.max(1, Math.ceil((s - l.ip) / Q));
    const qty = n * Q;
    const econ = lineEconomics(l, qty, false);
    out.push(candidate(l, qty, {
      expectedBenefit: econ.benefit,
      marginalCost: econ.cost,
      priorityScore: shortfallReductionPerUnit(econ),
      reorderPoint: s,
      batchQ: Q,
      priorityReason: `tuned-sQ: IP ${l.ip.toFixed(1)} ≤ s ${s.toFixed(1)} (z ${z}, qScale ${qScale}) → ${n}×Q(${Q})`,
    }));
  }
  return { candidates: out };
}

function costFirst(ctx) {
  const lines = buildLines(ctx, { adaptiveForecast: true, useCurrentFactors: true });
  const out = [];
  for (const l of lines) {
    const z = newsvendorZ(l);
    if (z == null) continue;
    const qty = batchOrderQty(l, l.muTau + z * l.sigmaTau, l.cycleQ);
    if (qty <= 0) continue;
    const econ = lineEconomics(l, qty, false);
    out.push(candidate(l, qty, {
      expectedBenefit: econ.net,
      marginalBenefit: econ.benefit,
      marginalCost: econ.cost,
      netBenefit: econ.net,
      priorityScore: econ.netPerUnit,
      priorityReason: `cost-only: expected net benefit ${econ.net.toFixed(1)} = benefit ${econ.benefit.toFixed(1)} − cost ${econ.cost.toFixed(1)}`,
    }));
  }
  return { candidates: out };
}

function equityAware(ctx, params) {
  const { scenario } = ctx.instance;
  const lines = buildLines(ctx, { adaptiveForecast: true, useCurrentFactors: true });
  const w = { ...EQUITY_AWARE_WEIGHTS, ...(scenario.policyWeights?.equityAware || {}) };
  const vulnerability = {};
  for (const ph of ctx.instance.pharmacies) vulnerability[ph.regionType] = ph.vulnerabilityWeight ?? 1;
  const need = computeRegionalNeed(ctx.regionalStats || {}, vulnerability);
  const out = [];
  for (const l of lines) {
    const qty = batchOrderQty(l, l.muTau + params.z * l.sigmaTau, l.cycleQ);
    if (qty <= 0) continue;
    const econ = lineEconomics(l, qty, false);
    const needScore = need[l.regionType]?.needScore ?? 0;
    const base = w.stockout * l.pw * econ.deltaShortfall;
    const equityBonus = base * w.inequity * needScore;
    const score = base + equityBonus
      + w.wait * l.v * l.backlog
      - w.cost * econ.cost;
    out.push(candidate(l, qty, {
      expectedBenefit: econ.benefit,
      marginalCost: econ.cost,
      priorityScore: score,
      needScore,
      equityBonus,
      priorityReason: `weighted-equity: score ${score.toFixed(2)} = shortfall term ${base.toFixed(2)} × (1 + ${w.inequity}·needScore ${needScore.toFixed(3)}) + backlog − cost`,
    }));
  }
  return { candidates: out };
}

function errraPolicy(ctx, params) {
  const { instance, warehouseStates } = ctx;
  const lines = buildLines(ctx, {
    adaptiveForecast: params.useRollingHorizon,
    useCurrentFactors: params.useCompoundAwareness,
    bufferDays: params.useCompoundAwareness ? params.disruptionBufferDays : 0,
    surgeRatio: params.useCompoundAwareness ? params.surgeDetectionRatio : Infinity,
  });

  for (const l of lines) {
    l.avail = Math.max(0, l.onHand + l.onOrder);
    l.need = l.muTau + params.projectionZ * l.sigmaTau + l.backlog;
    const z = newsvendorZ(l);
    l.stage2Target = z == null ? 0 : batchOrderQty(l, l.muTau + z * l.sigmaTau, l.cycleQ);
    l.evaluate = (qTotal, qAlready) => {
      const total = lineEconomics(l, qTotal, false);
      const prior = lineEconomics(l, qAlready, false);
      const net = total.net - prior.net;
      const q = qTotal - qAlready;
      return { net, netPerUnit: q > 0 ? net / q : 0 };
    };
  }

  const capRemaining = {};
  const stockRemaining = {};
  for (const wh of instance.warehouses) {
    const { dailyDispatchCap } = effectiveDispatchCap(wh);
    capRemaining[wh.id] = Math.floor(Math.min(dailyDispatchCap, wh.truckCapacityUnits ?? Infinity));
    const ws = warehouseStates.find((w) => w.id === wh.id);
    stockRemaining[wh.id] = { ...(ws?.onHand || {}) };
  }

  const plan = planErrra({ lines, capRemaining, stockRemaining, params });
  const lineByKey = new Map(lines.map((l) => [l.key, l]));
  const out = [];
  for (const key of plan.rankOrder) {
    const qty = plan.alloc.get(key) || 0;
    if (qty <= 0) continue;
    const l = lineByKey.get(key);
    const econ = lineEconomics(l, qty, false);
    out.push(candidate(l, qty, {
      expectedBenefit: econ.benefit,
      marginalCost: econ.cost,
      netBenefit: econ.net,
      priorityScore: plan.scores.get(key),
      priorityReason: plan.reasons.get(key),
    }));
  }
  for (const d of plan.decisions) {
    if (plan.alloc.get(d.key)) continue;
    const l = lineByKey.get(d.key);
    out.push(candidate(l, 0, {
      expectedBenefit: d.net ?? 0,
      priorityScore: null,
      notSelectedReason: d.notSelectedReason,
      priorityReason: `ERRRA: not selected (${d.notSelectedReason})`,
    }));
  }
  return { candidates: out, diagnostics: plan.diagnostics };
}

/** Unified selection gate; returns null when selected, otherwise the rejection reason. */
function gateReason(c, params, whById, whStateById) {
  if (c.notSelectedReason) return c.notSelectedReason;
  if (!(c.qty > 0)) return 'zero_request';
  if (!(c.expectedBenefit > 0)) return 'no_expected_benefit';
  if (!(Number.isFinite(c.priorityScore) && c.priorityScore > params.minPriorityScore)) return 'score_below_threshold';
  const wh = whById[c.warehouseId];
  if (!wh) return 'no_serving_warehouse';
  if ((whStateById[c.warehouseId]?.onHand?.[c.drugId] ?? 0) <= 0) return 'warehouse_out_of_stock';
  if (effectiveDispatchCap(wh).dailyDispatchCap <= 0 || (wh.truckCapacityUnits ?? 1) <= 0) return 'no_transport_capacity';
  return null;
}

/**
 * @returns {{ orders: Array, decisions: Array, diagnostics: Object|null }}
 */
function decideReplenishment(ctx) {
  const canonical = resolvePolicyId(ctx.policyId);
  const params = resolveParams(canonical, ctx.instance.scenario, ctx.policyParams);
  const rationing = getPolicy(canonical)?.rationing || 'rank';
  let result;
  if (canonical === 'fixed-allocation') result = fixedAllocation(ctx, params);
  else if (canonical === 'reorder-point') result = reorderPoint(ctx, params);
  else if (canonical === 'cost-first') result = costFirst(ctx, params);
  else if (canonical === 'equity-aware') result = equityAware(ctx, params);
  else if (isErrraFamily(canonical)) result = errraPolicy(ctx, params);
  else throw new Error(`Unknown policy: ${ctx.policyId}`);

  const whById = Object.fromEntries(ctx.instance.warehouses.map((w) => [w.id, w]));
  const whStateById = Object.fromEntries((ctx.warehouseStates || []).map((w) => [w.id, w]));

  const decisions = result.candidates.map(({ line: _line, ...c }) => {
    const reason = gateReason(c, params, whById, whStateById);
    return {
      ...c,
      policyId: canonical,
      policyScore: c.priorityScore,
      selected: reason == null,
      notSelectedReason: reason,
    };
  });
  const selected = decisions
    .filter((d) => d.selected)
    .sort((a, b) => b.priorityScore - a.priorityScore || tieBreak(a, b));
  selected.forEach((d, i) => { d.policyRank = i; });
  for (const d of decisions) if (!d.selected) d.policyRank = null;

  const orders = selected.map((d) => ({
    pharmacyId: d.pharmacyId,
    warehouseId: d.warehouseId,
    drugId: d.drugId,
    regionType: d.regionType,
    priority: d.priority,
    qty: d.qty,
    requestQty: d.qty,
    priorityScore: d.priorityScore,
    policyScore: d.priorityScore,
    policyRank: d.policyRank,
    rationing,
    priorityReason: d.priorityReason,
    allocationReason: d.priorityReason,
  }));
  return { orders, decisions, diagnostics: result.diagnostics || null };
}

module.exports = {
  POLICIES,
  ABLATION_POLICIES,
  ABLATIONS,
  ERRRA_DEFAULTS,
  EQUITY_AWARE_WEIGHTS,
  POLICY_ALIASES,
  resolvePolicyId,
  resolveParams,
  listPolicies,
  listAblations,
  getPolicy,
  decideReplenishment,
  buildLines,
  lineEconomics,
  newsvendorZ,
  reorderPointParams,
  isErrraFamily,
};
