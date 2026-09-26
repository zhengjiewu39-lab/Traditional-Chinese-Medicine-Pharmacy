/**
 * Warehouse outbound supply disruption: caps shippable units per warehouse per day
 * without double-deducting inventory (deduction only on confirmed ship via warehouseIssue).
 */

function warehouseSupplyFactor(warehouseId, pharmacies, eventFactors) {
  const regions = new Set(
    pharmacies.filter((p) => p.warehouseId === warehouseId).map((p) => p.regionType),
  );
  if (!regions.size) return 1;
  let factor = 1;
  for (const rt of regions) {
    factor = Math.min(factor, eventFactors.supply[rt] ?? 1);
  }
  return factor;
}

/**
 * @param {Array} requestedOrders - { pharmacyId, warehouseId, drugId, qty, regionType, ... }
 * @returns { accepted, supplyLog[] }
 */
const { defaultFairSort } = require('./distributionEngine');

function applyWarehouseSupplyCaps(requestedOrders, warehouses, pharmacies, eventFactors, phMap = {}, drugMap = {}) {
  const whMap = Object.fromEntries(warehouses.map((w) => [w.id, w]));
  const byWh = {};
  for (const o of requestedOrders) {
    if (!byWh[o.warehouseId]) byWh[o.warehouseId] = [];
    byWh[o.warehouseId].push({ ...o });
  }

  const accepted = [];
  const supplyLog = [];

  for (const [whId, orders] of Object.entries(byWh)) {
    const wh = whMap[whId];
    const supplyFactor = warehouseSupplyFactor(whId, pharmacies, eventFactors);
    const dailyDispatchCap = (wh?.dailyDispatchCapacity ?? 2500) * supplyFactor;
    let remainingCap = dailyDispatchCap;
    let requestedTotal = 0;
    let shippedTotal = 0;

    const sorted = defaultFairSort(orders, phMap, drugMap);
    for (const o of sorted) {
      requestedTotal += o.qty;
      const shipQty = Math.min(o.qty, remainingCap);
      if (shipQty > 0) {
        accepted.push({ ...o, qty: shipQty, requestedQty: o.qty, supplyFactor });
        remainingCap -= shipQty;
        shippedTotal += shipQty;
      } else {
        supplyLog.push({
          warehouseId: whId,
          drugId: o.drugId,
          pharmacyId: o.pharmacyId,
          supplyFactor,
          dailyDispatchCap,
          requestedQty: o.qty,
          shippedQty: 0,
          unmetReplenishmentQty: o.qty,
        });
      }
    }

    supplyLog.push({
      warehouseId: whId,
      supplyFactor,
      dailyDispatchCap,
      requestedTotal,
      shippedTotal,
      unmetReplenishmentTotal: requestedTotal - shippedTotal,
    });
  }

  return { accepted, supplyLog };
}

module.exports = { applyWarehouseSupplyCaps, warehouseSupplyFactor };
