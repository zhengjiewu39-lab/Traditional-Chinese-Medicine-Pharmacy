/**
 * Pharmacy floor assist: match a signed prescription to inventory SKUs,
 * and restock from reorder-point + pending prescription demand.
 * Does not invent herbs, change doses, or replace pharmacist sign-off.
 */
const { randomId } = require('../common/hash');
const { getStore, updateStore } = require('../data/store');
const { logInventoryHistory } = require('../services/stats');
const repo = require('./workflowRepository');
const { recordStockMovement } = require('./workflowRepository');
const { unitsCompatible } = require('./inventoryDeduct');
const { ServiceError } = require('./errors');

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
  const stock = reserved || new Map(inv.map((i) => [i.id, i.stock ?? 0]));
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
    const available = stock.get(item.id) ?? 0;
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
  const reserved = new Map(inventory.map((i) => [i.id, i.stock ?? 0]));
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
  };
}

function applyRestock(actor, body = {}) {
  const wanted = new Set((body.inventoryIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0));
  const before = planDesk();
  const lines = before.restock.filter((r) => !wanted.size || wanted.has(r.inventoryId));
  if (!lines.length) {
    return { applied: [], desk: before };
  }

  const applied = [];
  updateStore((data) => {
    for (const line of lines) {
      const item = (data.inventory || []).find((i) => i.id === line.inventoryId);
      if (!item || line.suggestedQty <= 0) continue;
      item.stock = (item.stock ?? 0) + line.suggestedQty;
      const herb = (data.herbs || []).find((h) => h.name === item.name);
      if (herb) herb.stock = item.stock;
      logInventoryHistory(data, item.id, 'restock', line.suggestedQty, `自动补货 ${line.reasons.join('+')}`);
      recordStockMovement({
        id: randomId('stk'),
        idempotencyKey: `restock:${item.id}:${line.suggestedQty}:${item.stock}`,
        inventoryId: item.id,
        herbName: item.name,
        quantity: line.suggestedQty,
        reason: 'restock',
        actorId: String(actor.id),
      });
      applied.push({
        inventoryId: item.id,
        name: item.name,
        added: line.suggestedQty,
        stock: item.stock,
        reasons: line.reasons,
      });
    }
  });
  return { applied, desk: planDesk() };
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
  assertFillable,
  DEMAND_STATES,
};
