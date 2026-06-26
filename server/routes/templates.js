const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getStore().prescriptionTemplates || []);
});

router.get('/:id', (req, res) => {
  const t = (getStore().prescriptionTemplates || []).find(x => x.id === +req.params.id);
  if (!t) return res.status(404).json({ message: '未找到' });
  res.json(t);
});

router.post('/', (req, res) => {
  let created;
  updateStore(data => {
    data.prescriptionTemplates = data.prescriptionTemplates || [];
    created = { id: nextId(data, 'template'), popularity: 0, ...req.body };
    data.prescriptionTemplates.push(created);
  });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = (data.prescriptionTemplates || []).findIndex(t => t.id === +req.params.id);
    if (idx === -1) return;
    data.prescriptionTemplates[idx] = { ...data.prescriptionTemplates[idx], ...req.body, id: +req.params.id };
    updated = data.prescriptionTemplates[idx];
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.prescriptionTemplates = (data.prescriptionTemplates || []).filter(t => t.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
