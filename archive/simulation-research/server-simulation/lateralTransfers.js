/**
 * Emergency lateral transfers between pharmacies within the same synthetic regional stratum, essential SKUs only.
 *
 * Run once per day after demand has been served and forecasts updated, before replenishment
 * decisions (so policies see transfers in IP). For pharmacy i and SKU k:
 *   L_i   = whole-day warehouse arrival lag, τ_i = L_i + 1 (days until warehouse stock could arrive)
 *   μ_i, σ_i = history-only EWMA forecast;   D_i(τ) ~ N(μ_i τ, σ_i² τ)
 *   ES_i(x) = E[(D_i(τ_i) − x)⁺]                         (expected unmet units over τ_i)
 *   recipient trigger:  IP_i < μ_i τ_i                     (expected to run short before a warehouse delivery)
 *   donor safety stock: SS_j = μ_j τ_j + z σ_j √τ_j        (donor may give only onHand_j − SS_j, and only with no backlog)
 * A transfer of q units from j to i is executed only if
 *   ΔU = [ES_i(IP_i) − ES_i(IP_i + q)] − [ES_j(IP_j − q) − ES_j(IP_j)] > 0       (system unmet demand falls)
 *   p_k · ΔU − (c_transfer · q + K_transfer) > 0                                  (worth its cost)
 * subject to a per-region daily transfer capacity (standard units) and transit time
 *   ⌈transitDays · roadFactor_r⌉ < L_i (otherwise the warehouse is as fast).
 * Anti-cycling: a pharmacy that received SKU k within cooldownDays cannot donate k, one that
 * donated k within cooldownDays cannot receive k, and nobody is donor and recipient on the same day.
 */

const { expectedShortfall } = require('./normalDist');
const { forecastFor } = require('./forecastEngine');
const { computeTransitDays, arrivalLagDays } = require('./distributionEngine');
const { inventoryPosition, transferOut, markShipped } = require('./inventoryEngine');
const { REGION_TYPES } = require('./scenarioSchema');

const DEFAULT_LATERAL = {
  enabled: true,
  essentialOnly: true,
  transitDays: 1,
  costPerUnit: 0.4,
  fixedCost: 10,
  capacityCoverage: 0.25,
  cooldownDays: 7,
  donorSafetyZ: 1.65,
};

function lateralConfig(scenario) {
  return { ...DEFAULT_LATERAL, ...(scenario.logistics?.lateralTransfers || {}) };
}

/** Per-region daily transfer capacity = coverage × Σ planning-prior essential daily demand in the region. */
function regionalTransferCapacity(instance, forecasts, cfg) {
  const cap = {};
  for (const rt of REGION_TYPES) cap[rt] = 0;
  for (const ph of instance.pharmacies) {
    for (const d of instance.drugs) {
      if (cfg.essentialOnly && d.priority !== 'essential') continue;
      cap[ph.regionType] += forecasts[ph.id][d.id].prior;
    }
  }
  for (const rt of REGION_TYPES) cap[rt] = Math.floor(cap[rt] * cfg.capacityCoverage);
  return cap;
}

function lineView(ph, st, drug, instance, forecasts, plan) {
  const { scenario } = instance;
  const fc = forecastFor(forecasts, ph.id, drug.id, true);
  const L = arrivalLagDays(computeTransitDays(ph, scenario.regions[ph.regionType], drug, plan, scenario));
  const tau = L + 1;
  return {
    ph,
    st,
    L,
    tau,
    mu: fc.mean * tau,
    sigma: fc.sigma * Math.sqrt(tau),
    sigmaDaily: fc.sigma,
    muDaily: fc.mean,
    ip: inventoryPosition(st, drug.id),
    onHand: st.onHand[drug.id] || 0,
    backlog: st.backlog[drug.id] || 0,
  };
}

/**
 * @returns {{ transfers: Array, cost: number, log: Object }}
 * Transfers are applied to states immediately and appended to inTransit with kind 'transfer'.
 */
function planLateralTransfers({ day, instance, pharmacyStates, forecasts, plan, inTransit, cfg }) {
  const transfers = [];
  let cost = 0;
  const rejected = { noDonor: 0, notFasterThanWarehouse: 0, noUnmetReduction: 0, notWorthCost: 0, capacity: 0 };
  if (!cfg.enabled) return { transfers, cost, log: { enabled: false, rejected } };
  const { scenario } = instance;
  const capLeft = regionalTransferCapacity(instance, forecasts, cfg);
  const stateById = new Map(pharmacyStates.map((s) => [s.id, s]));
  const drugs = instance.drugs.filter((d) => !cfg.essentialOnly || d.priority === 'essential');
  const penaltyOf = (d) => d.stockoutPenalty ?? scenario.metricsWeights?.stockoutPenaltyByPriority?.[d.priority] ?? 15;

  for (const rt of REGION_TYPES) {
    const members = instance.pharmacies.filter((p) => p.regionType === rt);
    if (members.length < 2) continue;
    const transitFactor = plan?.eventFactors?.transit?.[rt] ?? 1;
    const transferLag = Math.max(1, Math.ceil(cfg.transitDays * transitFactor));
    for (const drug of drugs) {
      const views = members.map((ph) => lineView(ph, stateById.get(ph.id), drug, instance, forecasts, plan));
      const recipients = views
        .filter((v) => v.ip < v.mu && day - (v.st.lastTransferOutDay[drug.id] ?? -Infinity) > cfg.cooldownDays)
        .sort((a, b) => (b.mu - b.ip) - (a.mu - a.ip) || a.ph.index - b.ph.index);
      const recipientIds = new Set(recipients.map((v) => v.ph.id));
      const donorSurplus = (v) => {
        const ss = v.mu + cfg.donorSafetyZ * v.sigma;
        return Math.max(0, Math.floor(v.onHand - ss));
      };
      for (const rec of recipients) {
        if (capLeft[rt] <= 0) { rejected.capacity += 1; break; }
        if (transferLag >= rec.L) { rejected.notFasterThanWarehouse += 1; continue; }
        const donors = views
          .filter((v) => !recipientIds.has(v.ph.id) && v.backlog === 0
            && day - (v.st.lastTransferInDay[drug.id] ?? -Infinity) > cfg.cooldownDays
            && donorSurplus(v) > 0)
          .sort((a, b) => donorSurplus(b) - donorSurplus(a) || a.ph.index - b.ph.index);
        if (!donors.length) { rejected.noDonor += 1; continue; }
        const don = donors[0];
        const need = Math.ceil(rec.mu - rec.ip);
        let executed = false;
        for (const q of [Math.min(need, donorSurplus(don), capLeft[rt])].flatMap((x) => [x, Math.ceil(x / 2)])) {
          if (q <= 0) continue;
          const gainRec = expectedShortfall(rec.ip, rec.mu, rec.sigma) - expectedShortfall(rec.ip + q, rec.mu, rec.sigma);
          const lossDon = expectedShortfall(don.ip - q, don.mu, don.sigma) - expectedShortfall(don.ip, don.mu, don.sigma);
          const dU = gainRec - lossDon;
          const c = cfg.costPerUnit * q + cfg.fixedCost;
          if (dU <= 1e-9) { rejected.noUnmetReduction += 1; continue; }
          if (penaltyOf(drug) * dU - c <= 0) { rejected.notWorthCost += 1; continue; }
          const moved = transferOut(don.st, drug.id, q, day);
          if (moved <= 0) break;
          markShipped(rec.st, drug.id, moved);
          rec.st.transferredIn[drug.id] = (rec.st.transferredIn[drug.id] || 0) + moved;
          rec.st.lastTransferInDay[drug.id] = day;
          inTransit.push({
            kind: 'transfer',
            arriveDay: day + transferLag,
            pharmacyId: rec.ph.id,
            fromPharmacyId: don.ph.id,
            drugId: drug.id,
            qty: moved,
            transitDays: transferLag,
            regionType: rt,
          });
          const tc = cfg.costPerUnit * moved + cfg.fixedCost;
          cost += tc;
          capLeft[rt] -= moved;
          don.onHand -= moved;
          don.ip -= moved;
          transfers.push({
            day,
            fromPharmacyId: don.ph.id,
            toPharmacyId: rec.ph.id,
            regionType: rt,
            drugId: drug.id,
            qty: moved,
            cost: tc,
            expectedUnmetReduction: dU,
            reason: `recipient IP ${rec.ip.toFixed(1)} < horizon demand ${rec.mu.toFixed(1)}; donor surplus above safety stock; expected unmet −${dU.toFixed(2)}`,
          });
          executed = true;
          break;
        }
        if (!executed) continue;
      }
    }
  }
  return { transfers, cost, log: { enabled: true, rejected, units: transfers.reduce((s, t) => s + t.qty, 0) } };
}

module.exports = { DEFAULT_LATERAL, lateralConfig, planLateralTransfers, regionalTransferCapacity };
