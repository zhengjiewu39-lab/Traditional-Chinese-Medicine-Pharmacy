const express = require('express');
const { requirePermission, sendError } = require('../security/rbac');
const {
  limitBody, validateBody, limiter, accessAudit, handle,
} = require('./aiHttp');
const S = require('../workflow/caseSchemas');
const service = require('../workflow/workflowService');
const repo = require('../workflow/workflowRepository');
const audit = require('../audit/auditRepository');
const runtime = require('../ai/aiRuntime');
const { PROVIDERS } = require('../ai/providerAdapter');
const { listPrompts } = require('../ai/promptRegistry');
const { ruleSetVersion } = require('../ai/ruleTrack');
const { listSources, knowledgeBaseVersion } = require('../knowledge/sourceRegistry');
const { computeGovernanceMetrics } = require('../ai/governanceMetrics');
const { analyzeOperations, draftProposal, ACTIONS } = require('../ai/operationsAgent');
const { evaluateProposal } = require('../ai/digitalTwinBridge');
const { randomId } = require('../common/hash');

const router = express.Router();

router.use(limitBody());
router.use(limiter(Number(process.env.AI_RATE_LIMIT_PER_MIN) || 120));
router.use(accessAudit('ai'));

const actorOf = (req) => ({ role: req.user.role, id: req.user.id, name: req.user.name });

function summary(c) {
  const a = c.analyses.at(-1)?.output;
  return {
    caseId: c.caseId,
    state: c.state,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    synthetic: c.synthetic,
    patientLabel: c.patient?.name ? `${String(c.patient.name).slice(0, 1)}**` : (c.patient?.patientRef || '未登记'),
    herbCount: c.prescription?.herbs?.length || 0,
    riskTier: a?.riskTier || null,
    recommendation: a?.recommendation || null,
    abstain: a?.abstain ?? null,
    hardStopCount: a?.hardStops.length || 0,
    alertCount: a?.alerts.length || 0,
    missingCritical: a ? a.missingInformation.filter((m) => m.critical).length : 0,
    approvalValid: Boolean(c.approval?.valid && c.approval.contentHash === c.contentHash),
    secondReviewPending: c.secondReview?.status === 'pending',
    patientDeclined: c.patientDeclined,
  };
}

// ---------------------------------------------------------------- cases

router.post('/cases', requirePermission('case:create'), validateBody(S.CREATE_CASE), handle(async (req, res) => {
  const c = service.createCase(req.body, actorOf(req));
  res.status(201).json({ case: c });
}));

router.get('/cases', requirePermission('case:read'), handle(async (req, res) => {
  const { state, riskTier } = req.query;
  res.json({ cases: repo.listCases({ state, riskTier }).map(summary) });
}));

router.get('/workbench/summary', requirePermission('case:read'), handle(async (req, res) => {
  const cases = repo.listCases();
  const today = new Date().toISOString().slice(0, 10);
  const by = (s) => cases.filter((c) => c.state === s).length;
  const ops = analyzeOperations();
  res.json({
    today: cases.filter((c) => c.createdAt.startsWith(today)).length,
    pendingReview: by('pharmacist_review_required'),
    a3: cases.filter((c) => c.analyses.at(-1)?.output.riskTier === 'A3' && !['completed', 'patient_declined', 'returned_to_prescriber', 'pharmacist_rejected'].includes(c.state)).length,
    informationIncomplete: by('information_incomplete'),
    awaitingPatient: by('patient_confirmation_required'),
    awaitingPrescriber: by('returned_to_prescriber'),
    toDispense: by('patient_confirmed') + by('dispensing'),
    toCheck: by('pharmacist_final_check'),
    readyForPickup: by('ready_for_pickup'),
    shortage: ops.summary.lowStock + ops.summary.nearMin,
    nearExpiry: ops.summary.nearExpiry,
    ai: runtime.describeRuntime(),
    auditChainValid: audit.verify().valid,
  });
}));

router.get('/cases/:id', requirePermission('case:read'), handle(async (req, res) => {
  const c = service.getCaseOr404(req.params.id);
  res.json({ case: c, summary: summary(c) });
}));

router.patch('/cases/:id', requirePermission('case:update_content'), validateBody(S.UPDATE_CONTENT), handle(async (req, res) => {
  const out = await service.updateContent(req.params.id, req.body, actorOf(req));
  res.json({ case: out.case, changed: out.changed, analysis: out.analysis?.output || null });
}));

router.post('/cases/:id/analyze', requirePermission('case:analyze'), validateBody({ type: 'object', additionalProperties: false, properties: {} }), handle(async (req, res) => {
  const out = await service.analyze(req.params.id);
  res.json({ case: summary(out.case), analysis: out.analysis.output });
}));

router.post('/cases/:id/pharmacist-decision', requirePermission('rx:review_decision'), validateBody(S.PHARMACIST_DECISION), handle(async (req, res) => {
  const out = service.pharmacistDecision(req.params.id, req.body, actorOf(req));
  res.json({ case: summary(out.case), decision: out.decision });
}));

router.post('/cases/:id/request-information', requirePermission('rx:request_information'), validateBody(S.REQUEST_INFORMATION), handle(async (req, res) => {
  const out = service.requestInformation(req.params.id, req.body, actorOf(req));
  res.json({ case: summary(out.case), decision: out.decision });
}));

router.post('/cases/:id/patient-confirmation', requirePermission('patient:issue_token'), validateBody({ type: 'object', additionalProperties: false, properties: {} }), handle(async (req, res) => {
  const out = service.issuePatientConfirmation(req.params.id, actorOf(req));
  res.status(201).json(out);
}));

router.post('/cases/:id/dispensing', requirePermission('rx:dispense'), validateBody(S.DISPENSING_ACTION), handle(async (req, res) => {
  const c = service.dispensingAction(req.params.id, req.body, actorOf(req));
  res.json({ case: summary(c), dispensingRecords: c.dispensingRecords });
}));

router.get('/cases/:id/audit', requirePermission('case:audit_read'), handle(async (req, res) => {
  service.getCaseOr404(req.params.id);
  res.json({ events: audit.forCase(req.params.id), chain: audit.verify() });
}));

router.post('/cases/:id/replay', requirePermission('case:replay'), validateBody({ type: 'object', additionalProperties: false, properties: { analysisId: { type: 'string', maxLength: 80 } } }), handle(async (req, res) => {
  res.json(await service.replay(req.params.id, req.body.analysisId, actorOf(req)));
}));

// ---------------------------------------------------------------- models, knowledge, governance

router.get('/models', requirePermission('ai:models_read'), handle(async (req, res) => {
  res.json({ runtime: runtime.describeRuntime(), providers: PROVIDERS, prompts: listPrompts(), ruleSetVersion: ruleSetVersion(), knowledgeBaseVersion: knowledgeBaseVersion() });
}));

router.get('/knowledge/sources', requirePermission('ai:knowledge_read'), handle(async (req, res) => {
  res.json({ knowledgeBaseVersion: knowledgeBaseVersion(), sources: listSources() });
}));

router.get('/governance/metrics', requirePermission('ai:governance_read'), handle(async (req, res) => {
  res.json(computeGovernanceMetrics());
}));

router.post('/governance/kill-switch', requirePermission('ai:kill_switch'), validateBody({
  type: 'object', additionalProperties: false, required: ['enabled', 'reason'], properties: { enabled: { type: 'boolean' }, reason: { type: 'string', minLength: 1, maxLength: 300 } },
}), handle(async (req, res) => {
  runtime.setAiEnabled(req.body.enabled);
  audit.append({ eventType: req.body.enabled ? 'ai_enabled' : 'ai_kill_switch', actorType: 'admin', actorId: req.user.id, payload: { enabled: req.body.enabled, reason: req.body.reason } });
  res.json({ aiEnabled: runtime.isAiEnabled() });
}));

// ---------------------------------------------------------------- operations agent

router.get('/operations/analysis', requirePermission('ops:read'), handle(async (req, res) => {
  res.json(analyzeOperations());
}));

router.get('/operations/proposals', requirePermission('ops:read'), handle(async (req, res) => {
  res.json({ proposals: repo.proposals().list(), purchaseDrafts: repo.purchaseDrafts() });
}));

router.post('/operations/proposals', requirePermission('ops:propose'), validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS },
    inventoryIds: { type: 'array', maxItems: 20, items: { type: 'integer', minimum: 1 } },
    note: { type: 'string', maxLength: 300 },
  },
}), handle(async (req, res) => {
  const p = { ...draftProposal(req.body), createdBy: String(req.user.id) };
  repo.proposals().put(p);
  audit.append({ eventType: 'ops_proposal_drafted', actorType: 'ai', actorId: 'operations-agent', payload: { proposalId: p.proposalId, action: p.action, items: p.items.length, requestedBy: req.user.id } });
  res.status(201).json({ proposal: p });
}));

router.post('/operations/proposals/:id/simulate', requirePermission('ops:simulate'), validateBody({
  type: 'object', additionalProperties: false, properties: { replicates: { type: 'integer', minimum: 1, maximum: 20 } },
}), handle(async (req, res) => {
  const p = repo.proposals().get(req.params.id);
  if (!p) return sendError(res, 404, 'proposal_not_found', 'Proposal not found');
  if (p.status !== 'draft' && p.status !== 'simulated') return sendError(res, 409, 'invalid_state', `Proposal is ${p.status}`);
  const evaluation = evaluateProposal(p, { replicates: req.body.replicates });
  const next = { ...p, digitalTwinEvaluation: evaluation, status: 'simulated' };
  repo.proposals().put(next);
  audit.append({ eventType: 'ops_proposal_simulated', actorType: 'system', actorId: 'digital-twin', payload: { proposalId: p.proposalId, scenarioHash: evaluation.scenarioHash, difference: evaluation.difference } });
  return res.json({ proposal: next });
}));

router.post('/operations/proposals/:id/approve', requirePermission('ops:approve'), validateBody({
  type: 'object', additionalProperties: false, required: ['decision', 'comment'], properties: { decision: { type: 'string', enum: ['approve', 'reject'] }, comment: { type: 'string', minLength: 1, maxLength: 500 } },
}), handle(async (req, res) => {
  const p = repo.proposals().get(req.params.id);
  if (!p) return sendError(res, 404, 'proposal_not_found', 'Proposal not found');
  if (p.status !== 'simulated') return sendError(res, 409, 'simulation_required', 'Run the digital-twin evaluation before approval');
  const at = new Date().toISOString();
  let draft = null;
  if (req.body.decision === 'approve' && p.action !== 'hold') {
    draft = repo.addPurchaseDraft({
      docId: randomId(p.action === 'transfer' ? 'xfer' : 'po'),
      type: p.action === 'transfer' ? 'transfer_draft' : p.action === 'expedite' ? 'expedite_request_draft' : 'purchase_order_draft',
      proposalId: p.proposalId,
      items: p.items,
      status: 'draft_pending_execution',
      approvedBy: String(req.user.id),
      approvedRole: req.user.role,
      approvedAt: at,
      note: '草稿单据：需在库存/采购模块由员工执行；系统不会自动修改库存',
      synthetic: true,
    });
  }
  const next = {
    ...p, status: req.body.decision === 'approve' ? 'approved' : 'rejected', decidedBy: String(req.user.id), decidedRole: req.user.role, decidedAt: at, decisionComment: req.body.comment, draftDocId: draft?.docId || null,
  };
  repo.proposals().put(next);
  audit.append({ eventType: 'ops_proposal_decided', actorType: req.user.role, actorId: req.user.id, payload: { proposalId: p.proposalId, decision: req.body.decision, draftDocId: draft?.docId || null } });
  return res.json({ proposal: next, draft });
}));

module.exports = router;
