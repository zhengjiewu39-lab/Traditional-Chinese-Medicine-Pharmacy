/**
 * Pharmacy and warehouse inventory with a FIFO backorder queue (synthetic access-delay model).
 *
 * Per pharmacy × SKU state:
 *   onHand       — physical units on the shelf
 *   onOrder      — units dispatched to this pharmacy (from a warehouse or by lateral transfer) and still in transit
 *   backlog      — demand units accepted but not yet served (backorders); equals Σ backlogQueue qty
 *   backlogQueue — FIFO list of { day, qty } so that each served unit's waiting time is known
 *
 * Inventory position (the only stock quantity policies may use for reorder decisions):
 *   IP = onHand + onOrder − backlog
 *
 * Waiting time of a demanded unit = day it is handed out − day it was demanded (0 if filled on arrival).
 * waitByDrug[drugId][w] = units handed out after waiting w days.
 */

function initPharmacyState(pharmacy) {
  return {
    id: pharmacy.id,
    regionType: pharmacy.regionType,
    onHand: { ...pharmacy.onHand },
    onOrder: {},
    backlog: {},
    backlogQueue: {},
    backlogServed: {},
    waitByDrug: {},
    transferredIn: {},
    transferredOut: {},
    lastTransferInDay: {},
    lastTransferOutDay: {},
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

function recordWait(state, drugId, wait, units) {
  if (units <= 0) return;
  const hist = state.waitByDrug[drugId] || (state.waitByDrug[drugId] = {});
  hist[wait] = (hist[wait] || 0) + units;
}

/** Serve the backlog FIFO from on-hand stock on `day`; returns units handed out from the backlog. */
function serveBacklog(state, drugId, day = 0) {
  const queued = state.backlog[drugId] || 0;
  if (queued <= 0) return 0;
  const onHand = state.onHand[drugId] || 0;
  let left = Math.min(onHand, queued);
  const filled = left;
  if (filled <= 0) return 0;
  const queue = state.backlogQueue[drugId] || [];
  while (left > 0 && queue.length) {
    const head = queue[0];
    const take = Math.min(head.qty, left);
    recordWait(state, drugId, Math.max(0, day - head.day), take);
    head.qty -= take;
    left -= take;
    if (head.qty <= 0) queue.shift();
  }
  state.onHand[drugId] = onHand - filled;
  state.backlog[drugId] = queued - filled;
  state.eventuallyFilledUnits += filled;
  state.backlogServed[drugId] = (state.backlogServed[drugId] || 0) + filled;
  return filled;
}

/**
 * Fulfil new demand on `day`: backlog first (FIFO), then new demand from stock; the unfilled
 * remainder is backordered.
 */
function fulfillDemandWithBackorder(pharmacy, drugId, demandUnits, state, _drug, day = 0) {
  const servedFromBacklog = serveBacklog(state, drugId, day);
  let remaining = demandUnits;
  const onHand = state.onHand[drugId] || 0;
  const filledFromStock = Math.min(onHand, remaining);
  state.onHand[drugId] = onHand - filledFromStock;
  remaining -= filledFromStock;
  recordWait(state, drugId, 0, filledFromStock);

  let backordered = 0;
  if (remaining > 0) {
    state.backlog[drugId] = (state.backlog[drugId] || 0) + remaining;
    (state.backlogQueue[drugId] || (state.backlogQueue[drugId] = [])).push({ day, qty: remaining });
    backordered = remaining;
  }

  return {
    filled: filledFromStock,
    stockout: backordered,
    backordered,
    servedFromBacklog,
  };
}

/** Lateral transfer out of a pharmacy's shelf; the recipient's onOrder is raised by the caller. */
function transferOut(state, drugId, qty, day) {
  const available = state.onHand[drugId] || 0;
  const q = Math.max(0, Math.min(available, qty));
  state.onHand[drugId] = available - q;
  state.transferredOut[drugId] = (state.transferredOut[drugId] || 0) + q;
  if (q > 0) state.lastTransferOutDay[drugId] = day;
  return q;
}

function accrueBacklogWait(state) {
  let units = 0;
  for (const v of Object.values(state.backlog)) units += v;
  state.backlogUnitDays += units;
}

/**
 * Units still backlogged at the horizon are counted as permanently unmet; their waiting time is
 * right-censored at (horizonDay − demand day) and recorded in censoredWaitByDrug.
 */
function finalizeHorizonBacklog(state, horizonDay) {
  state.censoredWaitByDrug = {};
  for (const [drugId, v] of Object.entries(state.backlog)) {
    state.permanentlyUnmetUnits += v;
    const hist = {};
    for (const q of state.backlogQueue[drugId] || []) {
      const w = Math.max(0, (horizonDay ?? q.day) - q.day);
      hist[w] = (hist[w] || 0) + q.qty;
    }
    state.censoredWaitByDrug[drugId] = hist;
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
  transferOut,
  accrueBacklogWait,
  finalizeHorizonBacklog,
};
