/** 处方工作流：审方 → 取药码 → 配药 → 收银 */

const STATUS_FLOW = {
  待审核: ['已审核', '已驳回'],
  已审核: ['配药中', '待取药'],
  配药中: ['待取药'],
  待取药: ['已完成'],
  已驳回: [],
  已完成: [],
};

function generatePickupCode(existing = []) {
  const codes = new Set(existing.map(p => p.pickupCode).filter(Boolean));
  let code;
  do {
    code = 'TCM' + String(Math.floor(100000 + Math.random() * 900000));
  } while (codes.has(code));
  return code;
}

function parseDosageQty(dosage) {
  if (dosage == null) return 1;
  const m = String(dosage).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.ceil(parseFloat(m[1]))) : 1;
}

function findInventoryItem(name, inventory, herbs) {
  const exact = inventory.find(i => i.name === name);
  if (exact) return exact;
  const partial = inventory.find(i => name.includes(i.name) || i.name.includes(name));
  if (partial) return partial;
  const herb = herbs.find(h => h.name === name || name.includes(h.name) || h.name.includes(name));
  if (herb) return inventory.find(i => i.id === herb.id) || herb;
  return null;
}

function buildBillingPrefill(prescription, store) {
  const { inventory, herbs } = store;
  const items = [];
  const missing = [];
  const lowStock = [];

  for (const h of prescription.herbs || []) {
    const name = typeof h === 'string' ? h : h.name;
    const dosage = typeof h === 'string' ? null : h.dosage;
    const qty = parseDosageQty(dosage);
    const inv = findInventoryItem(name, inventory, herbs);

    if (!inv) {
      missing.push({ name, quantity: qty, reason: '库存中未找到该药材' });
      continue;
    }

    const stock = inv.stock ?? 0;
    if (stock < qty) {
      lowStock.push({ name: inv.name, need: qty, stock, unit: inv.unit });
    }

    items.push({
      herbId: inv.id,
      name: inv.name,
      quantity: qty,
      price: inv.price,
      unit: inv.unit || '克',
      stock,
      fromPrescription: true,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return {
    prescriptionId: prescription.id,
    patientName: prescription.patientName,
    patientId: prescription.patientId,
    diagnosis: prescription.diagnosis,
    pickupCode: prescription.pickupCode,
    status: prescription.status,
    items,
    missing,
    lowStock,
    subtotal: Math.round(subtotal * 100) / 100,
    canCheckout: items.length > 0 && lowStock.length === 0 && missing.length === 0,
  };
}

function appendTimeline(prescription, status, actor, note) {
  const timeline = prescription.timeline || [];
  timeline.unshift({
    status,
    at: new Date().toISOString(),
    actor: actor || '系统',
    note: note || '',
  });
  return timeline;
}

function canTransition(from, to) {
  return (STATUS_FLOW[from] || []).includes(to);
}

module.exports = {
  STATUS_FLOW,
  generatePickupCode,
  buildBillingPrefill,
  appendTimeline,
  canTransition,
  parseDosageQty,
};
