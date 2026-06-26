const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { computeCustomerStats } = require('../services/stats');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getStore().customers);
});

router.get('/stats', (req, res) => {
  res.json(computeCustomerStats(getStore().customers));
});

router.get('/growth', (req, res) => {
  const data = getStore();
  const months = ['一月', '二月', '三月', '四月', '五月', '六月'];
  res.json(months.map((m, i) => ({ month: m, newCustomers: Math.max(1, Math.floor(data.customers.length * (0.1 + i * 0.05))) })));
});

router.get('/:id', (req, res) => {
  const c = getStore().customers.find(x => x.id === +req.params.id);
  if (!c) return res.status(404).json({ message: '未找到' });
  res.json(c);
});

router.post('/', (req, res) => {
  let created;
  updateStore(data => {
    created = {
      id: nextId(data, 'customer'),
      visits: 0, spending: 0, points: 0, memberLevel: '普通',
      lastVisit: new Date().toISOString().slice(0, 10),
      ...req.body,
    };
    data.customers.push(created);
  });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.customers.findIndex(c => c.id === +req.params.id);
    if (idx === -1) return;
    data.customers[idx] = { ...data.customers[idx], ...req.body, id: +req.params.id };
    updated = data.customers[idx];
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.customers = data.customers.filter(c => c.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
