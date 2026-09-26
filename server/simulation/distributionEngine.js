/**
 * Warehouse-scoped daily truck capacity (simplified: one dispatch wave per warehouse per day).
 */

function computeTransitDays(pharmacy, region, drug, plan, scenario) {
  const reg = scenario.regions[pharmacy.regionType];
  const distanceFactor = 1 + (reg.distanceKm ?? 10) / 100;
  const roadFactor = 1 / Math.max(0.1, reg.roadAccessibility ?? 1);
  const lead = (drug.leadTimeDays ?? 2) * (plan.eventFactors.lead[pharmacy.regionType] ?? 1);
  const base = pharmacy.transitDaysBase * (plan.eventFactors.transit[pharmacy.regionType] ?? 1);
  return Math.max(1, (base + lead * 0.25) * distanceFactor * roadFactor);
}

function transportCostPerUnit(pharmacy, scenario) {
  const reg = scenario.regions[pharmacy.regionType];
  const base = scenario.logistics?.transportCostPerUnit ?? 0.15;
  const dist = (reg.distanceKm ?? 10) / 50;
  const road = 1 / Math.max(0.1, reg.roadAccessibility ?? 1);
  return base * dist * road;
}

function scheduleShipment({ pharmacy, drugId, qty, currentDay, transitDays, inTransit }) {
  const arriveDay = currentDay + Math.max(1, Math.ceil(transitDays));
  inTransit.push({
    arriveDay,
    pharmacyId: pharmacy.id,
    drugId,
    qty,
    transitDays,
    regionType: pharmacy.regionType,
  });
}

const { serveBacklog } = require('./inventoryEngine');

function processArrivals(currentDay, inTransit, pharmacyStates, drugMeta) {
  const arriving = inTransit.filter((s) => s.arriveDay <= currentDay);
  const remaining = inTransit.filter((s) => s.arriveDay > currentDay);
  for (const s of arriving) {
    const ph = pharmacyStates.find((p) => p.id === s.pharmacyId);
    if (ph) {
      ph.onHand[s.drugId] = (ph.onHand[s.drugId] || 0) + s.qty;
      serveBacklog(ph, s.drugId, drugMeta?.[s.drugId]);
    }
  }
  return remaining;
}

/**
 * Sort orders fairly: higher vulnerability first, then essential priority, then stable id.
 */
function defaultFairSort(orders, phMap, drugMap) {
  return [...orders].sort((a, b) => {
    const pa = phMap[a.pharmacyId];
    const pb = phMap[b.pharmacyId];
    const vuln = (pb?.vulnerabilityWeight ?? 1) - (pa?.vulnerabilityWeight ?? 1);
    if (vuln !== 0) return vuln;
    const pri = { essential: 3, 'chronic-care': 2, routine: 1 };
    const da = drugMap[a.drugId];
    const db = drugMap[b.drugId];
    const pd = (pri[db?.priority] ?? 0) - (pri[da?.priority] ?? 0);
    if (pd !== 0) return pd;
    return String(a.pharmacyId).localeCompare(String(b.pharmacyId));
  });
}

function allocateTruckCapacityByWarehouse(orders, warehouses, phMap, drugMap, sortFn = defaultFairSort) {
  const whCap = Object.fromEntries(
    warehouses.map((w) => [w.id, w.truckCapacityUnits ?? 2000]),
  );
  const byWh = {};
  for (const o of orders) {
    if (!byWh[o.warehouseId]) byWh[o.warehouseId] = [];
    byWh[o.warehouseId].push(o);
  }

  const accepted = [];
  const allocationLog = [];

  for (const [whId, whOrders] of Object.entries(byWh)) {
    const sorted = sortFn(whOrders, phMap, drugMap);
    let used = 0;
    const cap = whCap[whId] ?? 2000;
    const log = { warehouseId: whId, capacityUnits: cap, sortRule: 'vulnerability desc, priority desc, pharmacyId', accepted: [], deferred: [] };

    for (const o of sorted) {
      if (used + o.qty <= cap) {
        accepted.push(o);
        used += o.qty;
        log.accepted.push({ pharmacyId: o.pharmacyId, drugId: o.drugId, qty: o.qty });
      } else {
        const room = cap - used;
        if (room > 0) {
          accepted.push({ ...o, qty: room, deferredQty: o.qty - room });
          log.accepted.push({ pharmacyId: o.pharmacyId, drugId: o.drugId, qty: room, partial: true });
          log.deferred.push({ pharmacyId: o.pharmacyId, drugId: o.drugId, qty: o.qty - room, reason: 'truck_capacity' });
          used = cap;
        } else {
          log.deferred.push({ pharmacyId: o.pharmacyId, drugId: o.drugId, qty: o.qty, reason: 'truck_capacity' });
        }
      }
    }
    allocationLog.push(log);
  }

  return { accepted, allocationLog };
}

module.exports = {
  scheduleShipment,
  processArrivals,
  allocateTruckCapacityByWarehouse,
  computeTransitDays,
  transportCostPerUnit,
  defaultFairSort,
};
