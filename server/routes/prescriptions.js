const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { analyzePrescription } = require('../services/prescriptionAnalyzer');
const {
  generatePickupCode,
  buildBillingPrefill,
  appendTimeline,
  canTransition,
} = require('../services/prescriptionWorkflow');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, patientId } = req.query;
  let list = getStore().prescriptions;
  if (status) list = list.filter(p => p.status === status);
  if (patientId) list = list.filter(p => p.patientId === +patientId);
  res.json(list);
});

router.get('/pickup/queue', (req, res) => {
  const list = getStore().prescriptions.filter(p =>
    ['已审核', '配药中', '待取药'].includes(p.status)
  );
  res.json(list);
});

router.get('/pickup/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const prescription = getStore().prescriptions.find(p =>
    p.pickupCode?.toUpperCase() === code
  );
  if (!prescription) return res.status(404).json({ message: '取药码无效或已过期' });
  const store = getStore();
  res.json({
    prescription,
    prefill: buildBillingPrefill(prescription, store),
    patient: store.patients.find(p => p.id === prescription.patientId) || null,
  });
});

router.post('/analyze', (req, res) => {
  res.json(analyzePrescription(req.body));
});

router.get('/:id/billing-prefill', (req, res) => {
  const prescription = getStore().prescriptions.find(x => x.id === +req.params.id);
  if (!prescription) return res.status(404).json({ message: '未找到处方' });
  res.json(buildBillingPrefill(prescription, getStore()));
});

router.get('/:id', (req, res) => {
  const p = getStore().prescriptions.find(x => x.id === +req.params.id);
  if (!p) return res.status(404).json({ message: '未找到' });
  res.json(p);
});

router.post('/', (req, res) => {
  let created;
  updateStore(data => {
    const analysis = req.body.prescriptionText
      ? analyzePrescription({
          prescription: req.body.prescriptionText,
          patientAge: req.body.patientAge,
          patientGender: req.body.patientGender,
          diagnosis: req.body.diagnosis,
        })
      : null;

    created = {
      id: nextId(data, 'prescription'),
      date: new Date().toISOString().slice(0, 10),
      status: '待审核',
      herbs: req.body.herbs || [],
      timeline: appendTimeline({}, '待审核', req.body.doctor || '医生', '处方已提交'),
      ...req.body,
    };

    if (analysis) {
      created.reviewScore = analysis.score;
      created.warnings = analysis.warnings;
      created.analysisSummary = analysis.summary;
      if (analysis.status === '已通过') {
        created.status = '已审核';
        created.pickupCode = generatePickupCode(data.prescriptions);
        created.timeline = appendTimeline(created, '已审核', 'AI审方', `自动审方通过 · 评分 ${analysis.score}`);
      }
    }

    if (created.status === '已审核' && !created.pickupCode) {
      created.pickupCode = generatePickupCode(data.prescriptions);
      created.status = '待取药';
      created.timeline = appendTimeline(created, '待取药', req.body.reviewer || '药师', '已生成取药码');
    }

    data.prescriptions.unshift(created);
    const patient = data.patients.find(p => p.id === created.patientId);
    if (patient) patient.prescriptionCount = (patient.prescriptionCount || 0) + 1;
  });
  res.status(201).json(created);
});

router.post('/:id/approve', (req, res) => {
  let updated;
  try {
    updateStore(data => {
      const idx = data.prescriptions.findIndex(p => p.id === +req.params.id);
      if (idx === -1) return;
      const rx = data.prescriptions[idx];
      if (!['待审核', '已审核', '配药中'].includes(rx.status)) {
        throw new Error(`状态「${rx.status}」不可审核发码`);
      }
      const pickupCode = rx.pickupCode || generatePickupCode(data.prescriptions);
      updated = {
        ...rx,
        status: '待取药',
        pickupCode,
        reviewer: req.body.reviewer || '药师',
        reviewScore: req.body.reviewScore ?? rx.reviewScore,
        approvedAt: new Date().toISOString(),
        timeline: appendTimeline(rx, '待取药', req.body.reviewer || '药师', '审方通过，已生成取药码'),
      };
      data.prescriptions[idx] = updated;
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  if (!updated) return res.status(404).json({ message: '未找到处方' });
  res.json(updated);
});

router.post('/:id/dispense', (req, res) => {
  let updated;
  try {
    updateStore(data => {
      const idx = data.prescriptions.findIndex(p => p.id === +req.params.id);
      if (idx === -1) return;
      const rx = data.prescriptions[idx];
      if (!canTransition(rx.status, '配药中') && rx.status !== '待取药') {
        if (rx.status === '已审核') {
          /* allow */
        } else throw new Error(`状态 ${rx.status} 不可开始配药`);
      }
      updated = {
        ...rx,
        status: '配药中',
        timeline: appendTimeline(rx, '配药中', req.body.actor || '药师', '开始配药'),
      };
      data.prescriptions[idx] = updated;
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.post('/:id/ready', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.prescriptions.findIndex(p => p.id === +req.params.id);
    if (idx === -1) return;
    const rx = data.prescriptions[idx];
    updated = {
      ...rx,
      status: '待取药',
      timeline: appendTimeline(rx, '待取药', req.body.actor || '药师', '配药完成，等待患者取药'),
    };
    data.prescriptions[idx] = updated;
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore(data => {
    const idx = data.prescriptions.findIndex(p => p.id === +req.params.id);
    if (idx === -1) return;
    data.prescriptions[idx] = { ...data.prescriptions[idx], ...req.body, id: +req.params.id };
    updated = data.prescriptions[idx];
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore(data => {
    data.prescriptions = data.prescriptions.filter(p => p.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
