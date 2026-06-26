const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let patients = getStore().patients;
  if (q) {
    const term = q.toLowerCase();
    patients = patients.filter(p => p.name.includes(term) || p.phone.includes(term));
  }
  res.json(patients);
});

router.get('/:id', (req, res) => {
  const p = getStore().patients.find(x => x.id === +req.params.id);
  if (!p) return res.status(404).json({ message: '未找到' });
  res.json(p);
});

router.get('/:id/prescriptions', (req, res) => {
  const data = getStore();
  res.json(data.prescriptions.filter(pr => pr.patientId === +req.params.id));
});

router.post('/', (req, res) => {
  let created;
  updateStore(data => {
    created = {
      id: nextId(data, 'patient'),
      prescriptionCount: 0,
      recentVisits: new Date().toISOString().slice(0, 10),
      medicalHistory: [],
      allergies: [],
      ...req.body,
    };
    data.patients.push(created);
    if (created.customerId) {
      const cust = data.customers.find(c => c.id === created.customerId);
      if (cust && !cust.patientId) cust.patientId = created.id;
    }
  });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.patients.findIndex(p => p.id === +req.params.id);
    if (idx === -1) return;
    data.patients[idx] = { ...data.patients[idx], ...req.body, id: +req.params.id };
    updated = data.patients[idx];
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.patients = data.patients.filter(p => p.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
