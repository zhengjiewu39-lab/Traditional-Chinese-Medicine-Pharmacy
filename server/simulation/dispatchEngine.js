/**
 * Warehouse dispatch (outbound handling) capacity towards pharmacies.
 *
 * The daily dispatch cap is a property of the warehouse (dailyDispatchCapacity, standard units)
 * and is not affected by upstream supply disruptions: those act on suppliers and reach
 * pharmacies only through the warehouse's stock (supplyNetwork.js). Orders are served in the
 * submitting policy's rank order (or rationed proportionally for baselines that emit
 * rationing: 'proportional'). Only units the warehouse can actually issue from stock consume
 * dispatch capacity (stock is reserved here and deducted on confirmed shipment).
 */

const { sortByPolicyRank, proportionalShares, isProportional } = require('./distributionEngine');

function effectiveDispatchCap(warehouse) {
  return { dailyDispatchCap: warehouse.dailyDispatchCapacity ?? 2500 };
}

/**
 * @param {Array} requestedOrders - { pharmacyId, warehouseId, drugId, qty, policyRank, ... }
 * @param {Array} warehouses
 * @param {Array} [warehouseStates] - when given, acceptance is limited by remaining stock per SKU.
 * @returns { accepted, deferred, supplyLog[] }
 */
function applyWarehouseSupplyCaps(requestedOrders, warehouses, warehouseStates) {
  const whMap = Object.fromEntries(warehouses.map((w) => [w.id, w]));
  const stateMap = Object.fromEntries((warehouseStates || []).map((w) => [w.id, w]));
  const byWh = {};
  for (const o of requestedOrders) {
    if (!byWh[o.warehouseId]) byWh[o.warehouseId] = [];
    byWh[o.warehouseId].push({ ...o });
  }

  const accepted = [];
  const deferred = [];
  const supplyLog = [];

  for (const [whId, orders] of Object.entries(byWh)) {
    const { dailyDispatchCap } = effectiveDispatchCap(whMap[whId]);
    const stock = stateMap[whId] ? { ...stateMap[whId].onHand } : null;
    let remainingCap = Math.floor(dailyDispatchCap);
    let requestedTotal = 0;
    let shippedTotal = 0;
    let stockLimitedTotal = 0;

    const sorted = sortByPolicyRank(orders);
    let planned = null;
    if (isProportional(sorted)) {
      // Stock is rationed proportionally within each SKU, then dispatch capacity across all lines.
      const byStockQty = sorted.map((o) => o.qty);
      if (stock) {
        const idxByDrug = {};
        sorted.forEach((o, i) => { (idxByDrug[o.drugId] ||= []).push(i); });
        for (const [drugId, idxs] of Object.entries(idxByDrug)) {
          const s = proportionalShares(idxs.map((i) => sorted[i].qty), Math.max(0, stock[drugId] || 0));
          idxs.forEach((i, k) => { byStockQty[i] = s[k]; });
        }
      }
      planned = { byStock: byStockQty, ship: proportionalShares(byStockQty, remainingCap) };
    }

    sorted.forEach((o, idx) => {
      requestedTotal += o.qty;
      const stockAvail = stock ? Math.max(0, stock[o.drugId] || 0) : Infinity;
      const byStock = planned ? planned.byStock[idx] : Math.min(o.qty, stockAvail);
      const shipQty = planned ? planned.ship[idx] : Math.max(0, Math.min(byStock, remainingCap));
      if (shipQty > 0) {
        accepted.push({ ...o, qty: shipQty, requestedQty: o.qty, postSupplyRank: idx });
        remainingCap -= shipQty;
        shippedTotal += shipQty;
        if (stock) stock[o.drugId] -= shipQty;
      }
      const stockShort = o.qty - byStock;
      const capShort = byStock - shipQty;
      if (stockShort > 0) {
        deferred.push({ ...o, qty: stockShort, reason: 'warehouse_stock' });
        stockLimitedTotal += stockShort;
      }
      if (capShort > 0) deferred.push({ ...o, qty: capShort, reason: 'dispatch_cap' });
    });

    supplyLog.push({
      warehouseId: whId,
      dailyDispatchCap,
      requestedTotal,
      shippedTotal,
      stockLimitedTotal,
      unmetReplenishmentTotal: requestedTotal - shippedTotal,
    });
  }

  return { accepted, deferred, supplyLog };
}

module.exports = { applyWarehouseSupplyCaps, effectiveDispatchCap };
