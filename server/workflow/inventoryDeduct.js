const { randomId } = require('../common/hash');
const { getStore, updateStore } = require('../data/store');
const { logInventoryHistory } = require('../services/stats');
const { recordStockMovement } = require('./workflowRepository');
const { transaction, getDb } = require('../db/sqlite');
const { ServiceError } = require('./errors');
const lots = require('./inventoryLots');

function unitsCompatible(a, b) {
  const norm = (u) => ({ g: 'g', 克: 'g', kg: 'kg', 千克: 'kg', ml: 'ml' }[String(u || 'g').toLowerCase()] || String(u || 'g'));
  return !a || !b || norm(a) === norm(b);
}

function findSuccess(key) {
  return getDb().prepare('SELECT id FROM stock_movements WHERE idempotency_key = ? AND quantity > 0').get(key);
}

function deductForCase(c, actor, { idempotencyKey } = {}) {
  const key = idempotencyKey || `dispense:${c.caseId}:${c.contentVersion}`;
  if (findSuccess(`${key}:ok`)) return { replayed: true, movements: [] };

  const store = getStore();
  if (!(store.inventory || []).length) {
    const { isSyntheticMode } = require('../config/dataMode');
    if (!isSyntheticMode()) {
      throw new ServiceError(409, 'inventory_catalog_missing', 'Live inventory catalog is missing; dispensing is blocked');
    }
    return { replayed: false, movements: [], skipped: 'no_inventory_catalog', demoOnly: true };
  }
  const plan = [];
  for (const herb of c.prescription?.herbs || []) {
    const qty = Number(herb.dosage || 0) * Number(c.prescription.doseCount || 1);
    if (!qty || qty < 0) throw new ServiceError(409, 'invalid_dispense_qty', `${herb.name} has no dispensable quantity`);
    const inv = (store.inventory || []).find((i) => i.name === herb.name && unitsCompatible(herb.unit, i.unit));
    if (!inv) throw new ServiceError(409, 'herb_not_in_inventory', `${herb.name} is not in inventory`);
    lots.ensureLegacyLot(inv);
    const available = lots.authorityQty(inv.id);
    if (available < qty) {
      throw new ServiceError(409, 'insufficient_stock', `${herb.name} usable lot stock ${available} is below ${qty}`, { herb: herb.name, needed: qty, available });
    }
    plan.push({ inv, qty, herb });
  }
  if (!plan.length) throw new ServiceError(409, 'nothing_to_dispense', 'Prescription has no matching inventory lines');

  return transaction(() => {
    if (findSuccess(`${key}:ok`)) return { replayed: true, movements: [] };
    const movements = [];
    const taken = [];
    for (const line of plan) {
      const fromLots = lots.takeFromLots(line.inv, line.qty);
      taken.push({ inventoryId: line.inv.id, fromLots });
      const rec = recordStockMovement({
        id: randomId('stk'),
        idempotencyKey: `${key}:${line.inv.id}`,
        inventoryId: line.inv.id,
        herbName: line.inv.name,
        quantity: line.qty,
        reason: 'dispense',
        caseId: c.caseId,
        actorId: String(actor.id),
      });
      movements.push({ inventoryId: line.inv.id, quantity: line.qty, replayed: rec.replayed, lots: fromLots });
    }
    recordStockMovement({
      id: randomId('stk'),
      idempotencyKey: `${key}:ok`,
      caseId: c.caseId,
      actorId: String(actor.id),
      quantity: plan.reduce((s, l) => s + l.qty, 0),
      reason: 'dispense_complete',
    });
    updateStore((data) => {
      for (const line of plan) {
        const inv = (data.inventory || []).find((i) => i.id === line.inv.id);
        if (!inv) throw new ServiceError(409, 'insufficient_stock', `${line.herb.name} catalog row missing during deduct`);
        inv.stock = lots.authorityQty(inv.id);
        inv.stockSource = 'lot_rollup';
        logInventoryHistory(data, inv.id, 'dispense', line.qty, `病例 ${c.caseId}`);
      }
    });
    return { replayed: false, movements };
  });
}

function inventoryCounts() {
  const inv = getStore().inventory || [];
  const today = lots.today();
  return {
    shortage: inv.filter((i) => {
      lots.ensureLegacyLot(i);
      return lots.authorityQty(i.id) <= (i.minStock ?? 0);
    }).length,
    nearExpiry: inv.filter((i) => lots.listLots(i.id).some((l) => lots.usableLot(l) && l.expiresAt && String(l.expiresAt) <= today)).length,
  };
}

module.exports = { deductForCase, inventoryCounts, unitsCompatible };
