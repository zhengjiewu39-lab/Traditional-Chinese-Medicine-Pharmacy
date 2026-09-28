const express = require('express');
const { sendError } = require('../security/rbac');
const {
  limitBody, validateBody, limiter, accessAudit, handle,
} = require('./aiHttp');
const S = require('../workflow/caseSchemas');
const service = require('../workflow/workflowService');
const repo = require('../workflow/workflowRepository');
const audit = require('../audit/auditRepository');

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

router.get('/me/cases', handle(async (req, res) => {
  if (req.user?.role !== 'patient' || !req.user.patientRef) return sendError(res, 403, 'forbidden', 'Patient login required');
  const mine = repo.listCases().filter((c) => c.patient?.patientRef === req.user.patientRef);
  res.json({
    cases: mine.map((c) => ({ ...service.patientView(c), events: audit.forCase(c.caseId, { audience: 'patient' }) })),
  });
}));

module.exports = router;
