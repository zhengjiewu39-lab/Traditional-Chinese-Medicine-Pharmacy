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
const draftService = require('../workflow/draftService');
const suggestionService = require('../workflow/suggestionService');
const learning = require('../workflow/learningLoop');
const { migrateLegacyPrescriptions } = require('../workflow/legacyMigrate');
const { issuePickupToken } = require('../workflow/pickupService');
const { inventoryCounts } = require('../workflow/inventoryDeduct');
const { getStore } = require('../data/store');
const pharmacyOps = require('../workflow/pharmacyOps');
const deskAssist = require('../workflow/deskAssist');
const { staffPatientDisplay } = require('../workflow/patientIdentity');

const router = express.Router();

router.use(limitBody());
router.use(limiter(Number(process.env.AI_RATE_LIMIT_PER_MIN) || 120));
router.use(accessAudit('ai'));

const actorOf = (req) => ({ role: req.user.role, id: req.user.id, name: req.user.name, username: req.user.username });
function gone(req, res) {
  return sendError(res, 410, 'archived', 'This endpoint was archived with the supply-simulation / operations-agent modules');
}

function summary(c) {
  const a = c.analyses.at(-1)?.output;
  return {
    caseId: c.caseId,
    state: c.state,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    synthetic: c.synthetic,
    ...staffPatientDisplay(c),
    herbCount: c.prescription?.herbs?.length || 0,
    riskTier: a?.riskTier || null,
    recommendation: a?.recommendation || null,
    abstain: a?.abstain ?? null,
    hardStopCount: a?.hardStops.length || 0,
    alertCount: a?.alerts.length || 0,
    missingCritical: a ? a.missingInformation.filter((m) => m.critical).length : 0,
    approvalValid: Boolean(c.approval?.valid && c.approval.contentHash === c.contentHash),
    secondReviewPending: c.secondReview?.status === 'pending',
    reviewLane: c.reviewLane || null,
    firstSigner: c.secondReview?.firstSigner || null,
    patientDeclined: c.patientDeclined,
    priority: service.isPriorityReview(c),
    displaySource: a?.displaySource || null,
    doseCount: c.prescription?.doseCount ?? null,
    herbs: (c.prescription?.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage, unit: h.unit || 'g' })),
    deskNotes: a?.deskNotes || a?.shadowResult?.deskNotes || null,
  };
}

// ---------------------------------------------------------------- cases

router.post('/cases', requirePermission('case:create'), validateBody(S.CREATE_CASE), handle(async (req, res) => {
  const c = service.createCase(req.body, actorOf(req));
  try {
    const out = await service.analyze(c.caseId);
    res.status(201).json({ case: out.case, analysis: out.analysis.output, reviewLane: out.case.reviewLane || null });
  } catch (err) {
    res.status(201).json({ case: service.getCaseOr404(c.caseId), analysis: null, reviewLane: null, screeningError: err.message });
  }
}));

router.get('/cases', requirePermission('case:read'), handle(async (req, res) => {
  const { state, riskTier } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const createdById = req.user.role === 'prescriber' ? String(req.user.id) : undefined;
  const filter = { state, riskTier, createdById };
  const total = repo.countCases({ state, createdById });
  const list = repo.listCases({ ...filter, limit, offset });
  res.json({ cases: list.map(summary), total, limit, offset });
}));

router.get('/workbench/summary', requirePermission('case:read'), handle(async (req, res) => {
  const byState = repo.countCasesByState();
  const by = (s) => byState[s] || 0;
  const today = new Date().toISOString().slice(0, 10);
  const recent = repo.listCases({ limit: 10 });
  const inv = inventoryCounts();
  const deskCases = repo.listCasesInStates(['pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed', 'dispensing']);
  res.json({
    today: repo.countCasesCreatedOn(today),
    pendingReview: by('pharmacist_review_required'),
    a3: 0,
    informationIncomplete: by('information_incomplete'),
    awaitingPatient: by('patient_confirmation_required'),
    awaitingPrescriber: by('returned_to_prescriber'),
    toDispense: by('patient_confirmed') + by('dispensing'),
    toCheck: by('pharmacist_final_check'),
    readyForPickup: by('ready_for_pickup'),
    pendingFollowUp: service.listFollowUps(repo.listCasesInStates(['pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed', 'dispensing', 'ready_for_pickup', 'completed'])).length,
    priorityReview: by('pharmacist_review_required'),
    batchReview: 0,
    shortage: inv.shortage,
    nearExpiry: inv.nearExpiry,
    restockSuggested: pharmacyOps.planDesk(deskCases).restock.length,
    recent: recent.map(summary),
    ai: runtime.describeRuntime(),
    auditChainValid: audit.verify().valid,
  });
}));

router.get('/cases/:id', requirePermission('case:read'), handle(async (req, res) => {
  const c = service.getCaseOr404(req.params.id);
  if (req.user.role === 'prescriber' && c.createdBy?.id !== String(req.user.id) && c.prescriber?.userId !== String(req.user.id)) {
    return sendError(res, 403, 'not_own_case', 'Prescribers may only view their own cases');
  }
  const display = staffPatientDisplay(c);
  res.json({
    case: {
      ...c,
      patient: {
        ...(c.patient || {}),
        name: display.patientName || c.patient?.name,
        patientRef: display.patientRef || c.patient?.patientRef,
      },
    },
    summary: summary(c),
  });
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
  res.json({ case: summary(c), dispensingRecords: c.dispensingRecords, allocation: c.allocation || null });
}));

router.get('/ops/desk', requirePermission('ops:read'), handle(async (req, res) => {
  res.json(pharmacyOps.planDesk());
}));

router.get('/desk/assist', requirePermission('case:read'), handle(async (req, res) => {
  const lane = String(req.query.lane || 'admin');
  if (lane === 'admin' && req.user.role !== 'admin') {
    return sendError(res, 403, 'forbidden', 'Admin assist is for administrators');
  }
  let caseRecord = null;
  if (req.query.caseId) caseRecord = service.getCaseOr404(req.query.caseId);
  res.json(deskAssist.assist(lane, { caseRecord }));
}));

router.post('/desk/admin-confirm', requirePermission('ai:runtime_configure'), validateBody({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'decision'],
  properties: {
    type: { type: 'string', enum: ['restock', 'knowledge_fetch', 'info', 'kill_switch', 'promote_live', 'approve', 'dispense'] },
    decision: { type: 'string', enum: ['accept', 'reject'] },
    payload: { type: 'object' },
  },
}), handle(async (req, res) => {
  const out = await deskAssist.confirmAdminProposal(req.body, actorOf(req));
  audit.append({
    eventType: 'admin_ai_proposal',
    actorType: 'admin',
    actorId: req.user.id,
    payload: { type: req.body.type, decision: req.body.decision, applied: Boolean(out.applied || out.requests) },
  });
  res.json(out);
}));

router.post('/ops/restock', requirePermission('ops:execute'), validateBody(S.RESTOCK_APPLY), handle(async (req, res) => {
  const out = pharmacyOps.proposeRestock(actorOf(req), req.body);
  audit.append({
    eventType: 'ops_restock_requested',
    actorType: req.user.role,
    actorId: req.user.id,
    payload: { requests: (out.requests || []).map((r) => r.name) },
  });
  res.json(out);
}));

router.post('/ops/receive', requirePermission('ops:execute'), validateBody(S.STOCK_RECEIVE), handle(async (req, res) => {
  const out = pharmacyOps.receiveStock(actorOf(req), req.body);
  audit.append({
    eventType: 'ops_stock_received',
    actorType: req.user.role,
    actorId: req.user.id,
    payload: { name: out.receipt.name, usable: out.receipt.usable, qty: out.receipt.quantity },
  });
  res.json(out);
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

router.get('/knowledge/authorities', requirePermission('ai:knowledge_read'), handle(async (req, res) => {
  res.json(require('../knowledge/authorityIngest').listAuthorities());
}));

router.get('/knowledge/search', requirePermission('ai:knowledge_read'), handle(async (req, res) => {
  res.json(require('../knowledge/search').searchKnowledge(req.query.q || ''));
}));

router.post('/knowledge/fetch', requirePermission('ai:knowledge_read'), validateBody({
  type: 'object', additionalProperties: false, required: ['herb'],
  properties: { herb: { type: 'string', minLength: 1, maxLength: 40 }, connector: { type: 'string', enum: ['pubmed'] } },
}), handle(async (req, res) => {
  const out = await require('../knowledge/authorityIngest').fetchPubmed(req.body.herb);
  res.json({
    ...out,
    note: 'Draft bibliographic records only. Not pharmacopoeia text. Not usable for clinical rules until a pharmacist reviews them.',
  });
}));

router.get('/knowledge/sources', requirePermission('ai:knowledge_read'), handle(async (req, res) => {
  const herbs = (getStore().herbs || []).slice(0, 200).map((h) => ({
    id: h.id, name: h.name, category: h.category || null, stock: h.stock ?? null, catalogOnly: true, clinicalEvidence: false,
  }));
  const reg = require('../knowledge/sourceRegistry').loadRegistry();
  res.json({
    knowledgeBaseVersion: knowledgeBaseVersion(),
    sources: listSources(),
    herbCatalog: herbs,
    note: 'Herb catalog rows are inventory identifiers, not clinical evidence.',
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

// Archived operations/digital-twin routes are not mounted.

router.post('/cases/:id/clarifications/:taskId/review', requirePermission('patient:clarification'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false,
  properties: {
    independentlyVerified: { type: 'boolean' },
    source: { type: 'string', maxLength: 80 },
    note: { type: 'string', maxLength: 300 },
  },
}), handle(async (req, res) => {
  res.json({ task: service.reviewClarification(req.params.id, req.params.taskId, actorOf(req), req.body) });
}));

router.post('/cases/:id/follow-up-plan', requirePermission('rx:followup'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false,
  properties: { dueAt: { type: 'string', maxLength: 40 }, ownerId: { type: 'string', maxLength: 40 }, note: { type: 'string', maxLength: 300 } },
}), handle(async (req, res) => {
  res.json({ plan: service.setFollowUpPlan(req.params.id, req.body, actorOf(req)) });
}));

router.post('/cases/:id/fact-candidates', requirePermission('patient:clarification'), validateBody({
  type: 'object', additionalProperties: false, required: ['candidateId', 'action'],
  properties: {
    candidateId: { type: 'string', maxLength: 80 },
    action: { type: 'string', enum: ['accept', 'correct', 'deny', 'unknown'] },
    value: {},
    status: { type: 'string', maxLength: 20 },
  },
}), handle(async (req, res) => {
  res.json(await service.confirmFactCandidate(req.params.id, req.body, actorOf(req)));
}));

router.post('/cases/:id/clarifications', requirePermission('patient:clarification'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false, required: ['fieldPath', 'question'],
  properties: {
    fieldPath: { type: 'string', maxLength: 80 },
    question: { type: 'string', minLength: 1, maxLength: 240 },
    reason: { type: 'string', maxLength: 300 },
    requiredForDecision: { type: 'boolean' },
    source: { type: 'string', enum: ['rule', 'model', 'pharmacist'] },
    send: { type: 'boolean' },
  },
}), handle(async (req, res) => {
  res.status(201).json(service.issueClarification(req.params.id, req.body, actorOf(req)));
}));

router.post('/cases/:id/education', requirePermission('rx:education_publish'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false,
  properties: {
    text: { type: 'string', maxLength: 4000 },
    aiExplanation: { type: 'string', maxLength: 2000 },
    source: { type: 'string', enum: ['pharmacist', 'fixed_template'] },
  },
}), handle(async (req, res) => {
  res.status(201).json({ document: service.createEducation(req.params.id, req.body, actorOf(req)) });
}));

router.post('/cases/:id/education/:documentId', requirePermission('rx:education_publish'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false, required: ['action'],
  properties: { action: { type: 'string', enum: ['approve', 'publish'] } },
}), handle(async (req, res) => {
  res.json({ document: service.decideEducation(req.params.id, req.params.documentId, req.body, actorOf(req)) });
}));

router.get('/follow-ups', requirePermission('rx:followup'), handle(async (req, res) => {
  res.json({ tasks: service.listFollowUps() });
}));

router.post('/cases/:id/follow-ups/:taskId', requirePermission('rx:followup'), requirePharmacistCredential, validateBody({
  type: 'object', additionalProperties: false, required: ['action'],
  properties: { action: { type: 'string', enum: ['assign', 'contact', 'close', 'escalate'] }, note: { type: 'string', maxLength: 500 }, summary: { type: 'string', maxLength: 1000 } },
}), handle(async (req, res) => {
  res.json({ task: service.followUpAction(req.params.id, req.params.taskId, req.body, actorOf(req)) });
}));

router.post('/cases/:id/feedback-token', requirePermission('patient:issue_token'), handle(async (req, res) => {
  res.json(service.issueFeedbackToken(req.params.id, actorOf(req)));
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
  required: ['evaluationReportId', 'evaluationReportHash'],
  properties: {
    evaluationReportId: { type: 'string', minLength: 1, maxLength: 80 },
    evaluationReportHash: { type: 'string', minLength: 8, maxLength: 128 },
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

router.post('/learning/models/:id/sign', requirePermission('ai:learning_review'), requirePharmacistCredential, handle(async (req, res) => {
  res.json(learning.signCandidate(req.params.id, actorOf(req)));
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

router.use('/operations', gone);

module.exports = router;
