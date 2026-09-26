/**
 * Replenishment policies. All reorder quantities are computed from the inventory position
 *   IP = onHand + onOrder − backlog
 * and are non-negative integers. Every emitted order carries policyScore, policyRank
 * (0 = served first under supply and truck caps) and allocationReason.
 */

const { PRIORITY_WEIGHT } = require('./simulationConstants');
const {
  transportCostPerUnit,
  computeTransitDays,
  arrivalLagDays,
  NEUTRAL_FACTORS,
} = require('./distributionEngine');
const { inventoryPosition } = require('./inventoryEngine');
const { forecastFor } = require('./forecastEngine');
const { computeRegionalDeficits } = require('./equitySignals');
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
};

const POLICIES = {
  'fixed-allocation': {
    id: 'fixed-allocation',
    name: 'Fixed allocation baseline',
    version: '3.0.0',
    algorithm: 'Periodic review (review day staggered by pharmacy index mod R) with a static order-up-to target = planning-prior daily demand × (nominal lead L + review period R + safetyDays); qty = max(0, target − IP); ignores observed demand and disruptions; shortages rationed proportionally',
    params: { reviewPeriodDays: 3, safetyDays: 3 },
    rationing: 'proportional',
  },
  'reorder-point': {
    id: 'reorder-point',
    name: 'Tuned reorder point (s, Q) baseline',
    version: '3.0.0',
    algorithm: 's = μL + z·σ·√L (nominal lead time L incl. 1-day review); Q = max(1, round(qScale·√(2·μ·K / h))) (EOQ); when IP ≤ s order n·Q with n = ⌈(s − IP)/Q⌉; z and qScale calibrated on calibration seeds only; shortages rationed proportionally',
    params: { z: 1.65, qScale: 1.0 },
    rationing: 'proportional',
  },
  'cost-first': {
    id: 'cost-first',
    name: 'Cost-first net-benefit heuristic',
    version: '3.0.0',
    algorithm: '(s, S) with cost-derived parameters: s = μτ + z*·σ√τ, z* = Φ⁻¹((p − c)/(p + hτ)), S = s + Q_EOQ; line selected only if expected avoided stockout penalty − (procurement + transport + fixed order + expected holding) > 0; ranked by net benefit per unit',
    params: {},
  },
  'equity-aware': {
    id: 'equity-aware',
    name: 'Weighted equity-aware heuristic',
    version: '3.0.0',
    algorithm: '(s, S) with s = μτ + z·σ√τ, S = s + Q_EOQ; ranked by weighted score = w_s·pw·ΔE[shortfall] + w_w·v·backlog + w_e·100·v·deficit_r − w_c·cost, where deficit_r ≥ 0 measures regional under-service; not a global optimizer',
    params: { z: 1.65 },
  },
  'equity-constrained-rolling-horizon': {
    id: 'equity-constrained-rolling-horizon',
    name: 'Equity-constrained Resilient Rolling-horizon Allocation (ERRRA heuristic)',
    shortName: 'ERRRA',
    version: '1.0.0',
    algorithm: 'Daily two-stage lexicographic heuristic: (1) water-filling max–min of projected regional essential service up to floor φ under warehouse capacity and stock; (2) cost-aware net-benefit additions by priority tier subject to regional gap ≤ δ (no leveling down)',
    params: { ...ERRRA_DEFAULTS },
  },
};

const ABLATIONS = {
  'errra-no-floor': { useServiceFloor: false, label: 'ERRRA − minimum service floor' },
  'errra-no-vulnerability': { useVulnerability: false, label: 'ERRRA − vulnerability weights' },
  'errra-no-rolling': { useRollingHorizon: false, label: 'ERRRA − rolling-horizon adaptation' },
  'errra-no-essential-priority': { useEssentialPriority: false, label: 'ERRRA − essential-medicine priority' },
  'errra-no-compound-awareness': { useCompoundAwareness: false, label: 'ERRRA − compound disruption awareness' },
};

const ABLATION_POLICIES = Object.fromEntries(Object.entries(ABLATIONS).map(([id, a]) => {
  const { label, ...flags } = a;
  return [id, {
    id,
    name: label,
    version: POLICIES['equity-constrained-rolling-horizon'].version,
    algorithm: `Ablation of ERRRA heuristic: ${Object.keys(flags).join(', ')} = false`,
    params: { ...ERRRA_DEFAULTS, ...flags },
    ablationOf: 'equity-constrained-rolling-horizon',
  }];
}));

const POLICY_ALIASES = {
  'fixed-allocation-v1': 'fixed-allocation',
  'reorder-point-v1': 'reorder-point',
  'cost-first-v1': 'cost-first',
  'equity-aware-v1': 'equity-aware',
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
  const policy = getPolicy(policyId);
  return {
    ...(policy?.params || {}),
    ...(scenario?.policyParams?.[policyId] || {}),
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
 * with Q = min(√(2μK/h), μ·maxCycleDays) (maxCycleDays = 30 by default).
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

/** (s, S) order quantity: when IP ≤ s order up to s + Q, Q = line.cycleQ = √(2μK/h). */
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
      (eventFactors.supply[rt] ?? 1) < 1 || (eventFactors.transit[rt] ?? 1) > 1 || (eventFactors.lead[rt] ?? 1) > 1
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
    ...extra,
  };
}

function stableBaselineOrder(a, b) {
  return a.pharmacyIndex - b.pharmacyIndex || a.drugIndex - b.drugIndex;
}

function fixedAllocation(ctx, params) {
  const lines = buildLines(ctx, { adaptiveForecast: false, useCurrentFactors: false });
  const out = [];
  for (const l of [...lines].sort(stableBaselineOrder)) {
    if (ctx.day % params.reviewPeriodDays !== l.pharmacyIndex % params.reviewPeriodDays) continue;
    const coverDays = l.lead + params.reviewPeriodDays + params.safetyDays;
    const target = Math.ceil(l.prior * coverDays);
    const qty = Math.max(0, Math.ceil(target - l.ip));
    if (qty <= 0) continue;
    out.push(candidate(l, qty, {
      selected: true,
      policyScore: 0,
      target,
      allocationReason: `fixed-allocation: order-up-to target ${target} (prior × (L ${l.lead} + R ${params.reviewPeriodDays} + safety ${params.safetyDays})d) on review day`,
    }));
  }
  return { candidates: out };
}

function reorderPointParams(line, params) {
  const L = line.lead + 1;
  const s = line.mu * L + params.z * line.sigma * Math.sqrt(L);
  const eoqUnits = Math.sqrt((2 * Math.max(line.mu, 0.1) * line.orderCost) / Math.max(line.holding, 1e-4));
  const Q = Math.max(1, Math.round(params.qScale * eoqUnits));
  return { s, Q };
}

function reorderPoint(ctx, params) {
  const lines = buildLines(ctx, { adaptiveForecast: true, useCurrentFactors: false });
  const out = [];
  for (const l of [...lines].sort(stableBaselineOrder)) {
    const { s, Q } = reorderPointParams(l, params);
    if (l.ip > s) continue;
    const n = Math.max(1, Math.ceil((s - l.ip) / Q));
    const qty = n * Q;
    out.push(candidate(l, qty, {
      selected: true,
      policyScore: 0,
      reorderPoint: s,
      batchQ: Q,
      allocationReason: `reorder-point: IP ${l.ip.toFixed(1)} ≤ s ${s.toFixed(1)} → ${n}×Q(${Q})`,
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
    const selected = econ.net > 0;
    out.push(candidate(l, qty, {
      selected,
      policyScore: econ.netPerUnit,
      marginalBenefit: econ.benefit,
      marginalCost: econ.cost,
      netBenefit: econ.net,
      notSelectedReason: selected ? null : 'negative_net_benefit',
      allocationReason: selected
        ? `cost-first: net benefit ${econ.net.toFixed(1)} (benefit ${econ.benefit.toFixed(1)} − cost ${econ.cost.toFixed(1)})`
        : `cost-first: rejected, net benefit ${econ.net.toFixed(1)} ≤ 0`,
    }));
  }
  out.sort((a, b) => b.policyScore - a.policyScore);
  return { candidates: out };
}

function equityAware(ctx, params) {
  const { scenario } = ctx.instance;
  const lines = buildLines(ctx, { adaptiveForecast: true, useCurrentFactors: true });
  const w = scenario.policyWeights?.equityAware ?? { stockout: 1, wait: 0.5, inequity: 1, cost: 0.01 };
  const deficits = computeRegionalDeficits(ctx.regionalStats || {}, {
    maxWaitDays: scenario.metricsWeights?.maxRelevantWaitDays ?? 30,
  });
  const out = [];
  for (const l of lines) {
    const qty = batchOrderQty(l, l.muTau + params.z * l.sigmaTau, l.cycleQ);
    if (qty <= 0) continue;
    const econ = lineEconomics(l, qty, false);
    const deficit = deficits[l.regionType]?.deficit ?? 0;
    const equityBonus = deficit > 0 ? w.inequity * 100 * l.v * deficit : 0;
    const score = w.stockout * l.pw * econ.deltaShortfall
      + w.wait * l.v * l.backlog
      + equityBonus
      - w.cost * econ.cost;
    out.push(candidate(l, qty, {
      selected: true,
      policyScore: score,
      regionalDeficit: deficit,
      equityBonus,
      marginalCost: econ.cost,
      allocationReason: `equity-aware: score ${score.toFixed(2)} (equity bonus ${equityBonus.toFixed(2)}, regional deficit ${deficit.toFixed(3)})`,
    }));
  }
  out.sort((a, b) => b.policyScore - a.policyScore);
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
  const neutral = { supply: { urban: 1, suburban: 1, rural: 1 } };
  for (const wh of instance.warehouses) {
    const { dailyDispatchCap } = effectiveDispatchCap(
      wh,
      instance.pharmacies,
      params.useCompoundAwareness ? ctx.eventFactors : neutral,
    );
    capRemaining[wh.id] = Math.floor(Math.min(dailyDispatchCap, wh.truckCapacityUnits ?? Infinity));
    const ws = warehouseStates.find((w) => w.id === wh.id);
    stockRemaining[wh.id] = { ...(ws?.onHand || {}) };
  }

  const plan = planErrra({ lines, capRemaining, stockRemaining, params });
  const lineByKey = new Map(lines.map((l) => [l.key, l]));
  const out = [];
  plan.rankOrder.forEach((key) => {
    const qty = plan.alloc.get(key) || 0;
    if (qty <= 0) return;
    const l = lineByKey.get(key);
    const econ = lineEconomics(l, qty, false);
    out.push(candidate(l, qty, {
      selected: true,
      policyScore: econ.netPerUnit,
      marginalCost: econ.cost,
      netBenefit: econ.net,
      allocationReason: plan.reasons.get(key),
    }));
  });
  for (const d of plan.decisions) {
    if (plan.alloc.get(d.key)) continue;
    const l = lineByKey.get(d.key);
    out.push(candidate(l, 0, {
      selected: false,
      policyScore: d.net ?? null,
      notSelectedReason: d.notSelectedReason,
      allocationReason: `ERRRA: not selected (${d.notSelectedReason})`,
    }));
  }
  return { candidates: out, diagnostics: plan.diagnostics };
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

  const decisions = [];
  const orders = [];
  let rank = 0;
  for (const rest of result.candidates) {
    const selected = rest.selected && rest.qty > 0;
    const decision = {
      ...rest,
      policyId: canonical,
      selected,
      policyRank: selected ? rank : null,
      notSelectedReason: selected ? null : (rest.notSelectedReason || 'zero_request'),
    };
    decisions.push(decision);
    if (selected) {
      orders.push({
        pharmacyId: rest.pharmacyId,
        warehouseId: rest.warehouseId,
        drugId: rest.drugId,
        regionType: rest.regionType,
        priority: rest.priority,
        qty: rest.qty,
        requestQty: rest.qty,
        policyScore: rest.policyScore,
        policyRank: rank,
        rationing,
        allocationReason: rest.allocationReason,
      });
      rank += 1;
    }
  }
  return { orders, decisions, diagnostics: result.diagnostics || null };
}

module.exports = {
  POLICIES,
  ABLATION_POLICIES,
  ERRRA_DEFAULTS,
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
