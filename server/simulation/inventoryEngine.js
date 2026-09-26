/**
 * Pharmacy inventory with backorder queue (synthetic access delay model).
 */

function initPharmacyState(pharmacy) {
  return {
    id: pharmacy.id,
    regionType: pharmacy.regionType,
    onHand: { ...pharmacy.onHand },
    backlog: {},
    backlogUnitDays: 0,
    eventuallyFilledUnits: 0,
    permanentlyUnmetUnits: 0,
  };
}

function initWarehouseState(warehouse) {
  return { id: warehouse.id, onHand: { ...warehouse.initialStock } };
}

function warehouseIssue(warehouseState, drugId, qty) {
  const available = warehouseState.onHand[drugId] || 0;
  const shipped = Math.min(available, qty);
  warehouseState.onHand[drugId] = available - shipped;
  return shipped;
}

function receiveShipment(state, drugId, qty) {
  state.onHand[drugId] = (state.onHand[drugId] || 0) + qty;
}

/** Serve backlog first after arrivals; returns units filled from backlog. */
function serveBacklog(state, drugId, drugMeta) {
  const queued = state.backlog[drugId] || 0;
  if (queued <= 0) return 0;
  const onHand = state.onHand[drugId] || 0;
  const filled = Math.min(onHand, queued);
  if (filled > 0) {
    state.onHand[drugId] = onHand - filled;
    state.backlog[drugId] = queued - filled;
    state.eventuallyFilledUnits += filled;
  }
  return filled;
}

/**
 * Fulfill new demand with backorder for unmet units.
 * Wait proxy accumulates backlogUnitDays (1 day per backlog unit per day, applied at day end).
 */
function fulfillDemandWithBackorder(pharmacy, drugId, demandUnits, state, drugMeta) {
  serveBacklog(state, drugId, drugMeta);
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
  warehouseIssue,
  receiveShipment,
  fulfillDemandWithBackorder,
  serveBacklog,
  accrueBacklogWait,
  finalizeHorizonBacklog,
};
