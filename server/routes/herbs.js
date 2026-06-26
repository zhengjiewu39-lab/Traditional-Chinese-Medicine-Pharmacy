const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');

const router = express.Router();

router.get('/', (req, res) => {
  const { q, category } = req.query;
  let herbs = getStore().herbs;
  if (q) {
    const term = q.toLowerCase();
    herbs = herbs.filter(h => h.name.includes(term) || h.pinyin?.includes(term) || h.category?.includes(term));
  }
  if (category) herbs = herbs.filter(h => h.category === category);
  res.json(herbs);
});

router.get('/search', (req, res) => {
  const q = req.query.query || req.query.q || '';
  const herbs = getStore().herbs.filter(h =>
    h.name.includes(q) || h.pinyin?.includes(q.toLowerCase()) || h.category?.includes(q)
  );
  res.json(herbs);
});

router.get('/:id', (req, res) => {
  const h = getStore().herbs.find(x => x.id === +req.params.id);
  if (!h) return res.status(404).json({ message: '未找到' });
  res.json(h);
});

router.post('/', (req, res) => {
  let created;
  updateStore(data => {
    created = { id: nextId(data, 'herb'), stock: 0, minStock: 10, ...req.body };
    data.herbs.push(created);
    data.inventory.push({
      id: created.id, name: created.name, category: created.category,
      stock: created.stock, unit: created.unit, price: created.price,
      minStock: created.minStock, supplier: created.supplier || '—',
      expiryDate: created.expiryDate, batchNo: created.batchNo || '—', location: '主库-A区',
    });
  });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.herbs.findIndex(h => h.id === +req.params.id);
    if (idx === -1) return;
    data.herbs[idx] = { ...data.herbs[idx], ...req.body, id: +req.params.id };
    updated = data.herbs[idx];
    const inv = data.inventory.find(i => i.id === +req.params.id || i.name === updated.name);
    if (inv) Object.assign(inv, { stock: updated.stock, price: updated.price, category: updated.category });
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.herbs = data.herbs.filter(h => h.id !== +req.params.id);
    data.inventory = data.inventory.filter(i => i.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
