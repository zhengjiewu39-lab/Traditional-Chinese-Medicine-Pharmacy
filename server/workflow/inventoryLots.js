/**
 * Lot-level inventory balances. Parent catalog rows keep a roll-up stock only.
 * Batch attributes live on the lot, not on the catalog row.
 */
const { randomId } = require('../common/hash');
const repo = require('./workflowRepository');
const { ServiceError } = require('./errors');

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

function ensureLegacyLot(item) {
  const existing = listLots(item.id);
  if (existing.length) return existing;
  const qty = Number(item.stock || 0);
  if (qty <= 0) return [];
  const expiresAt = validIsoDate(item.expiry) ? item.expiry : '2099-12-31';
  const lot = {
    lotId: randomId('lot'),
    inventoryId: item.id,
    name: item.name,
    batchNo: item.batchNo || `legacy-${item.id}`,
    expiresAt,
    inspection: 'pass',
    qty,
    usable: expiresAt > today(),
    source: 'legacy_catalog',
    createdAt: new Date().toISOString(),
  };
  saveLot(lot);
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
  return taken;
}

module.exports = {
  validIsoDate,
  today,
  listLots,
  saveLot,
  usableLot,
  rollupQty,
  ensureLegacyLot,
  addLot,
  takeFromLots,
  lotKey,
};
