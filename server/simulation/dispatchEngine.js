/**
 * Warehouse outbound supply disruption: caps shippable units per warehouse per day.
 * Orders are served in the submitting policy's rank order (or rationed proportionally for
 * baselines that emit rationing: 'proportional'). Only units the warehouse can
 * actually issue from stock consume dispatch capacity (stock is reserved here and
 * deducted on confirmed shipment via warehouseIssue).
 */

const { sortByPolicyRank, proportionalShares, isProportional } = require('./distributionEngine');

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

function effectiveDispatchCap(warehouse, pharmacies, eventFactors) {
  const supplyFactor = warehouseSupplyFactor(warehouse.id, pharmacies, eventFactors);
  return {
    supplyFactor,
    dailyDispatchCap: (warehouse.dailyDispatchCapacity ?? 2500) * supplyFactor,
  };
}

/**
 * @param {Array} requestedOrders - { pharmacyId, warehouseId, drugId, qty, policyRank, ... }
 * @param {Array} [warehouseStates] - when given, acceptance is limited by remaining stock per SKU.
 * @returns { accepted, deferred, supplyLog[] }
 */
function applyWarehouseSupplyCaps(requestedOrders, warehouses, pharmacies, eventFactors, warehouseStates) {
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
    const { supplyFactor, dailyDispatchCap } = effectiveDispatchCap(whMap[whId], pharmacies, eventFactors);
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
        accepted.push({ ...o, qty: shipQty, requestedQty: o.qty, supplyFactor, postSupplyRank: idx });
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
      if (capShort > 0) deferred.push({ ...o, qty: capShort, reason: 'supply_cap' });
    });

    supplyLog.push({
      warehouseId: whId,
      supplyFactor,
      dailyDispatchCap,
      requestedTotal,
      shippedTotal,
      stockLimitedTotal,
      unmetReplenishmentTotal: requestedTotal - shippedTotal,
    });
  }

  return { accepted, deferred, supplyLog };
}

module.exports = { applyWarehouseSupplyCaps, warehouseSupplyFactor, effectiveDispatchCap };
