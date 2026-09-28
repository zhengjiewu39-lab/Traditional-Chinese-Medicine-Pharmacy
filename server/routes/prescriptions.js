const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { analyzePrescription } = require('../services/prescriptionAnalyzer');
const cdssEngine = require('../services/cdssEngine');
const {
  generatePickupCode,
  buildBillingPrefill,
  appendTimeline,
  canTransition,
} = require('../services/prescriptionWorkflow');

const { requirePermission } = require('../security/rbac');

const router = express.Router();

/** Workflow fields only the server sets; clients cannot submit them on create or update. */
const SERVER_OWNED_FIELDS = ['id', 'status', 'pickupCode', 'reviewer', 'approvedAt', 'timeline', 'reviewScore'];
const CONTENT_FIELDS = ['herbs', 'prescriptionText', 'patientId', 'patientAge', 'patientGender', 'diagnosis'];

function stripServerOwned(body) {
  const out = { ...(body || {}) };
  for (const k of SERVER_OWNED_FIELDS) delete out[k];
  return out;
}

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

router.post('/cdss', (req, res) => {
  res.json(cdssEngine.analyzePrescription(req.body));
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
  const body = stripServerOwned(req.body);
  updateStore(data => {
    const analysis = body.prescriptionText
      ? analyzePrescription({
          prescription: body.prescriptionText,
          patientAge: body.patientAge,
          patientGender: body.patientGender,
          diagnosis: body.diagnosis,
        })
      : null;

    created = {
      herbs: [],
      ...body,
      id: nextId(data, 'prescription'),
      date: new Date().toISOString().slice(0, 10),
      status: '待审核',
      timeline: appendTimeline({}, '待审核', body.doctor || '医生', '处方已提交'),
    };

    if (analysis) {
      created.reviewScore = analysis.score;
      created.warnings = analysis.warnings;
      created.analysisSummary = analysis.summary;
      created.timeline = appendTimeline(created, '待审核', '规则预审', `预审${analysis.status} · 评分 ${analysis.score}（需药师审核）`);
    }

    data.prescriptions.unshift(created);
    const patient = data.patients.find(p => p.id === created.patientId);
    if (patient) patient.prescriptionCount = (patient.prescriptionCount || 0) + 1;
  });
  res.status(201).json(created);
});

router.post('/:id/approve', requirePermission('legacy_rx:approve'), (req, res) => {
  let updated;
  const reviewer = req.user.name || req.user.username;
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
        reviewer,
        reviewerId: req.user.id,
        approvedAt: new Date().toISOString(),
        timeline: appendTimeline(rx, '待取药', reviewer, '药师审方通过，已生成取药码'),
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
    const before = data.prescriptions[idx];
    const patch = stripServerOwned(req.body);
    const next = { ...before, ...patch, id: +req.params.id };
    const contentChanged = CONTENT_FIELDS.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
    if (contentChanged && before.approvedAt && before.status !== '已完成') {
      next.status = '待审核';
      next.pickupCode = null;
      next.approvedAt = null;
      next.approvalInvalidatedAt = new Date().toISOString();
      next.timeline = appendTimeline(before, '待审核', req.user?.name || '系统', '处方内容已修改，原审核失效，需重新审核');
    }
    data.prescriptions[idx] = next;
    updated = next;
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
