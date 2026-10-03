const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');

const { refForStorePatient, syncPatientRecord, storeToWorkflow } = require('../workflow/patientIdentity');
const repo = require('../workflow/workflowRepository');
const { ServiceError } = require('../workflow/errors');

const router = express.Router();

function withRef(p) {
  return { ...p, patientRef: refForStorePatient(p) };
}

router.get('/', (req, res) => {
  const { q } = req.query;
  let patients = getStore().patients;
  if (q) {
    const term = q.toLowerCase();
    patients = patients.filter(p => p.name.includes(term) || p.phone.includes(term) || String(p.patientRef || `P${p.id}`).toLowerCase().includes(term));
  }
  res.json(patients.map(withRef));
});

router.get('/:id', (req, res) => {
  const p = getStore().patients.find(x => x.id === +req.params.id);
  if (!p) return res.status(404).json({ message: '未找到' });
  res.json(withRef(p));
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
    created.patientRef = refForStorePatient(created);
    data.patients.push(created);
    if (created.customerId) {
      const cust = data.customers.find(c => c.id === created.customerId);
      if (cust && !cust.patientId) cust.patientId = created.id;
    }
  });
  const wf = storeToWorkflow(created);
  repo.upsertPatient({
    patientRef: created.patientRef,
    name: created.name,
    phone: created.phone,
    sex: wf.sex,
    ageYears: created.age,
    allergies: created.allergies || [],
    medicalHistory: created.medicalHistory || [],
    legacyPatientId: String(created.id),
    legacyCustomerId: created.customerId != null ? String(created.customerId) : null,
    version: 1,
  });
  res.status(201).json(withRef(created));
});

router.put('/:id', (req, res) => {
  try {
    const out = syncPatientRecord(+req.params.id, req.body);
    res.json({ ...out.patient, synced: out.synced });
  } catch (err) {
    if (err instanceof ServiceError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.patients = data.patients.filter(p => p.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
