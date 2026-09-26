/**
 * Warehouse → pharmacy shipments with capacity and transit delay (days).
 * inTransit: { arriveDay, pharmacyId, drugId, qty, transitDays }
 */

const DEFAULT_TRUCK_CAPACITY = 2000;

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

function processArrivals(currentDay, inTransit, pharmacyStates) {
  const arriving = inTransit.filter((s) => s.arriveDay <= currentDay);
  const remaining = inTransit.filter((s) => s.arriveDay > currentDay);
  for (const s of arriving) {
    const ph = pharmacyStates.find((p) => p.id === s.pharmacyId);
    if (ph) {
      ph.onHand[s.drugId] = (ph.onHand[s.drugId] || 0) + s.qty;
    }
  }
  return remaining;
}

function allocateTruckCapacity(orders, capacity = DEFAULT_TRUCK_CAPACITY) {
  const accepted = [];
  let used = 0;
  for (const o of orders) {
    if (used + o.qty <= capacity) {
      accepted.push(o);
      used += o.qty;
    } else {
      const room = capacity - used;
      if (room > 0) {
        accepted.push({ ...o, qty: room });
        used = capacity;
      }
      break;
    }
  }
  return accepted;
}

module.exports = {
  DEFAULT_TRUCK_CAPACITY,
  scheduleShipment,
  processArrivals,
  allocateTruckCapacity,
};
