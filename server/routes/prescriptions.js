/**
 * Compatibility layer for historical /api/prescriptions clients.
 * Authoritative state lives in workflowService / prescriptionStateMachine.
 * Request bodies cannot set actor, reviewer, role, status, pickupCode or approval.
 */
const express = require('express');
const { getStore, updateStore } = require('../data/store');
const { analyzePrescription } = require('../services/prescriptionAnalyzer');
const cdssEngine = require('../services/cdssEngine');
const { buildBillingPrefill } = require('../services/prescriptionWorkflow');
const { requirePermission, sendError, requirePharmacistCredential } = require('../security/rbac');
const service = require('../workflow/workflowService');
const repo = require('../workflow/workflowRepository');
const { ServiceError } = require('../workflow/errors');

const router = express.Router();

const FORBIDDEN_CLIENT_FIELDS = ['id', 'status', 'pickupCode', 'reviewer', 'reviewerId', 'approvedAt', 'timeline', 'reviewScore', 'actor', 'role', 'approval', 'state'];

function stripClient(body) {
  const out = { ...(body || {}) };
  for (const k of FORBIDDEN_CLIENT_FIELDS) delete out[k];
  return out;
}

function actorOf(req) {
  return { role: req.user.role, id: req.user.id, name: req.user.name };
}

function wrap(err, res) {
  if (err instanceof ServiceError) return sendError(res, err.status, err.code, err.message, err.details);
  throw err;
}

const STATE_TO_LEGACY = {
  received: '待审核', information_incomplete: '待审核', ai_screening: '待审核', pharmacist_review_required: '待审核',
  pharmacist_approved: '已审核', pharmacist_rejected: '已驳回', returned_to_prescriber: '待医师处理',
  patient_confirmation_required: '已审核', patient_confirmed: '已审核', patient_declined: '已驳回',
  dispensing: '配药中', pharmacist_final_check: '配药中', ready_for_pickup: '待取药', completed: '已完成',
};

function caseToLegacy(c) {
  const a = c.analyses?.at(-1)?.output;
  return {
    id: c.legacyPrescriptionId || c.caseId,
    caseId: c.caseId,
    patientId: c.patient?.legacyPatientId || undefined,
    patientName: c.patient?.name,
    patientAge: c.patient?.ageYears,
    patientGender: c.patient?.sex === 'male' ? '男' : c.patient?.sex === 'female' ? '女' : undefined,
    doctor: c.prescriber?.name,
    diagnosis: c.prescription?.diagnosisText,
    herbs: c.prescription?.herbs || [],
    prescriptionText: (c.prescription?.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}${h.unit || 'g'}`).join('，'),
    date: (c.createdAt || '').slice(0, 10),
    status: STATE_TO_LEGACY[c.state] || c.state,
    pickupCode: null,
    readyForPickup: c.state === 'ready_for_pickup',
    synthetic: Boolean(c.synthetic),
    dataMode: c.dataMode,
    riskTier: a?.riskTier || null,
    workflow: 'case',
  };
}

function findCase(id) {
  const byId = repo.getCase(id);
  if (byId) return byId;
  const asNum = Number(id);
  return repo.listCases().find((c) => c.legacyPrescriptionId === asNum) || null;
}

function unmigrated() {
  return (getStore().prescriptions || []).filter((p) => !p.caseId && !p.migratedToCaseId);
}

router.get('/', requirePermission('legacy_rx:read'), (req, res) => {
  const { status, patientId } = req.query;
  let list = repo.listCases().map(caseToLegacy).concat(unmigrated());
  if (req.user.role === 'prescriber') {
    list = list.filter((p) => p.workflow === 'case' && findCase(p.caseId)?.createdBy?.id === String(req.user.id));
  }
  if (status) list = list.filter((p) => p.status === status);
  if (patientId) list = list.filter((p) => p.patientId === +patientId);
  res.json(list);
});

router.get('/pickup/queue', requirePermission('legacy_rx:read'), (req, res) => {
  const list = repo.listCases().filter((c) => ['ready_for_pickup', 'dispensing', 'pharmacist_final_check', 'patient_confirmed'].includes(c.state)).map(caseToLegacy);
  res.json(list);
});

router.get('/pickup/:code', (req, res) => {
  return sendError(res, 410, 'pickup_retired', 'Public pickup-code lookup no longer returns patient or prescription records. Use a short-lived server pickup token via POST /api/pickup/redeem.');
});

router.post('/analyze', requirePermission('legacy_rx:read'), (req, res) => {
  res.json(analyzePrescription(stripClient(req.body)));
});

router.post('/cdss', requirePermission('legacy_rx:read'), (req, res) => {
  res.json(cdssEngine.analyzePrescription(stripClient(req.body)));
});

router.get('/:id/billing-prefill', requirePermission('legacy_rx:read'), (req, res) => {
  const c = findCase(req.params.id);
  if (c) {
    return res.json({
      caseId: c.caseId,
      herbs: (c.prescription.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage })),
      note: 'Billing prefill from unified case; no patient identifiers included',
    });
  }
  const prescription = getStore().prescriptions.find((x) => x.id === +req.params.id);
  if (!prescription) return res.status(404).json({ message: '未找到处方' });
  res.json(buildBillingPrefill(prescription, getStore()));
});

router.get('/:id', requirePermission('legacy_rx:read'), (req, res) => {
  const c = findCase(req.params.id);
  if (c) return res.json(caseToLegacy(c));
  const p = getStore().prescriptions.find((x) => x.id === +req.params.id);
  if (!p) return res.status(404).json({ message: '未找到' });
  res.json(p);
});

router.post('/', requirePermission('legacy_rx:create'), async (req, res) => {
  try {
    const body = stripClient(req.body);
    const herbs = (body.herbs || []).map((h) => ({
      name: h.name, dosage: parseFloat(String(h.dosage)) || null, unit: 'g',
    }));
    const sex = { 男: 'male', 女: 'female' }[body.patientGender] || 'unknown';
    const created = service.createCase({
      source: { channel: 'legacy_api', rawText: body.prescriptionText || '' },
      patient: {
        name: body.patientName, ageYears: body.patientAge, sex, legacyPatientId: body.patientId,
      },
      prescriber: { name: req.user.name, userId: String(req.user.id) },
      prescription: { herbs, diagnosisText: body.diagnosis, usage: body.usage },
    }, actorOf(req));
    const screened = await service.analyze(created.caseId);
    res.status(201).json(caseToLegacy(screened.case));
  } catch (err) {
    wrap(err, res);
  }
});

router.post('/:id/approve', requirePermission('legacy_rx:approve'), requirePharmacistCredential, (req, res) => {
  try {
    const c = findCase(req.params.id);
    if (!c) return sendError(res, 409, 'unmigrated', 'This historical prescription must be migrated into the unified case workflow before pharmacist sign-off');
    const analysisId = c.analyses.at(-1)?.analysisId;
    const out = service.pharmacistDecision(c.caseId, { action: 'approve', analysisId, comment: '兼容层提交药师审核签署' }, actorOf(req));
    res.json(caseToLegacy(out.case));
  } catch (err) {
    wrap(err, res);
  }
});

router.post('/:id/dispense', requirePermission('legacy_rx:dispense'), (req, res) => {
  try {
    const c = findCase(req.params.id);
    if (!c) return sendError(res, 409, 'unmigrated', 'Migrate this prescription before dispensing');
    const out = service.dispensingAction(c.caseId, { action: 'start' }, actorOf(req));
    res.json(caseToLegacy(out));
  } catch (err) {
    wrap(err, res);
  }
});

router.post('/:id/ready', requirePermission('rx:final_check'), requirePharmacistCredential, (req, res) => {
  try {
    const c = findCase(req.params.id);
    if (!c) return sendError(res, 409, 'unmigrated', 'Migrate this prescription before release');
    const out = service.dispensingAction(c.caseId, { action: 'final_check_pass', note: '兼容层复核' }, actorOf(req));
    res.json({ ...caseToLegacy(out), pickup: out.__pickup || null });
  } catch (err) {
    wrap(err, res);
  }
});

router.put('/:id', requirePermission('legacy_rx:update'), async (req, res) => {
  try {
    if (req.user.role === 'technician') {
      return sendError(res, 403, 'clinical_content_forbidden', 'Technicians cannot change diagnosis, herbs, dosage or usage');
    }
    const body = stripClient(req.body);
    const c = findCase(req.params.id);
    if (!c) return sendError(res, 409, 'unmigrated', 'Migrate this prescription before editing');
    const patch = { reason: 'legacy_api_update' };
    if (body.diagnosis || body.herbs || body.prescriptionText || body.usage) {
      patch.prescription = {
        ...(body.diagnosis ? { diagnosisText: body.diagnosis } : {}),
        ...(body.usage ? { usage: body.usage } : {}),
        ...(body.herbs ? { herbs: body.herbs.map((h) => ({ name: h.name, dosage: parseFloat(String(h.dosage)) || null, unit: 'g' })) } : {}),
      };
    }
    if (body.patientAge || body.patientGender || body.patientName) {
      patch.patient = {
        ...(body.patientName ? { name: body.patientName } : {}),
        ...(body.patientAge ? { ageYears: body.patientAge } : {}),
        ...(body.patientGender ? { sex: { 男: 'male', 女: 'female' }[body.patientGender] || 'unknown' } : {}),
      };
    }
    const out = await service.updateContent(c.caseId, patch, actorOf(req));
    res.json(caseToLegacy(out.case));
  } catch (err) {
    wrap(err, res);
  }
});

router.delete('/:id', requirePermission('legacy_rx:delete'), (req, res) => {
  const c = findCase(req.params.id);
  if (c) return sendError(res, 409, 'cannot_delete_case', 'Unified cases are not deleted; reject or return them in the workflow');
  updateStore((data) => {
    data.prescriptions = data.prescriptions.filter((p) => p.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
