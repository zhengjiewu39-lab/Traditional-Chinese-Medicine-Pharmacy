/**
 * Pharmacy floor assist: match a signed prescription to inventory SKUs,
 * and restock from reorder-point + pending prescription demand.
 * Does not invent herbs, change doses, or replace pharmacist sign-off.
 */
const { randomId, hashObject } = require('../common/hash');
const { getStore, updateStore } = require('../data/store');
const { logInventoryHistory } = require('../services/stats');
const repo = require('./workflowRepository');
const { recordStockMovement } = require('./workflowRepository');
const { transaction } = require('../db/sqlite');
const { unitsCompatible } = require('./inventoryDeduct');
const { ServiceError } = require('./errors');
const { isSyntheticMode } = require('../config/dataMode');
const lots = require('./inventoryLots');

const DEMAND_STATES = new Set([
  'pharmacist_approved',
  'patient_confirmation_required',
  'patient_confirmed',
  'dispensing',
]);

const FILL_STATES = new Set(['patient_confirmed', 'dispensing']);

function herbQty(herb, doseCount) {
  return Number(herb.dosage || 0) * Number(doseCount || 1);
}

function findInventoryItem(inventory, herb) {
  return (inventory || []).find((i) => i.name === herb.name && unitsCompatible(herb.unit, i.unit));
}

function planAllocation(c, { inventory, reserved } = {}) {
  const inv = inventory || getStore().inventory || [];
  const stock = reserved || new Map(inv.map((i) => [i.id, lots.listLots(i.id).length ? lots.rollupQty(i.id) : (i.stock ?? 0)]));
  const lines = [];
  for (const herb of c.prescription?.herbs || []) {
    const qty = herbQty(herb, c.prescription.doseCount);
    const item = findInventoryItem(inv, herb);
    if (!item) {
      lines.push({
        herbName: herb.name,
        unit: herb.unit || 'g',
        qty,
        status: 'missing',
        inventoryId: null,
        available: 0,
        location: null,
        batchNo: null,
      });
      continue;
    }
    const lotQty = lots.listLots(item.id).length ? lots.rollupQty(item.id) : (stock.get(item.id) ?? 0);
    const available = lotQty;
    const ok = qty > 0 && available >= qty;
    if (ok) stock.set(item.id, available - qty);
    lines.push({
      herbName: herb.name,
      unit: item.unit || herb.unit || 'g',
      qty,
      status: qty <= 0 ? 'invalid' : ok ? 'ok' : 'short',
      inventoryId: item.id,
      available,
      after: ok ? available - qty : available,
      location: item.location || null,
      batchNo: item.batchNo || null,
    });
  }
  return {
    caseId: c.caseId,
    patientRef: c.patient?.patientRef || null,
    patientName: c.patient?.name || null,
    ready: lines.length > 0 && lines.every((l) => l.status === 'ok'),
    method: 'prescription_to_inventory_match',
    lines,
  };
}

function planDesk(cases = repo.listCases()) {
  const inventory = getStore().inventory || [];
  const reserved = new Map(inventory.map((i) => [i.id, lots.listLots(i.id).length ? lots.rollupQty(i.id) : (i.stock ?? 0)]));
  const allocations = [];
  for (const c of cases) {
    if (!FILL_STATES.has(c.state)) continue;
    allocations.push(planAllocation(c, { inventory, reserved }));
  }

  const demand = new Map();
  for (const c of cases) {
    if (!DEMAND_STATES.has(c.state)) continue;
    for (const herb of c.prescription?.herbs || []) {
      demand.set(herb.name, (demand.get(herb.name) || 0) + herbQty(herb, c.prescription.doseCount));
    }
  }

  const restock = [];
  for (const item of inventory) {
    const pending = demand.get(item.name) || 0;
    const stock = item.stock ?? 0;
    const min = item.minStock ?? 0;
    const target = Math.max(min * 2, min + pending);
    const suggestedQty = Math.max(0, Math.ceil(target - stock));
    const reasons = [];
    if (stock <= min) reasons.push('below_min');
    if (pending > stock) reasons.push('pending_prescriptions');
    if (suggestedQty > 0 && reasons.length) {
      restock.push({
        inventoryId: item.id,
        name: item.name,
        unit: item.unit,
        stock,
        minStock: min,
        pendingDemand: pending,
        suggestedQty,
        target,
        reasons,
      });
    }
  }

  return {
    method: 'reorder_point_plus_prescription_demand',
    disclaimer: '作业规则：按处方品名匹配库存，并按最低库存与待发处方量补货。不改处方，不代替药师签署。',
    allocations,
    restock,
    readyCount: allocations.filter((a) => a.ready).length,
    blockedCount: allocations.filter((a) => !a.ready).length,
    pendingRequests: listRequests().filter((r) => r.status === 'pending_receipt'),
  };
}

function listRequests() {
  return repo.listDocs ? repo.listDocs('restockRequests') : (repo.settings().get().restockRequests || []);
}

function saveRequest(req) {
  if (typeof repo.saveDoc === 'function') {
    repo.saveDoc('restockRequests', req.id, req);
    return req;
  }
  const cur = repo.settings().get();
  const list = (cur.restockRequests || []).filter((r) => r.id !== req.id);
  list.push(req);
  repo.settings().set({ restockRequests: list });
  return req;
}

function proposeRestock(actor, body = {}) {
  const wanted = new Set((body.inventoryIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0));
  const desk = planDesk();
  const lines = desk.restock.filter((r) => !wanted.size || wanted.has(r.inventoryId));
  const requests = lines.map((line) => {
    const rec = {
      id: randomId('req'),
      status: 'pending_receipt',
      inventoryId: line.inventoryId,
      name: line.name,
      unit: line.unit,
      suggestedQty: line.suggestedQty,
      reasons: line.reasons,
      createdBy: String(actor.id),
      createdAt: new Date().toISOString(),
      dataMode: 'demo_request',
    };
    saveRequest(rec);
    return rec;
  });
  return { requests, applied: [], desk: planDesk(), note: '补货建议已生成待验收需求，未增加可用库存。' };
}

function receiveStock(actor, body = {}) {
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ServiceError(400, 'invalid_receipt_qty', 'Receipt quantity must be a positive number');
  }
  if (body.inspection !== 'pass' && body.inspection !== 'fail') {
    throw new ServiceError(400, 'inspection_required', 'Receipts need an explicit pass or fail inspection');
  }
  const batchNo = String(body.batchNo || '').trim();
  if (!batchNo) throw new ServiceError(400, 'batch_required', 'A batch number is required');
  const expiresAt = String(body.expiresAt || '').slice(0, 10);
  if (!lots.validIsoDate(expiresAt)) {
    throw new ServiceError(400, 'invalid_expiry', 'Expiry must be a real YYYY-MM-DD date');
  }
  const itemId = Number(body.inventoryId);
  const store = getStore();
  const item = (store.inventory || []).find((i) => i.id === itemId);
  if (!item) throw new ServiceError(404, 'inventory_not_found', 'Inventory item not found');
  if (!body.requestId) throw new ServiceError(400, 'request_required', 'Receive must reference a restock request');
  const found = listRequests().find((r) => r.id === body.requestId);
  if (!found) throw new ServiceError(404, 'restock_request_not_found', 'Restock request not found');
  if (Number(found.inventoryId) !== itemId) {
    throw new ServiceError(409, 'request_item_mismatch', 'Request does not match this inventory item');
  }
  if (found.status === 'rejected') throw new ServiceError(409, 'request_rejected', 'Rejected requests cannot receive stock');
  const requestHash = hashObject({
    inventoryId: itemId, quantity: qty, inspection: body.inspection, batchNo, expiresAt, requestId: body.requestId,
  });
  const key = body.idempotencyKey || `receipt:${requestHash}`;
  const prior = typeof repo.getDoc === 'function' ? repo.getDoc('receipts', key) : null;
  if (prior) {
    if (prior.requestHash !== requestHash) {
      throw new ServiceError(409, 'idempotency_conflict', 'This idempotency key was used for a different receipt');
    }
    return { receipt: prior, desk: planDesk(), replayed: true };
  }
  const expired = expiresAt <= lots.today();
  const isolatedDemo = Boolean(body.demoInbound) && !isSyntheticMode();
  const usable = body.inspection === 'pass' && !expired && !isolatedDemo;
  return transaction(() => {
    const again = typeof repo.getDoc === 'function' ? repo.getDoc('receipts', key) : null;
    if (again) {
      if (again.requestHash !== requestHash) throw new ServiceError(409, 'idempotency_conflict', 'This idempotency key was used for a different receipt');
      return { receipt: again, desk: planDesk(), replayed: true };
    }
    const receipt = {
      id: randomId('rcv'),
      requestId: found.id,
      inventoryId: item.id,
      name: item.name,
      quantity: qty,
      batchNo,
      expiresAt,
      inspection: body.inspection,
      expired,
      usable,
      isolatedDemo,
      demoInbound: isolatedDemo,
      dataMode: isolatedDemo ? 'demo_isolated' : (isSyntheticMode() ? 'demo' : 'live'),
      actorId: String(actor.id),
      at: new Date().toISOString(),
      requestHash,
      idempotencyKey: key,
    };
    repo.saveDoc('receipts', key, receipt);
    const receivedQty = Number(found.receivedQty || 0) + (usable ? qty : 0);
    const done = receivedQty >= Number(found.suggestedQty || 0);
    saveRequest({
      ...found,
      receivedQty,
      status: done ? 'received' : 'pending_receipt',
      lastInspection: body.inspection,
      receiptIds: [...(found.receiptIds || []), receipt.id],
    });
    if (usable) {
      lots.ensureLegacyLot(item);
      lots.addLot({
        inventoryId: item.id, name: item.name, batchNo, expiresAt, inspection: 'pass', qty, dataMode: receipt.dataMode, receiptId: receipt.id,
      });
      updateStore((data) => {
        const inv = (data.inventory || []).find((i) => i.id === item.id);
        if (!inv) return;
        inv.stock = lots.rollupQty(item.id);
        const herb = (data.herbs || []).find((h) => h.name === inv.name);
        if (herb) herb.stock = inv.stock;
        logInventoryHistory(data, inv.id, 'receipt', qty, `到货验收 ${batchNo} pass`);
      });
    }
    recordStockMovement({
      id: randomId('stk'),
      idempotencyKey: key,
      inventoryId: item.id,
      herbName: item.name,
      quantity: usable ? qty : 0,
      reason: isolatedDemo ? 'demo_isolated_receipt' : (usable ? 'receipt' : (expired ? 'receipt_expired' : 'receipt_failed_inspection')),
      actorId: String(actor.id),
    });
    return { receipt, desk: planDesk(), replayed: false };
  });
}

function applyRestock(actor, body = {}) {
  return proposeRestock(actor, body);
}

function assertFillable(c) {
  const plan = planAllocation(c);
  if (!plan.ready) {
    throw new ServiceError(409, 'allocation_blocked', 'Prescription cannot be filled from current stock', { lines: plan.lines });
  }
  return plan;
}

module.exports = {
  herbQty,
  planAllocation,
  planDesk,
  applyRestock,
  proposeRestock,
  receiveStock,
  assertFillable,
  DEMAND_STATES,
};
