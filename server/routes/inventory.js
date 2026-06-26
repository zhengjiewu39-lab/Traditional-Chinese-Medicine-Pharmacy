const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { computeInventoryStats, logInventoryHistory } = require('../services/stats');

const router = express.Router();

router.get('/', (req, res) => {
  const data = getStore();
  res.json(data.inventory);
});

router.get('/stats', (req, res) => {
  const data = getStore();
  res.json(computeInventoryStats(data.inventory));
});

router.get('/low-stock', (req, res) => {
  const data = getStore();
  res.json(data.inventory.filter(i => i.stock <= i.minStock));
});

router.get('/alerts', (req, res) => {
  const data = getStore();
  const now = new Date();
  const alerts = [];
  data.inventory.forEach(i => {
    if (i.stock <= i.minStock) alerts.push({ type: 'low_stock', severity: i.stock === 0 ? 'critical' : 'warning', item: i.name, message: `${i.name} 库存 ${i.stock}${i.unit}，低于安全库存 ${i.minStock}${i.unit}` });
    if (i.expiryDate && new Date(i.expiryDate) < new Date(now.getTime() + 90 * 86400000)) {
      alerts.push({ type: 'expiry', severity: 'warning', item: i.name, message: `${i.name} 将于 ${i.expiryDate} 到期` });
    }
  });
  res.json(alerts);
});

router.get('/:id', (req, res) => {
  const item = getStore().inventory.find(i => i.id === +req.params.id);
  if (!item) return res.status(404).json({ message: '未找到' });
  res.json(item);
});

router.get('/:id/history', (req, res) => {
  const data = getStore();
  res.json((data.inventoryHistory || []).filter(h => h.itemId === +req.params.id));
});

router.post('/', (req, res) => {
  updateStore(data => {
    const item = { id: nextId(data, 'inventory'), location: '主库-A区', ...req.body };
    data.inventory.push(item);
    const herb = data.herbs.find(h => h.name === item.name);
    if (herb) { herb.stock = item.stock; herb.price = item.price; }
    logInventoryHistory(data, item.id, 'create', item.stock, '新增库存');
  });
  const created = getStore().inventory.at(-1);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.inventory.findIndex(i => i.id === +req.params.id);
    if (idx === -1) return;
    data.inventory[idx] = { ...data.inventory[idx], ...req.body, id: +req.params.id };
    updated = data.inventory[idx];
    const herb = data.herbs.find(h => h.name === updated.name);
    if (herb) Object.assign(herb, { stock: updated.stock, price: updated.price, minStock: updated.minStock });
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.post('/:id/add', (req, res) => {
  const qty = +req.body.quantity || 0;
  let updated;
  updateStore(data => {
    const item = data.inventory.find(i => i.id === +req.params.id);
    if (!item) return;
    item.stock += qty;
    updated = item;
    logInventoryHistory(data, item.id, 'add', qty, req.body.note || '入库');
    const herb = data.herbs.find(h => h.name === item.name);
    if (herb) herb.stock = item.stock;
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.post('/:id/reduce', (req, res) => {
  const qty = +req.body.quantity || 0;
  let updated;
  updateStore(data => {
    const item = data.inventory.find(i => i.id === +req.params.id);
    if (!item) return;
    if (item.stock < qty) throw new Error('库存不足');
    item.stock -= qty;
    updated = item;
    logInventoryHistory(data, item.id, 'reduce', qty, req.body.note || '出库');
    const herb = data.herbs.find(h => h.name === item.name);
    if (herb) herb.stock = item.stock;
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.inventory = data.inventory.filter(i => i.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
