/**
 * Warehouse-scoped daily truck capacity (simplified: one dispatch wave per warehouse per day).
 */

const { receiveShipment, serveBacklog } = require('./inventoryEngine');

const NEUTRAL_FACTORS = {
  demand: { urban: 1, suburban: 1, rural: 1 },
  supply: { urban: 1, suburban: 1, rural: 1 },
  transit: { urban: 1, suburban: 1, rural: 1 },
  lead: { urban: 1, suburban: 1, rural: 1 },
};

function computeTransitDays(pharmacy, region, drug, plan, scenario) {
  const factors = plan?.eventFactors || NEUTRAL_FACTORS;
  const reg = scenario.regions[pharmacy.regionType];
  const distanceFactor = 1 + (reg.distanceKm ?? 10) / 100;
  const roadFactor = 1 / Math.max(0.1, reg.roadAccessibility ?? 1);
  const lead = (drug.leadTimeDays ?? 2) * (factors.lead[pharmacy.regionType] ?? 1);
  const base = pharmacy.transitDaysBase * (factors.transit[pharmacy.regionType] ?? 1);
  return Math.max(1, (base + lead * 0.25) * distanceFactor * roadFactor);
}

/** Whole days until a shipment dispatched today is on the shelf. */
function arrivalLagDays(transitDays) {
  return Math.max(1, Math.ceil(transitDays));
}

function transportCostPerUnit(pharmacy, scenario) {
  const reg = scenario.regions[pharmacy.regionType];
  const base = scenario.logistics?.transportCostPerUnit ?? 0.15;
  const dist = (reg.distanceKm ?? 10) / 50;
  const road = 1 / Math.max(0.1, reg.roadAccessibility ?? 1);
  return base * dist * road;
}

function scheduleShipment({ pharmacy, drugId, qty, currentDay, transitDays, inTransit }) {
  const arriveDay = currentDay + arrivalLagDays(transitDays);
  inTransit.push({
    arriveDay,
    pharmacyId: pharmacy.id,
    drugId,
    qty,
    transitDays,
    regionType: pharmacy.regionType,
  });
}

function processArrivals(currentDay, inTransit, pharmacyStates) {
  const arriving = inTransit.filter((s) => s.arriveDay <= currentDay);
  const remaining = inTransit.filter((s) => s.arriveDay > currentDay);
  for (const s of arriving) {
    const ph = pharmacyStates.find((p) => p.id === s.pharmacyId);
    if (ph) {
      receiveShipment(ph, s.drugId, s.qty);
      serveBacklog(ph, s.drugId);
    }
  }
  return remaining;
}

/** Orders are processed in the policy's own rank order (policyRank ascending, 0 = first). */
function sortByPolicyRank(orders) {
  return [...orders].sort((a, b) => (a.policyRank ?? Infinity) - (b.policyRank ?? Infinity));
}

/**
 * Integer proportional rationing: x_i = ⌊q_i·T/Σq⌋ plus largest remainders (ties by list order),
 * so Σx = min(T, Σq) and 0 ≤ x_i ≤ q_i.
 */
function proportionalShares(qtys, total) {
  const sum = qtys.reduce((s, q) => s + q, 0);
  const T = Math.max(0, Math.min(Math.floor(total), sum));
  if (sum <= 0) return qtys.map(() => 0);
  if (T >= sum) return [...qtys];
  const raw = qtys.map((q) => (q * T) / sum);
  const out = raw.map(Math.floor);
  let left = T - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    if (out[i] < qtys[i]) { out[i] += 1; left -= 1; }
  }
  return out;
}

/** Baselines without a priority score ration shortages proportionally instead of by list order. */
function isProportional(orders) {
  return orders.length > 0 && orders.every((o) => o.rationing === 'proportional');
}

function allocateTruckCapacityByWarehouse(orders, warehouses) {
  const whCap = Object.fromEntries(
    warehouses.map((w) => [w.id, w.truckCapacityUnits ?? 2000]),
  );
  const byWh = {};
  for (const o of orders) {
    if (!byWh[o.warehouseId]) byWh[o.warehouseId] = [];
    byWh[o.warehouseId].push(o);
  }

  const accepted = [];
  const deferred = [];
  const allocationLog = [];

  for (const [whId, whOrders] of Object.entries(byWh)) {
    const sorted = sortByPolicyRank(whOrders);
    let used = 0;
    const cap = whCap[whId] ?? 2000;
    const proportional = isProportional(sorted);
    const shares = proportional ? proportionalShares(sorted.map((o) => o.qty), cap) : null;
    const log = {
      warehouseId: whId,
      capacityUnits: cap,
      sortRule: proportional ? 'proportional' : 'policyRank',
      accepted: 0,
      deferredUnits: 0,
    };

    sorted.forEach((o, idx) => {
      const room = Math.max(0, cap - used);
      const take = proportional ? shares[idx] : Math.min(o.qty, room);
      if (take > 0) {
        accepted.push({ ...o, qty: take, postTruckRank: idx });
        used += take;
        log.accepted += take;
      }
      if (take < o.qty) {
        deferred.push({ ...o, qty: o.qty - take, reason: 'truck_capacity' });
        log.deferredUnits += o.qty - take;
      }
    });
    allocationLog.push(log);
  }

  return { accepted, deferred, allocationLog };
}

module.exports = {
  NEUTRAL_FACTORS,
  scheduleShipment,
  processArrivals,
  allocateTruckCapacityByWarehouse,
  computeTransitDays,
  arrivalLagDays,
  transportCostPerUnit,
  sortByPolicyRank,
  proportionalShares,
  isProportional,
};
