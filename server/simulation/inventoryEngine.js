/**
 * Pharmacy and warehouse inventory: fulfillment, stockouts, replenishment orders.
 * Units: drug packages (synthetic).
 */

function fulfillDemand(pharmacy, drugId, demandUnits, state) {
  const available = state.onHand[drugId] || 0;
  const filled = Math.min(available, demandUnits);
  const stockout = demandUnits - filled;
  state.onHand[drugId] = available - filled;
  return { filled, stockout };
}

function receiveShipment(state, drugId, qty) {
  state.onHand[drugId] = (state.onHand[drugId] || 0) + qty;
}

function warehouseIssue(warehouse, drugId, qty) {
  const available = warehouse.onHand[drugId] || 0;
  const shipped = Math.min(available, qty);
  warehouse.onHand[drugId] = available - shipped;
  return shipped;
}

function initWarehouseState(warehouse) {
  return { id: warehouse.id, onHand: { ...warehouse.initialStock } };
}

function initPharmacyState(pharmacy) {
  return { id: pharmacy.id, regionType: pharmacy.regionType, onHand: { ...pharmacy.onHand } };
}

module.exports = {
  fulfillDemand,
  receiveShipment,
  warehouseIssue,
  initWarehouseState,
  initPharmacyState,
};
