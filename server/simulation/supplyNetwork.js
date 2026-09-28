/**
 * Upstream supply network: suppliers → warehouses (synthetic).
 *
 * Each supplier s has { id, warehouseId, tier ('primary' | 'backup'), replenishmentLeadTime (days),
 * dailyCapacity (standard units per day, all SKUs together), reliability (probability that the
 * supplier ships on a given day), unitCost (cost per standard unit shipped) }.
 * Its disruption state on day t follows from the active supplyDisruption events that target it:
 *   f_s(t) = Π magnitude of active events targeting s;   state = normal (f=1) | degraded (0<f<1) | down (f=0).
 * Capacity available on day t:  A_s(t) = ⌊dailyCapacity_s · f_s(t)⌋ · B_s(t),  B_s(t) ~ Bernoulli(reliability_s),
 * with B drawn from a dedicated seeded stream before the run (common random numbers across policies).
 *
 * Warehouse w reorders upstream every day with a base-stock rule on its own position:
 *   target_wk = targetStockDays · Σ_{i served by w} d̄_ik
 *   order_wk  = max(0, target_wk − onHand_wk − upstreamPipeline_wk),
 * reduced proportionally so that Σ_k (onHand + pipeline + order) ≤ capacityInStandardUnits_w.
 * The order is placed with the primary supplier first; with redundancy enabled, any quantity the
 * primary cannot ship today is placed with backup suppliers in ascending unitCost order.
 * Shipments arrive after replenishmentLeadTime days.
 *
 * Supply disruptions act on the targeted suppliers (by supplier id, by warehouse, or on every
 * supplier of a tier); they never reduce warehouse dispatch capacity towards pharmacies.
 */

const { createRng } = require('./rng');
const { isEventActive } = require('./eventUtils');
const { proportionalShares } = require('./distributionEngine');

const DEFAULT_SUPPLY_NETWORK = {
  redundancyEnabled: true,
  primary: { replenishmentLeadTime: 2, capacityCoverage: null, reliability: 0.98, unitCost: 0.5 },
  backup: { replenishmentLeadTime: 5, capacityCoverage: 0.4, reliability: 0.9, unitCost: 1.2 },
};

const SUPPLIER_RNG_SALT = 'supplier-reliability';

/** Build suppliers for every warehouse from explicit scenario.supplyNetwork.suppliers or tier defaults. */
function buildSuppliers(scenario, warehouses, servedDemandByWarehouse) {
  const cfg = { ...DEFAULT_SUPPLY_NETWORK, ...(scenario.supplyNetwork || {}) };
  const primaryCoverage = cfg.primary?.capacityCoverage ?? scenario.logistics?.upstreamInboundCoverage ?? 1.2;
  if (Array.isArray(cfg.suppliers) && cfg.suppliers.length) {
    return cfg.suppliers.map((s) => ({
      tier: 'primary',
      reliability: 1,
      unitCost: 0,
      replenishmentLeadTime: 1,
      disruptionState: 'normal',
      ...s,
      dailyCapacity: Math.max(0, Math.round(s.dailyCapacity ?? 0)),
    }));
  }
  const out = [];
  for (const wh of warehouses) {
    const served = servedDemandByWarehouse[wh.id] || 0;
    out.push({
      id: `SUP-${wh.id}-P`,
      warehouseId: wh.id,
      tier: 'primary',
      replenishmentLeadTime: cfg.primary.replenishmentLeadTime,
      dailyCapacity: Math.round(served * primaryCoverage),
      reliability: cfg.primary.reliability,
      unitCost: cfg.primary.unitCost,
      disruptionState: 'normal',
    });
    if (cfg.backup && (cfg.backup.capacityCoverage ?? 0) > 0) {
      out.push({
        id: `SUP-${wh.id}-B`,
        warehouseId: wh.id,
        tier: 'backup',
        replenishmentLeadTime: cfg.backup.replenishmentLeadTime,
        dailyCapacity: Math.round(served * cfg.backup.capacityCoverage),
        reliability: cfg.backup.reliability,
        unitCost: cfg.backup.unitCost,
        disruptionState: 'normal',
      });
    }
  }
  return out;
}

/** Does a supplyDisruption event apply to supplier s? */
function eventTargetsSupplier(ev, s) {
  if (ev.targetSuppliers?.length) return ev.targetSuppliers.includes(s.id);
  const tier = ev.supplierTier || 'primary';
  if (tier !== 'all' && s.tier !== tier) return false;
  if (ev.targetWarehouses?.length) return ev.targetWarehouses.includes(s.warehouseId);
  return true;
}

function supplierFactor(scenario, s, day) {
  let f = 1;
  for (const ev of scenario.events || []) {
    if (ev.type !== 'supplyDisruption' || !isEventActive(ev, day)) continue;
    if (eventTargetsSupplier(ev, s)) f *= ev.magnitude;
  }
  return Math.max(0, f);
}

function disruptionStateOf(f) {
  if (f >= 1 - 1e-12) return 'normal';
  if (f <= 1e-12) return 'down';
  return 'degraded';
}

/** Pre-draw reliability outcomes B_s(t) for the whole horizon (independent of policy). */
function drawReliability(scenario, suppliers) {
  const rng = createRng(`${scenario.randomSeed}:${SUPPLIER_RNG_SALT}`);
  const draws = [];
  for (let day = 0; day < scenario.simulationDays; day += 1) {
    const row = {};
    for (const s of suppliers) row[s.id] = rng.next() < (s.reliability ?? 1) ? 1 : 0;
    draws.push(row);
  }
  return draws;
}

/** Per-day supplier availability and the observable per-warehouse upstream disruption factor. */
function supplierDayStatus(scenario, suppliers, reliabilityDraws, day) {
  const status = {};
  const warehouseFactor = {};
  for (const s of suppliers) {
    const f = supplierFactor(scenario, s, day);
    status[s.id] = {
      factor: f,
      state: disruptionStateOf(f),
      shipsToday: reliabilityDraws[day]?.[s.id] ?? 1,
      available: Math.floor(s.dailyCapacity * f) * (reliabilityDraws[day]?.[s.id] ?? 1),
    };
    if (s.tier === 'primary') {
      warehouseFactor[s.warehouseId] = Math.min(warehouseFactor[s.warehouseId] ?? 1, f);
    }
  }
  return { status, warehouseFactor };
}

function initSupplyState(suppliers) {
  return {
    pipeline: [],
    shippedBySupplier: Object.fromEntries(suppliers.map((s) => [s.id, 0])),
    daysByState: Object.fromEntries(suppliers.map((s) => [s.id, { normal: 0, degraded: 0, down: 0 }])),
  };
}

/** Receive upstream shipments due on `day`; returns received units by warehouse and SKU. */
function receiveUpstream(supplyState, day) {
  const due = supplyState.pipeline.filter((x) => x.arriveDay <= day);
  supplyState.pipeline = supplyState.pipeline.filter((x) => x.arriveDay > day);
  return due;
}

/**
 * Place today's upstream orders.
 * @returns {{ shipments: Array<{supplierId, warehouseId, drugId, qty, arriveDay, unitCost}>, log: Array }}
 */
function placeUpstreamOrders({
  day, warehouses, warehouseStates, suppliers, supplyState, dayStatus, drugs, redundancyEnabled,
}) {
  const shipments = [];
  const log = [];
  for (const wh of warehouses) {
    const ws = warehouseStates.find((w) => w.id === wh.id);
    const pipelineBy = {};
    for (const p of supplyState.pipeline) {
      if (p.warehouseId === wh.id) pipelineBy[p.drugId] = (pipelineBy[p.drugId] || 0) + p.qty;
    }
    const requests = drugs.map((d) => Math.max(0, Math.ceil(
      (wh.targetStock[d.id] || 0) - (ws.onHand[d.id] || 0) - (pipelineBy[d.id] || 0),
    )));
    const occupied = drugs.reduce((s, d) => s + (ws.onHand[d.id] || 0) + (pipelineBy[d.id] || 0), 0);
    const room = Math.max(0, Math.floor((wh.capacityInStandardUnits ?? Infinity) - occupied));
    let open = proportionalShares(requests, Math.min(room, requests.reduce((a, b) => a + b, 0)));
    const requestedTotal = open.reduce((a, b) => a + b, 0);
    const capacityLimited = requests.reduce((a, b) => a + b, 0) - requestedTotal;

    const mine = suppliers
      .filter((s) => s.warehouseId === wh.id && (redundancyEnabled || s.tier === 'primary'))
      .sort((a, b) => (a.tier === 'primary' ? 0 : 1) - (b.tier === 'primary' ? 0 : 1) || a.unitCost - b.unitCost || a.id.localeCompare(b.id));
    const bySupplier = {};
    for (const s of mine) {
      const st = dayStatus.status[s.id];
      const openTotal = open.reduce((a, b) => a + b, 0);
      if (openTotal <= 0 || !st || st.available <= 0) { bySupplier[s.id] = 0; continue; }
      const take = proportionalShares(open, st.available);
      let shipped = 0;
      drugs.forEach((d, k) => {
        if (take[k] <= 0) return;
        shipments.push({
          supplierId: s.id,
          warehouseId: wh.id,
          drugId: d.id,
          qty: take[k],
          arriveDay: day + Math.max(1, s.replenishmentLeadTime),
          unitCost: s.unitCost,
          tier: s.tier,
        });
        shipped += take[k];
      });
      open = open.map((q, k) => q - take[k]);
      bySupplier[s.id] = shipped;
      supplyState.shippedBySupplier[s.id] += shipped;
    }
    log.push({
      warehouseId: wh.id,
      requested: requestedTotal,
      refusedByWarehouseCapacity: capacityLimited,
      unplaced: open.reduce((a, b) => a + b, 0),
      bySupplier,
    });
  }
  for (const s of suppliers) supplyState.daysByState[s.id][dayStatus.status[s.id].state] += 1;
  supplyState.pipeline.push(...shipments);
  return { shipments, log };
}

module.exports = {
  DEFAULT_SUPPLY_NETWORK,
  buildSuppliers,
  eventTargetsSupplier,
  supplierFactor,
  disruptionStateOf,
  drawReliability,
  supplierDayStatus,
  initSupplyState,
  receiveUpstream,
  placeUpstreamOrders,
};
