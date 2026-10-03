const express = require('express');
const { sendError } = require('../security/rbac');
const {
  limitBody, validateBody, limiter, accessAudit, handle,
} = require('./aiHttp');
const S = require('../workflow/caseSchemas');
const service = require('../workflow/workflowService');
const repo = require('../workflow/workflowRepository');
const audit = require('../audit/auditRepository');
const facts = require('../workflow/clinicalFacts');
const { getUserById } = require('../security/auth');
const { findStorePatient, storeToWorkflow, syncPatientRecord } = require('../workflow/patientIdentity');

/**
 * Patient-facing API. Token routes are public but single-use, time-limited and case-scoped;
 * `/me/cases` needs a patient login and shows only that patient's own cases.
 */
const router = express.Router();

router.use(limitBody(16 * 1024));
router.use(limiter(Number(process.env.PATIENT_RATE_LIMIT_PER_MIN) || 30));
router.use(accessAudit('patient'));

router.get('/confirmation/:token', handle(async (req, res) => {
  res.json(service.getPatientConfirmation(req.params.token));
}));

router.post('/confirmation/:token', validateBody(S.PATIENT_CONFIRMATION), handle(async (req, res) => {
  res.json(await service.submitPatientConfirmation(req.params.token, req.body));
}));

router.post('/feedback/:token', validateBody(S.PATIENT_FEEDBACK), handle(async (req, res) => {
  res.json(service.submitPatientFeedback(req.params.token, req.body));
}));

router.get('/clarification/:token', handle(async (req, res) => {
  res.json(service.getClarification(req.params.token));
}));

router.post('/clarification/:token', validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['not_asked', 'unknown', 'none', 'reported', 'not_applicable'] },
    value: {},
    kind: { type: 'string', enum: ['add', 'stop', 'correct'] },
    oldValue: {},
  },
}), handle(async (req, res) => {
  res.json(await service.submitClarification(req.params.token, req.body));
}));

function resolvePatientRef(user) {
  if (!user || user.role !== 'patient') return null;
  if (user.patientRef) return user.patientRef;
  return getUserById(user.id)?.patientRef || null;
}

function profilePayload(req, patientRef) {
  const fromRepo = repo.getPatient(patientRef);
  const latestCase = repo.listCases().find((c) => c.patient?.patientRef === patientRef);
  const storePt = findStorePatient(patientRef);
  const raw = {
    ...(fromRepo || {}),
    ...(latestCase?.patient || {}),
    ...(storePt ? storeToWorkflow(storePt) : {}),
    patientRef,
    name: (storePt && storePt.name) || fromRepo?.name || latestCase?.patient?.name || req.user.name,
    phone: (storePt && storePt.phone) || fromRepo?.phone || latestCase?.patient?.phone,
    ageYears: storePt?.age ?? latestCase?.patient?.ageYears ?? fromRepo?.ageYears,
    allergies: storePt?.allergies || latestCase?.patient?.allergies,
    medicalHistory: storePt?.medicalHistory || latestCase?.patient?.medicalHistory,
  };
  return {
    patientRef,
    profile: facts.attachFacts(raw),
    store: storePt ? {
      id: storePt.id,
      name: storePt.name,
      gender: storePt.gender || null,
      age: storePt.age ?? null,
      phone: storePt.phone || null,
      address: storePt.address || null,
      medicalHistory: storePt.medicalHistory || [],
      allergies: storePt.allergies || [],
    } : null,
    identityVerifiedProfessionally: false,
  };
}

router.get('/me/profile', handle(async (req, res) => {
  const patientRef = resolvePatientRef(req.user);
  if (!patientRef) return sendError(res, 403, 'forbidden', 'Patient login required');
  res.json(profilePayload(req, patientRef));
}));

router.patch('/me/profile', handle(async (req, res) => {
  const patientRef = resolvePatientRef(req.user);
  if (!patientRef) return sendError(res, 403, 'forbidden', 'Patient login required');
  const storePt = findStorePatient(patientRef);
  if (!storePt) return sendError(res, 404, 'patient_not_found', 'No synthetic patient is bound to this login');
  const out = syncPatientRecord(storePt.id, req.body);
  res.json({ ...profilePayload(req, patientRef), synced: out.synced });
}));

function requirePatient(req, res) {
  const patientRef = resolvePatientRef(req.user);
  if (!patientRef) {
    sendError(res, 403, 'forbidden', 'Patient login required');
    return null;
  }
  return { role: 'patient', id: req.user.id, name: req.user.name, patientRef };
}

router.get('/me/cases', handle(async (req, res) => {
  const actor = requirePatient(req, res);
  if (!actor) return;
  const mine = repo.listCases().filter((c) => c.patient?.patientRef === actor.patientRef);
  res.json({
    cases: mine.map((c) => ({
      ...service.patientCaseDto(c),
      events: audit.forCase(c.caseId, { audience: 'patient' }),
    })),
  });
}));

router.get('/me/cases/:id', handle(async (req, res) => {
  const actor = requirePatient(req, res);
  if (!actor) return;
  res.json({ case: service.getOwnCase(req.params.id, actor) });
}));

router.post('/me/cases/:id/confirm', validateBody(S.PATIENT_CONFIRMATION), handle(async (req, res) => {
  const actor = requirePatient(req, res);
  if (!actor) return;
  res.json(await service.submitOwnConfirmation(req.params.id, req.body, actor));
}));

router.post('/me/cases/:id/clarifications/:taskId', validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['not_asked', 'unknown', 'none', 'reported', 'not_applicable'] },
    value: {},
    kind: { type: 'string', enum: ['add', 'stop', 'correct'] },
    oldValue: {},
  },
}), handle(async (req, res) => {
  const actor = requirePatient(req, res);
  if (!actor) return;
  res.json(await service.submitOwnClarification(req.params.id, req.params.taskId, req.body, actor));
}));

router.post('/me/cases/:id/feedback', validateBody(S.PATIENT_FEEDBACK), handle(async (req, res) => {
  const actor = requirePatient(req, res);
  if (!actor) return;
  res.json(service.submitOwnFeedback(req.params.id, req.body, actor));
}));

module.exports = router;
