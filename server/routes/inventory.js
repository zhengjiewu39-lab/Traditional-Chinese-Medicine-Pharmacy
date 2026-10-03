const express = require('express');
const { getStore, updateStore } = require('../data/store');
const { computeInventoryStats } = require('../services/stats');
const catalog = require('../workflow/catalogAlign');
const { buildTraceRecord } = require('../data/traceabilityGenerator');

const router = express.Router();

function liveList() {
  return catalog.snapshot().inventory;
}

router.get('/', (req, res) => {
  res.json(liveList());
});

router.get('/stats', (req, res) => {
  res.json(computeInventoryStats(liveList()));
});

router.get('/low-stock', (req, res) => {
  res.json(liveList().filter((i) => i.stock <= i.minStock));
});

router.get('/alerts', (req, res) => {
  const now = new Date();
  const alerts = [];
  liveList().forEach((i) => {
    if (i.stock <= i.minStock) {
      alerts.push({
        type: 'low_stock',
        severity: i.stock === 0 ? 'critical' : 'warning',
        item: i.name,
        message: `${i.name} 库存 ${i.stock}${i.unit}，低于安全库存 ${i.minStock}${i.unit}`,
      });
    }
    if (i.expiryDate && new Date(i.expiryDate) < new Date(now.getTime() + 90 * 86400000)) {
      alerts.push({ type: 'expiry', severity: 'warning', item: i.name, message: `${i.name} 将于 ${i.expiryDate} 到期` });
    }
  });
  res.json(alerts);
});

router.get('/:id', (req, res) => {
  const item = catalog.resolve({ id: +req.params.id });
  if (!item) return res.status(404).json({ message: '未找到' });
  res.json(item);
});

router.get('/:id/history', (req, res) => {
  const data = getStore();
  res.json((data.inventoryHistory || []).filter((h) => h.itemId === +req.params.id));
});

router.post('/', (req, res) => {
  let created;
  updateStore((data) => {
    const id = catalog.nextSharedId(data);
    const item = {
      location: '主库-A区',
      ...req.body,
      id,
      stock: 0,
    };
    data.inventory.push(item);
    if (!data.herbs.some((h) => h.name === item.name || h.id === id)) {
      data.herbs.push({
        id,
        name: item.name,
        category: item.category,
        stock: item.stock,
        unit: item.unit,
        price: item.price,
        minStock: item.minStock,
        supplier: item.supplier,
        expiryDate: item.expiryDate,
        batchNo: item.batchNo,
      });
    }
    const herb = data.herbs.find((h) => h.name === item.name || h.id === id);
    data.traceability = data.traceability || { records: [] };
    if (!data.traceability.records.some((r) => r.name === item.name || r.herbId === id)) {
      data.traceability.records.push(buildTraceRecord(herb || item));
    }
    created = item;
  });
  const opening = Number(req.body.stock) || 0;
  if (opening > 0) {
    catalog.inbound(created, opening, {
      reason: 'create',
      note: '新增库存',
      batchNo: created.batchNo,
      expiresAt: created.expiryDate,
    });
  }
  res.status(201).json(catalog.resolve(created));
});

router.put('/:id', (req, res) => {
  const id = +req.params.id;
  const before = catalog.resolve({ id });
  if (!before) return res.status(404).json({ message: '未找到' });
  const nextStock = req.body.stock != null ? Number(req.body.stock) : before.stock;
  updateStore((data) => {
    const idx = data.inventory.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const { stock, ...rest } = req.body;
    data.inventory[idx] = { ...data.inventory[idx], ...rest, id };
    const herb = data.herbs.find((h) => h.id === id || h.name === data.inventory[idx].name);
    if (herb) Object.assign(herb, { price: data.inventory[idx].price, minStock: data.inventory[idx].minStock, category: data.inventory[idx].category, name: data.inventory[idx].name });
  });
  if (Number.isFinite(nextStock) && nextStock !== before.stock) {
    catalog.setUsableQty({ id }, nextStock);
  }
  res.json(catalog.resolve({ id }));
});

router.post('/:id/add', (req, res) => {
  try {
    const updated = catalog.inbound({ id: +req.params.id }, +req.body.quantity || 0, {
      reason: 'add',
      note: req.body.note || '入库',
      batchNo: req.body.batchNo,
      expiresAt: req.body.expiresAt || req.body.expiryDate,
    });
    if (!updated) return res.status(404).json({ message: '未找到' });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post('/:id/reduce', (req, res) => {
  try {
    const updated = catalog.outbound({ id: +req.params.id }, +req.body.quantity || 0, {
      reason: 'reduce',
      note: req.body.note || '出库',
    });
    if (!updated) return res.status(404).json({ message: '未找到' });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const id = +req.params.id;
  updateStore((data) => {
    const item = data.inventory.find((i) => i.id === id);
    data.inventory = data.inventory.filter((i) => i.id !== id);
    if (item) {
      data.herbs = data.herbs.filter((h) => h.id !== id && h.name !== item.name);
      if (data.traceability?.records) {
        data.traceability.records = data.traceability.records.filter((r) => r.herbId !== id && r.name !== item.name);
      }
    }
  });
  res.json({ success: true });
});

module.exports = router;
