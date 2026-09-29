const express = require('express');
const { requirePermission, sendError, requirePharmacistCredential } = require('../security/rbac');
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
const draftService = require('../workflow/draftService');
const suggestionService = require('../workflow/suggestionService');
const learning = require('../workflow/learningLoop');
const { migrateLegacyPrescriptions } = require('../workflow/legacyMigrate');
const { issuePickupToken } = require('../workflow/pickupService');

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
    priority: service.isPriorityReview(c),
    displaySource: a?.displaySource || null,
  };
}

// ---------------------------------------------------------------- cases

router.post('/cases', requirePermission('case:create'), validateBody(S.CREATE_CASE), handle(async (req, res) => {
  const c = service.createCase(req.body, actorOf(req));
  res.status(201).json({ case: c });
}));

router.get('/cases', requirePermission('case:read'), handle(async (req, res) => {
  const { state, riskTier } = req.query;
  let list = repo.listCases({ state, riskTier });
  if (req.user.role === 'prescriber') {
    list = list.filter((c) => c.createdBy?.id === String(req.user.id) || c.prescriber?.userId === String(req.user.id));
  }
  res.json({ cases: list.map(summary) });
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
    priorityReview: service.reviewQueue().priority.length,
    batchReview: service.reviewQueue().batch.length,
    shortage: ops.summary.lowStock + ops.summary.nearMin,
    nearExpiry: ops.summary.nearExpiry,
    ai: runtime.describeRuntime(),
    auditChainValid: audit.verify().valid,
  });
}));

router.get('/cases/:id', requirePermission('case:read'), handle(async (req, res) => {
  const c = service.getCaseOr404(req.params.id);
  if (req.user.role === 'prescriber' && c.createdBy?.id !== String(req.user.id) && c.prescriber?.userId !== String(req.user.id)) {
    return sendError(res, 403, 'not_own_case', 'Prescribers may only view their own cases');
  }
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

router.post('/cases/:id/pharmacist-decision', requirePermission('rx:review_decision'), requirePharmacistCredential, validateBody(S.PHARMACIST_DECISION), handle(async (req, res) => {
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

router.get('/runtime', requirePermission('case:read'), handle(async (req, res) => {
  const { publicView } = require('../ai/runtimeConfig');
  res.json({ runtime: runtime.describeRuntime(), local: publicView() });
}));

router.post('/runtime/provider', requirePermission('ai:runtime_configure'), validateBody({
  type: 'object',
  additionalProperties: false,
  properties: {
    preset: { type: 'string', enum: ['openai', 'deepseek', 'ollama', 'custom'] },
    baseUrl: { type: 'string', maxLength: 300 },
    model: { type: 'string', maxLength: 120 },
    apiKey: { type: 'string', maxLength: 512 },
    timeoutMs: { type: 'integer', minimum: 3000, maximum: 120000 },
    dataResidency: { type: 'string', enum: ['on-prem', 'external'] },
    aiMode: { type: 'string', enum: ['shadow', 'live'] },
  },
}), handle(async (req, res) => {
  const cfg = require('../ai/runtimeConfig');
  const view = cfg.saveRuntimeProvider(req.body);
  runtime.reloadProvider();
  audit.append({
    eventType: 'ai_provider_configured',
    actorType: req.user.role,
    actorId: req.user.id,
    payload: {
      provider: 'openai-compatible',
      model: view.model,
      endpointHost: view.endpointHost,
      apiKeyConfigured: view.apiKeyConfigured,
      dataResidency: view.dataResidency,
    },
  });
  res.json({ local: view, runtime: runtime.describeRuntime() });
}));

router.post('/runtime/promote-live', requirePermission('ai:runtime_configure'), validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['pharmacistApproverId', 'modelId'],
  properties: {
    modelId: { type: 'string', minLength: 1, maxLength: 80 },
    pharmacistApproverId: { type: 'string', minLength: 1, maxLength: 40 },
    reason: { type: 'string', maxLength: 300 },
  },
}), handle(async (req, res) => {
  const promoted = learning.setModelStatus(req.body.modelId, 'live', actorOf(req), req.body.reason, {
    pharmacistApproverId: req.body.pharmacistApproverId,
  });
  const cfg = require('../ai/runtimeConfig');
  const view = cfg.promoteRuntimeToLive();
  runtime.reloadProvider();
  audit.append({
    eventType: 'ai_mode_promoted_live',
    actorType: req.user.role,
    actorId: req.user.id,
    payload: { modelId: promoted.modelId, pharmacistApproverId: promoted.pharmacistApproverId },
  });
  res.json({ model: promoted, local: view, runtime: runtime.describeRuntime() });
}));

router.post('/runtime/test', requirePermission('ai:runtime_configure'), handle(async (req, res) => {
  const provider = runtime.getProvider();
  if (!provider) return res.json({ ok: false, isMock: false, message: '未配置模型' });
  if (provider.isMock) return res.json({ ok: true, isMock: true, message: '当前仍是模拟模型，请填写兼容接口和密钥后保存' });
  const started = Date.now();
  const timeout = Math.max(runtime.timeoutMs() || 45000, 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const raw = await provider.complete({
      messages: [{ role: 'user', content: 'Reply with JSON {"ok":true} and nothing else.' }],
      signal: controller.signal,
    });
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    res.json({
      ok: true,
      isMock: false,
      model: provider.modelVersion,
      latencyMs: Date.now() - started,
      requestId: provider.lastMeta?.requestId || null,
      json: Boolean(parsed),
    });
  } catch (err) {
    const aborted = err.name === 'AbortError';
    res.status(502).json({
      error: {
        code: aborted ? 'provider_test_timeout' : 'provider_test_failed',
        message: aborted
          ? `真实模型在 ${timeout}ms 内没有响应。请检查网络能否访问该接口，或换用 DeepSeek / 本地 Ollama。`
          : (err.message || '真实模型调用失败，已保持规则引擎可用'),
        detail: err.message,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}));

router.get('/knowledge/sources', requirePermission('ai:knowledge_read'), handle(async (req, res) => {
  const reg = require('../knowledge/sourceRegistry').loadRegistry();
  res.json({
    knowledgeBaseVersion: knowledgeBaseVersion(),
    sources: listSources(),
    bases: reg.bases.map((b) => ({
      knowledgeBaseId: b.knowledgeBaseId,
      version: b.version,
      disclaimer: b.disclaimer,
      synthetic: b.synthetic,
      clinicalUse: b.clinicalUse,
      clinicalLabel: b.clinicalUse ? '已审核临床知识源' : '合成知识库，不得用于临床',
    })),
  });
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

router.get('/review-queue', requirePermission('rx:review_decision'), handle(async (req, res) => {
  res.json(service.reviewQueue());
}));

router.post('/governance/sampling', requirePermission('ai:governance_read'), validateBody({
  type: 'object',
  additionalProperties: false,
  properties: {
    rate: { type: 'number', minimum: 0.01, maximum: 1 },
    seed: { type: 'string', maxLength: 80 },
  },
}), handle(async (req, res) => {
  res.json(service.sampleLowRisk(actorOf(req), { rate: req.body.rate || 0.1, seed: req.body.seed }));
}));

router.post('/legacy/migrate', requirePermission('ai:kill_switch'), validateBody({
  type: 'object', additionalProperties: false, properties: { analyzeAfter: { type: 'boolean' } },
}), handle(async (req, res) => {
  res.json(await migrateLegacyPrescriptions(actorOf(req), { analyzeAfter: Boolean(req.body.analyzeAfter) }));
}));

router.post('/cases/:id/pickup-token', requirePermission('rx:pickup_issue'), handle(async (req, res) => {
  res.status(201).json(issuePickupToken(req.params.id, actorOf(req)));
}));

// ---------------------------------------------------------------- drafts (server-side prescription drafts; AI has no write access)

router.post('/drafts', requirePermission('draft:create'), validateBody(S.CREATE_DRAFT), handle(async (req, res) => {
  res.status(201).json({ draft: draftService.createDraft(req.body, actorOf(req)) });
}));

router.get('/drafts', requirePermission('draft:read'), handle(async (req, res) => {
  const { listDrafts } = require('../workflow/workflowRepository');
  const filter = req.user.role === 'prescriber' ? { createdById: req.user.id } : {};
  res.json({ drafts: listDrafts(filter) });
}));

router.get('/drafts/:id', requirePermission('draft:read'), handle(async (req, res) => {
  const d = draftService.getOr404(req.params.id);
  draftService.assertOwner(d, actorOf(req));
  res.json({ draft: d, suggestions: require('../workflow/workflowRepository').listSuggestions({ draftId: d.draftId }) });
}));

router.patch('/drafts/:id', requirePermission('draft:update'), validateBody(S.PATCH_DRAFT), handle(async (req, res) => {
  res.json(draftService.patchDraft(req.params.id, req.body, actorOf(req)));
}));

router.post('/drafts/:id/analyze', requirePermission('draft:analyze'), validateBody({ type: 'object', additionalProperties: false, properties: {} }), handle(async (req, res) => {
  const out = await draftService.analyzeDraft(req.params.id, actorOf(req));
  res.json(out);
}));

router.get('/drafts/:id/suggestions', requirePermission('draft:read'), handle(async (req, res) => {
  const d = draftService.getOr404(req.params.id);
  draftService.assertOwner(d, actorOf(req));
  res.json({ suggestions: require('../workflow/workflowRepository').listSuggestions({ draftId: d.draftId }) });
}));

router.post('/drafts/:id/suggestions/:suggestionId/disposition', requirePermission('draft:update'), validateBody(S.SUGGESTION_DISPOSITION), handle(async (req, res) => {
  res.json(draftService.disposeSuggestion(req.params.id, req.params.suggestionId, req.body, actorOf(req)));
}));

router.post('/drafts/:id/submit', requirePermission('draft:submit'), validateBody({ type: 'object', additionalProperties: false, properties: {} }), handle(async (req, res) => {
  const out = await draftService.submitDraft(req.params.id, actorOf(req));
  res.status(201).json(out);
}));

router.get('/suggestions', requirePermission('ai:governance_read'), handle(async (req, res) => {
  res.json({ suggestions: require('../workflow/workflowRepository').listSuggestions(), metrics: suggestionService.metrics() });
}));

router.post('/suggestions/:id/pharmacist-view', requirePermission('rx:review_decision'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false, required: ['agrees'], properties: { agrees: { type: 'boolean' } },
}), handle(async (req, res) => {
  res.json({ suggestion: suggestionService.markPharmacistView(req.params.id, actorOf(req), req.body.agrees) });
}));

// ---------------------------------------------------------------- learning loop (export / label / registry only — no training)

router.post('/learning/export', requirePermission('ai:learning_export'), handle(async (req, res) => {
  res.json(learning.exportCandidates(actorOf(req)));
}));

router.post('/learning/labels', requirePermission('ai:learning_review'), requirePharmacistCredential, validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['suggestionId', 'label'],
  properties: {
    suggestionId: { type: 'string', minLength: 1, maxLength: 80 },
    datasetId: { type: 'string', maxLength: 80 },
    label: { type: 'string', enum: ['true_positive', 'false_positive', 'true_negative', 'false_negative', 'uncertain'] },
    risk: { type: 'string', enum: ['routine', 'high'] },
    secondReviewerId: { type: 'string', maxLength: 40 },
    comment: { type: 'string', maxLength: 500 },
  },
}), handle(async (req, res) => {
  res.status(201).json(learning.reviewLabel(req.body, actorOf(req)));
}));

router.get('/learning/models', requirePermission('ai:models_read'), handle(async (req, res) => {
  res.json({ models: require('../workflow/workflowRepository').learning().listModels(), note: 'Registry only. No weights are stored. Production must not claim the model has learned.' });
}));

router.post('/learning/models', requirePermission('ai:model_publish'), validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: {
    modelId: { type: 'string', maxLength: 80 },
    version: { type: 'string', minLength: 1, maxLength: 80 },
    status: { type: 'string', enum: ['candidate', 'shadow'] },
    promptVersion: { type: 'string', maxLength: 80 },
    knowledgeBaseVersion: { type: 'string', maxLength: 120 },
    evaluationReportId: { type: 'string', maxLength: 80 },
  },
}), handle(async (req, res) => {
  res.status(201).json(learning.registerModel(req.body, actorOf(req)));
}));

router.post('/learning/models/:id/shadow-complete', requirePermission('ai:model_publish'), validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['evaluationReportId'],
  properties: {
    evaluationReportId: { type: 'string', minLength: 1, maxLength: 80 },
    metrics: {
      type: 'object',
      additionalProperties: false,
      properties: {
        schemaPassRate: { type: 'number', minimum: 0, maximum: 1 },
        hardRiskRecall: { type: 'number', minimum: 0, maximum: 1 },
        unsafeAutonomousActions: { type: 'integer', minimum: 0 },
      },
    },
  },
}), handle(async (req, res) => {
  res.json(learning.recordShadowComplete(req.params.id, req.body, actorOf(req)));
}));

router.post('/learning/models/:id/status', requirePermission('ai:model_publish'), validateBody({
  type: 'object', additionalProperties: false, required: ['status'], properties: {
    status: { type: 'string', enum: ['shadow', 'live', 'rolled_back', 'candidate'] },
    reason: { type: 'string', maxLength: 300 },
    pharmacistApproverId: { type: 'string', maxLength: 40 },
  },
}), handle(async (req, res) => {
  res.json(learning.setModelStatus(req.params.id, req.body.status, actorOf(req), req.body.reason, {
    pharmacistApproverId: req.body.pharmacistApproverId,
  }));
}));

module.exports = router;
