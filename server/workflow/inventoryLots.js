/**
 * Quantity authority is SQLite lots (+ stock_movements).
 * JSON catalog `stock` is a rebuilt cache, not an independent balance.
 */
const { randomId } = require('../common/hash');
const repo = require('./workflowRepository');
const { ServiceError } = require('./errors');
const { isSyntheticMode } = require('../config/dataMode');

function validIsoDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const iso = `${s}T00:00:00.000Z`;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function lotKey(lotId) {
  return lotId;
}

function listLots(inventoryId) {
  return (repo.listDocs('inventoryLots') || []).filter((l) => !inventoryId || l.inventoryId === inventoryId);
}

function saveLot(lot) {
  repo.saveDoc('inventoryLots', lot.lotId, lot);
  return lot;
}

function usableLot(lot, when = today()) {
  return Boolean(lot && lot.usable && lot.qty > 0 && lot.inspection === 'pass' && lot.expiresAt && lot.expiresAt > when);
}

function rollupQty(inventoryId) {
  return listLots(inventoryId).filter((l) => usableLot(l)).reduce((s, l) => s + Number(l.qty || 0), 0);
}

function authorityQty(itemOrId) {
  const id = itemOrId && typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
  return rollupQty(id);
}

function syncCatalogCache(ids) {
  const { updateStore } = require('../data/store');
  const want = ids == null ? null : new Set((Array.isArray(ids) ? ids : [ids]).map(Number));
  updateStore((data) => {
    for (const inv of data.inventory || []) {
      if (want && !want.has(Number(inv.id))) continue;
      inv.stock = rollupQty(inv.id);
      inv.stockSource = 'lot_rollup';
      const herb = (data.herbs || []).find((h) => h.name === inv.name);
      if (herb) herb.stock = inv.stock;
    }
  });
}

function rebuildCatalogCache() {
  const { getStore } = require('../data/store');
  syncCatalogCache((getStore().inventory || []).map((i) => i.id));
}

function replaceUsableQty(item, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 0) throw new ServiceError(400, 'invalid_lot_qty', 'Usable lot quantity must be a non-negative number');
  for (const lot of listLots(item.id).filter((l) => usableLot(l))) {
    lot.qty = 0;
    lot.usable = false;
    saveLot(lot);
  }
  if (n > 0) {
    addLot({
      inventoryId: item.id,
      name: item.name,
      batchNo: `replace-${item.id}`,
      expiresAt: '2099-12-31',
      inspection: 'pass',
      qty: n,
    });
  }
  syncCatalogCache(item.id);
  return authorityQty(item.id);
}

function ensureLegacyLot(item) {
  const existing = listLots(item.id);
  if (existing.length) return existing;
  const qty = Number(item.stock || 0);
  if (qty <= 0) return [];
  const knownExpiry = validIsoDate(item.expiry);
  const knownBatch = Boolean(String(item.batchNo || '').trim());
  if (!isSyntheticMode()) {
    const lot = {
      lotId: randomId('lot'),
      inventoryId: item.id,
      name: item.name,
      batchNo: knownBatch ? item.batchNo : 'unknown',
      expiresAt: knownExpiry ? item.expiry : null,
      inspection: 'unverified',
      qty,
      usable: false,
      source: 'live_unverified_catalog',
      quarantine: true,
      createdAt: new Date().toISOString(),
    };
    saveLot(lot);
    syncCatalogCache(item.id);
    return [lot];
  }
  const expiresAt = knownExpiry ? item.expiry : '2099-12-31';
  const lot = {
    lotId: randomId('lot'),
    inventoryId: item.id,
    name: item.name,
    batchNo: item.batchNo || `legacy-${item.id}`,
    expiresAt,
    inspection: 'pass',
    qty,
    usable: expiresAt > today(),
    source: 'legacy_catalog_demo',
    createdAt: new Date().toISOString(),
  };
  saveLot(lot);
  syncCatalogCache(item.id);
  return [lot];
}

function addLot({ inventoryId, name, batchNo, expiresAt, inspection, qty, dataMode, receiptId }) {
  const lot = {
    lotId: randomId('lot'),
    inventoryId,
    name,
    batchNo,
    expiresAt,
    inspection,
    qty,
    usable: inspection === 'pass' && expiresAt > today(),
    dataMode,
    receiptId,
    createdAt: new Date().toISOString(),
  };
  saveLot(lot);
  syncCatalogCache(inventoryId);
  return lot;
}

function takeFromLots(item, need) {
  const lots = ensureLegacyLot(item)
    .filter((l) => usableLot(l))
    .sort((a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)));
  let left = need;
  const taken = [];
  for (const lot of lots) {
    if (left <= 0) break;
    const use = Math.min(lot.qty, left);
    lot.qty -= use;
    if (lot.qty <= 0) lot.usable = false;
    saveLot(lot);
    taken.push({ lotId: lot.lotId, batchNo: lot.batchNo, qty: use, expiresAt: lot.expiresAt });
    left -= use;
  }
  if (left > 0) {
    throw new ServiceError(409, 'insufficient_usable_lot', `${item.name} usable lot stock is below ${need}`, { needed: need, short: left });
  }
  syncCatalogCache(item.id);
  return taken;
}

module.exports = {
  validIsoDate,
  today,
  listLots,
  saveLot,
  usableLot,
  rollupQty,
  authorityQty,
  syncCatalogCache,
  rebuildCatalogCache,
  replaceUsableQty,
  ensureLegacyLot,
  addLot,
  takeFromLots,
  lotKey,
};
