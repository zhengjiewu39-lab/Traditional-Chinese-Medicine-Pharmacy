/**
 * One catalog for warehouse, POS, purchase orders, and traceability.
 * Usable quantity is SQLite lots; JSON stock is a rebuilt cache.
 */
const { randomId } = require('../common/hash');
const { getStore, updateStore } = require('../data/store');
const { buildTraceRecord } = require('../data/traceabilityGenerator');
const { logInventoryHistory } = require('../services/stats');
const { recordStockMovement } = require('./workflowRepository');
const lots = require('./inventoryLots');

function findInv(data, ref = {}) {
  const id = Number(ref.id || ref.herbId || ref.inventoryId);
  return (data.inventory || []).find((i) => (Number.isFinite(id) && Number(i.id) === id) || (ref.name && i.name === ref.name)) || null;
}

function kindsMismatch(data) {
  const herbNames = new Set((data.herbs || []).map((h) => h.name).filter(Boolean));
  const invNames = new Set((data.inventory || []).map((i) => i.name).filter(Boolean));
  const recNames = new Set((data.traceability?.records || []).map((r) => r.name).filter(Boolean));
  if (herbNames.size !== invNames.size || herbNames.size !== recNames.size) return true;
  for (const n of herbNames) {
    if (!invNames.has(n) || !recNames.has(n)) return true;
  }
  return false;
}

function inventoryRowFromHerb(h) {
  return {
    id: h.id,
    name: h.name,
    category: h.category,
    stock: Number(h.stock) || 0,
    unit: h.unit,
    price: h.price,
    minStock: h.minStock ?? 10,
    supplier: h.supplier || '—',
    expiryDate: h.expiryDate,
    batchNo: h.batchNo || `H${String(h.id).padStart(4, '0')}`,
    location: '主库-A区',
  };
}

function herbRowFromInventory(i) {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    stock: Number(i.stock) || 0,
    unit: i.unit,
    price: i.price,
    minStock: i.minStock ?? 10,
    supplier: i.supplier,
    expiryDate: i.expiryDate,
    batchNo: i.batchNo,
  };
}

function alignKinds() {
  const current = getStore();
  if (!kindsMismatch(current)) return current;
  updateStore((s) => {
    s.herbs = s.herbs || [];
    s.inventory = s.inventory || [];
    for (const h of s.herbs) {
      if (!s.inventory.some((i) => i.name === h.name || i.id === h.id)) {
        s.inventory.push(inventoryRowFromHerb(h));
      }
    }
    for (const i of s.inventory) {
      if (!s.herbs.some((h) => h.name === i.name || h.id === i.id)) {
        s.herbs.push(herbRowFromInventory(i));
      }
    }
    const keep = new Map((s.traceability?.records || []).map((r) => [r.name, r]));
    const records = s.herbs.map((h) => keep.get(h.name) || buildTraceRecord(h));
    s.traceability = {
      version: s.traceability?.version || '1.0.0',
      updatedAt: new Date().toISOString(),
      records,
    };
  });
  return getStore();
}

function liveQty(item) {
  if (!item) return 0;
  lots.ensureLegacyLot(item);
  return lots.authorityQty(item.id);
}

function projectInventory(data) {
  return (data.inventory || []).map((i) => ({
    ...i,
    stock: liveQty(i),
    stockSource: 'lot_rollup',
  }));
}

function projectHerbs(data) {
  const inv = projectInventory(data);
  const byId = new Map(inv.map((i) => [i.id, i]));
  const byName = new Map(inv.map((i) => [i.name, i]));
  return (data.herbs || []).map((h) => {
    const row = byId.get(h.id) || byName.get(h.name);
    return {
      ...h,
      stock: row ? row.stock : 0,
      inventoryId: row?.id || h.id,
      unit: h.unit || row?.unit,
      price: h.price ?? row?.price,
    };
  });
}

function projectTrace(data) {
  const inv = projectInventory(data);
  const byId = new Map(inv.map((i) => [i.id, i]));
  const byName = new Map(inv.map((i) => [i.name, i]));
  return (data.traceability?.records || []).map((r) => {
    const row = byId.get(r.herbId) || byName.get(r.name);
    return {
      ...r,
      inventoryStock: row ? row.stock : 0,
      unit: r.unit || row?.unit,
      price: r.price ?? row?.price,
    };
  });
}

function snapshot() {
  const data = alignKinds();
  const inventory = projectInventory(data);
  const herbs = projectHerbs(data);
  const records = projectTrace(data);
  return {
    inventory,
    herbs,
    records,
    names: herbs.map((h) => h.name),
  };
}

function resolve(ref) {
  const data = alignKinds();
  const inv = findInv(data, ref);
  if (!inv) return null;
  return { ...inv, stock: liveQty(inv), stockSource: 'lot_rollup' };
}

function moveNote(reason, qty) {
  updateStore((data) => {
    const inv = findInv(data, { id: qty.inventoryId, name: qty.name });
    if (inv) logInventoryHistory(data, inv.id, reason, qty.qty, qty.note || reason);
  });
}

function outbound(ref, qty, { reason = 'sale', actorId, note } = {}) {
  const inv = resolve(ref);
  if (!inv) throw new Error(`未找到药品：${ref?.name || ref?.herbId || ref?.id}`);
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) throw new Error('数量必须为正数');
  if (inv.stock < n) throw new Error(`${inv.name} 库存不足（剩余 ${inv.stock}${inv.unit || ''}）`);
  lots.takeFromLots(inv, n);
  moveNote(reason, { inventoryId: inv.id, name: inv.name, qty: n, note });
  if (actorId != null) {
    recordStockMovement({
      id: randomId('stk'),
      idempotencyKey: `${reason}:${inv.id}:${Date.now()}:${n}`,
      inventoryId: inv.id,
      herbName: inv.name,
      quantity: n,
      reason,
      actorId: String(actorId),
    });
  }
  return resolve(inv);
}

function inbound(ref, qty, { reason = 'inbound', actorId, note, batchNo, expiresAt } = {}) {
  const inv = resolve(ref);
  if (!inv) throw new Error(`未找到药品：${ref?.name || ref?.herbId || ref?.id}`);
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) throw new Error('数量必须为正数');
  lots.addLot({
    inventoryId: inv.id,
    name: inv.name,
    batchNo: String(batchNo || `WH-${inv.id}-${lots.today()}`).trim(),
    expiresAt: lots.validIsoDate(expiresAt) ? expiresAt : '2099-12-31',
    inspection: 'pass',
    qty: n,
  });
  moveNote(reason, { inventoryId: inv.id, name: inv.name, qty: n, note });
  if (actorId != null) {
    recordStockMovement({
      id: randomId('stk'),
      idempotencyKey: `${reason}:${inv.id}:${Date.now()}:${n}`,
      inventoryId: inv.id,
      herbName: inv.name,
      quantity: n,
      reason,
      actorId: String(actorId),
    });
  }
  return resolve(inv);
}

function setUsableQty(ref, qty) {
  const inv = resolve(ref);
  if (!inv) throw new Error(`未找到药品：${ref?.name || ref?.id}`);
  lots.replaceUsableQty(inv, Number(qty) || 0);
  return resolve(inv);
}

function bootstrap() {
  alignKinds();
  const data = getStore();
  for (const item of data.inventory || []) lots.ensureLegacyLot(item);
  lots.rebuildCatalogCache();
  return snapshot();
}

function nextSharedId(data) {
  data.nextId = data.nextId || {};
  const id = Math.max(data.nextId.herb || 1, data.nextId.inventory || 1);
  data.nextId.herb = id + 1;
  data.nextId.inventory = id + 1;
  return id;
}

module.exports = {
  alignKinds,
  snapshot,
  projectInventory,
  projectHerbs,
  projectTrace,
  resolve,
  outbound,
  inbound,
  setUsableQty,
  bootstrap,
  nextSharedId,
  liveQty,
};
