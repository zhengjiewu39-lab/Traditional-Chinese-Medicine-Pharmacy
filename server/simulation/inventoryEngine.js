/**
 * Pharmacy inventory with backorder queue (synthetic access delay model).
 *
 * Per pharmacy × SKU state:
 *   onHand   — physical units on the shelf
 *   onOrder  — units shipped from a warehouse and still in transit
 *   backlog  — demand units accepted but not yet served (backorders)
 *
 * Inventory position (the only quantity policies may use for reorder decisions):
 *   IP = onHand + onOrder − backlog
 */

function initPharmacyState(pharmacy) {
  return {
    id: pharmacy.id,
    regionType: pharmacy.regionType,
    onHand: { ...pharmacy.onHand },
    onOrder: {},
    backlog: {},
    backlogServed: {},
    backlogUnitDays: 0,
    eventuallyFilledUnits: 0,
    permanentlyUnmetUnits: 0,
  };
}

function initWarehouseState(warehouse) {
  return { id: warehouse.id, onHand: { ...warehouse.initialStock } };
}

function inventoryPosition(state, drugId) {
  return (state.onHand[drugId] || 0)
    + (state.onOrder?.[drugId] || 0)
    - (state.backlog[drugId] || 0);
}

function warehouseIssue(warehouseState, drugId, qty) {
  const available = warehouseState.onHand[drugId] || 0;
  const shipped = Math.max(0, Math.min(available, qty));
  warehouseState.onHand[drugId] = available - shipped;
  return shipped;
}

function warehouseReceive(warehouseState, drugId, qty) {
  if (qty <= 0) return;
  warehouseState.onHand[drugId] = (warehouseState.onHand[drugId] || 0) + qty;
}

function markShipped(state, drugId, qty) {
  if (qty <= 0) return;
  state.onOrder[drugId] = (state.onOrder[drugId] || 0) + qty;
}

function receiveShipment(state, drugId, qty) {
  state.onHand[drugId] = (state.onHand[drugId] || 0) + qty;
  if (state.onOrder) {
    state.onOrder[drugId] = Math.max(0, (state.onOrder[drugId] || 0) - qty);
  }
}

/** Serve backlog first after arrivals; returns units filled from backlog. */
function serveBacklog(state, drugId) {
  const queued = state.backlog[drugId] || 0;
  if (queued <= 0) return 0;
  const onHand = state.onHand[drugId] || 0;
  const filled = Math.min(onHand, queued);
  if (filled > 0) {
    state.onHand[drugId] = onHand - filled;
    state.backlog[drugId] = queued - filled;
    state.eventuallyFilledUnits += filled;
    if (state.backlogServed) state.backlogServed[drugId] = (state.backlogServed[drugId] || 0) + filled;
  }
  return filled;
}

/**
 * Fulfill new demand with backorder for unmet units.
 * Wait proxy accumulates backlogUnitDays (1 day per backlog unit per day, applied at day end).
 */
function fulfillDemandWithBackorder(pharmacy, drugId, demandUnits, state) {
  const servedFromBacklog = serveBacklog(state, drugId);
  let remaining = demandUnits;
  const onHand = state.onHand[drugId] || 0;
  const filledFromStock = Math.min(onHand, remaining);
  state.onHand[drugId] = onHand - filledFromStock;
  remaining -= filledFromStock;

  let backordered = 0;
  if (remaining > 0) {
    state.backlog[drugId] = (state.backlog[drugId] || 0) + remaining;
    backordered = remaining;
  }

  return {
    filled: filledFromStock,
    stockout: backordered,
    backordered,
    servedFromBacklog,
  };
}

function accrueBacklogWait(state) {
  let units = 0;
  for (const v of Object.values(state.backlog)) units += v;
  state.backlogUnitDays += units;
}

function finalizeHorizonBacklog(state) {
  for (const v of Object.values(state.backlog)) {
    state.permanentlyUnmetUnits += v;
  }
}

module.exports = {
  initPharmacyState,
  initWarehouseState,
  inventoryPosition,
  warehouseIssue,
  warehouseReceive,
  markShipped,
  receiveShipment,
  fulfillDemandWithBackorder,
  serveBacklog,
  accrueBacklogWait,
  finalizeHorizonBacklog,
};
