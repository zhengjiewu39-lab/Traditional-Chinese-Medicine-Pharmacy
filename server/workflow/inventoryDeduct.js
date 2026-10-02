const { randomId } = require('../common/hash');
const { getStore, updateStore } = require('../data/store');
const { logInventoryHistory } = require('../services/stats');
const { recordStockMovement } = require('./workflowRepository');
const { transaction } = require('../db/sqlite');

function deductForCase(c, actor, { idempotencyKey } = {}) {
  const key = idempotencyKey || `dispense:${c.caseId}:${c.contentVersion}`;
  return transaction(() => {
    const recorded = recordStockMovement({
      id: randomId('stk'),
      idempotencyKey: key,
      caseId: c.caseId,
      actorId: String(actor.id),
      quantity: 0,
      reason: 'dispense_begin',
    });
    if (recorded.replayed) return { replayed: true, movements: [] };
    const movements = [];
    updateStore((data) => {
      for (const herb of c.prescription?.herbs || []) {
        const qty = Number(herb.dosage || 0) * Number(c.prescription.doseCount || 1);
        if (!qty) continue;
        const inv = (data.inventory || []).find((i) => i.name === herb.name);
        if (!inv) continue;
        if (inv.stock < qty) {
          movements.push({ inventoryId: inv.id, quantity: 0, shortage: true, needed: qty });
          continue;
        }
        inv.stock -= qty;
        logInventoryHistory(data, inv.id, 'dispense', qty, `病例 ${c.caseId}`);
        const rec = recordStockMovement({
          id: randomId('stk'),
          idempotencyKey: `${key}:${inv.id}`,
          inventoryId: inv.id,
          herbName: inv.name,
          quantity: qty,
          reason: 'dispense',
          caseId: c.caseId,
          actorId: String(actor.id),
        });
        movements.push({ inventoryId: inv.id, quantity: qty, replayed: rec.replayed });
      }
    });
    return { replayed: false, movements };
  });
}

function inventoryCounts() {
  const inv = getStore().inventory || [];
  const today = new Date().toISOString().slice(0, 10);
  return {
    shortage: inv.filter((i) => (i.stock ?? 0) <= (i.minStock ?? 0)).length,
    nearExpiry: inv.filter((i) => i.expiry && String(i.expiry) <= today).length,
  };
}

module.exports = { deductForCase, inventoryCounts };
