const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-convergence-'));
process.env.AI_DATA_DIR = tmpDir;
process.env.AI_RATE_LIMIT_PER_MIN = '100000';
process.env.PICKUP_RATE_LIMIT_PER_MIN = '100000';
process.env.DATA_MODE = 'demo';
process.env.AI_MODE = 'live';

const { requireAuth, signToken } = require('../security/auth');
const { roleApiGuard } = require('../security/rbac');
const aiRoutes = require('../routes/ai');
const patientRoutes = require('../routes/patientPortal');
const pickupRoutes = require('../routes/pickup');
const legacyRx = require('../routes/prescriptions');
const runtime = require('../ai/aiRuntime');
const { createMockProvider } = require('../ai/mockProvider');
const { analyzeCase } = require('../ai/aiOrchestrator');
const { checkTransition, TransitionError } = require('../workflow/prescriptionStateMachine');
const repo = require('../workflow/workflowRepository');
const { getDataMode, isSyntheticMode } = require('../config/dataMode');
const { createProvider } = require('../ai/providerAdapter');
const { loadRegistry } = require('../knowledge/sourceRegistry');
const { clinicalKnowledgeRequired } = require('../config/dataMode');
const { clearRuntimeProvider } = require('../ai/runtimeConfig');

const USERS = {
  admin: { id: 1, username: 'admin', name: '管理员', role: 'admin', credentials: [] },
  pharmacist: { id: 2, username: 'pharmacist', name: '李药师', role: 'pharmacist', credentials: ['pharmacist'] },
  pharmacist2: { id: 3, username: 'pharmacist2', name: '王药师', role: 'pharmacist', credentials: ['pharmacist'] },
  technician: { id: 4, username: 'technician', name: '赵调剂员', role: 'technician' },
  prescriber: { id: 7, username: 'prescriber', name: '周医师', role: 'prescriber' },
  researcher: { id: 5, username: 'researcher', name: '研究员', role: 'researcher' },
};
const tokens = Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, signToken(u)]));
const sameIdPharmacist = signToken({ id: 7, username: 'conflict', name: '同号药师', role: 'pharmacist', credentials: ['pharmacist'] });

let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(requireAuth);
  app.use(roleApiGuard);
  app.use('/api/ai', aiRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/pickup', pickupRoutes);
  app.use('/api/prescriptions', legacyRx);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  runtime.clearProviderOverride();
  if (server) server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  clearRuntimeProvider();
  runtime.reloadProvider();
  runtime.setProviderOverride(createMockProvider());
});

async function call(method, p, { as, body, token } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const today = () => new Date().toISOString().slice(0, 10);
function caseInput(overrides = {}) {
  return {
    source: { channel: 'counter' },
    patient: {
      patientRef: 'P1', name: '合成患者', ageYears: 45, sex: 'male',
      facts: {
        allergies: { status: 'none', value: [], source: 'test', version: 1 },
        currentMedications: { status: 'none', value: [], source: 'test', version: 1 },
        liverImpairment: { status: 'none', value: false, source: 'test', version: 1 },
        renalImpairment: { status: 'none', value: false, source: 'test', version: 1 },
        pregnancy: { status: 'none', value: 'no', source: 'test', version: 1 },
        lactation: { status: 'none', value: 'no', source: 'test', version: 1 },
        ageYears: { status: 'reported', value: 45, unit: 'years', source: 'test', version: 1 },
        weightKg: { status: 'not_asked', value: null, unit: 'kg', source: 'test', version: 1 },
      },
      ...overrides.patient,
    },
    prescriber: { name: '合成医师', licenseVerified: true, ...overrides.prescriber },
    prescription: {
      herbs: [{ name: '黄芪', dosage: 15 }, { name: '白术', dosage: 10 }, { name: '茯苓', dosage: 12 }],
      doseCount: 7,
      usage: '水煎服，日一剂，分两次温服',
      form: 'decoction',
      issuedAt: today(),
      ...overrides.prescription,
    },
  };
}

describe('architecture convergence: roles and authority', () => {
  it('a prescriber cannot review their own prescription', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'prescriber', body: caseInput() });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    const analyzed = await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'prescriber', body: {} });
    assert.strictEqual(analyzed.status, 200);
    const self = await fetch(`${base}/api/ai/cases/${id}/pharmacist-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sameIdPharmacist}` },
      body: JSON.stringify({ action: 'approve', analysisId: analyzed.body.analysis.analysisId, comment: '自审' }),
    });
    const selfBody = JSON.parse(await self.text());
    assert.strictEqual(self.status, 403);
    assert.strictEqual(selfBody.error.code, 'cannot_review_own_prescription');
  });

  it('AI cannot submit, approve, dispense or issue pickup', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'prescriber', body: caseInput() });
    const id = created.body.case.caseId;
    await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'prescriber', body: {} });
    const c = repo.getCase(id);
    assert.throws(() => checkTransition(c, 'pharmacist_approved', 'ai'), TransitionError);
    assert.throws(() => checkTransition(c, 'dispensing', 'ai'), TransitionError);
    assert.throws(() => checkTransition({ ...c, state: 'ready_for_pickup' }, 'completed', 'ai'), TransitionError);
    const submitAsSystem = await call('POST', `/api/ai/drafts`, { as: 'technician', body: { prescriptionText: '黄芪15g' } });
    assert.strictEqual(submitAsSystem.status, 403);
  });

  it('a technician cannot change clinical prescription content', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput() });
    const id = created.body.case.caseId;
    await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'technician', body: {} });
    const edit = await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'technician',
      body: { prescription: { herbs: [{ name: '黄芪', dosage: 30 }] }, reason: '改量' },
    });
    assert.strictEqual(edit.status, 403);
  });

  it('admin without pharmacist credential cannot sign', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput() });
    const id = created.body.case.caseId;
    const analyzed = await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'technician', body: {} });
    const admin = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'admin', body: { action: 'approve', analysisId: analyzed.body.analysis.analysisId, comment: '管理员越权' },
    });
    assert.strictEqual(admin.status, 403);
  });

  it('clients cannot supply actor, reviewer or approval fields', async () => {
    const res = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: { ...caseInput(), actor: 'pharmacist', reviewer: 'me', approval: { valid: true }, synthetic: true },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'forbidden_fields');
  });
});

describe('architecture convergence: drafts and suggestions', () => {
  it('content change invalidates prior analysis; suggestions can be accepted or rejected', async () => {
    const created = await call('POST', '/api/ai/drafts', {
      as: 'prescriber',
      body: { diagnosisText: '气虚', prescriptionText: '黄芪15g，白术10g' },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.draft.draftId;
    const analyzed = await call('POST', `/api/ai/drafts/${id}/analyze`, { as: 'prescriber', body: {} });
    assert.strictEqual(analyzed.status, 200, JSON.stringify(analyzed.body));
    const pending = analyzed.body.suggestions.filter((s) => s.status === 'pending');
    assert.ok(pending.length >= 1);
    const first = pending[0];
    const decided = await call('POST', `/api/ai/drafts/${id}/suggestions/${first.suggestionId}/disposition`, {
      as: 'prescriber',
      body: { status: 'rejected', reasonCode: 'already_addressed', comment: '已评估' },
    });
    assert.strictEqual(decided.status, 200);
    assert.strictEqual(decided.body.suggestion.status, 'rejected');
    assert.strictEqual(decided.body.suggestion.disposition.decidedRole, 'prescriber');

    const patched = await call('PATCH', `/api/ai/drafts/${id}`, {
      as: 'prescriber', body: { prescriptionText: '黄芪30g，白术10g，甘草6g' },
    });
    assert.strictEqual(patched.status, 200);
    assert.strictEqual(patched.body.changed, true);
    const after = await call('GET', `/api/ai/drafts/${id}/suggestions`, { as: 'prescriber' });
    assert.ok(after.body.suggestions.some((s) => s.status === 'superseded'));
  });

  it('submit goes to pharmacist review and does not issue a pickup token', async () => {
    const created = await call('POST', '/api/ai/drafts', {
      as: 'prescriber', body: { diagnosisText: '气虚', prescriptionText: '黄芪15g，白术10g，茯苓12g' },
    });
    const id = created.body.draft.draftId;
    await call('POST', `/api/ai/drafts/${id}/analyze`, { as: 'prescriber', body: {} });
    const pendingChange = (await call('GET', `/api/ai/drafts/${id}/suggestions`, { as: 'prescriber' })).body.suggestions
      .filter((s) => s.status === 'pending' && s.proposedChange);
    for (const s of pendingChange) {
      await call('POST', `/api/ai/drafts/${id}/suggestions/${s.suggestionId}/disposition`, {
        as: 'prescriber', body: { status: 'rejected', reasonCode: 'already_addressed' },
      });
    }
    const submitted = await call('POST', `/api/ai/drafts/${id}/submit`, { as: 'prescriber', body: {} });
    assert.strictEqual(submitted.status, 201, JSON.stringify(submitted.body));
    assert.ok(['pharmacist_review_required', 'information_incomplete'].includes(submitted.body.case.state));
    assert.strictEqual(submitted.body.case.pickup, undefined);
    assert.ok(!JSON.stringify(submitted.body).includes('pickupCode'));
  });

  it('one-click submit auto-closes pending suggestions and still cannot approve', async () => {
    const created = await call('POST', '/api/ai/drafts', {
      as: 'prescriber', body: { diagnosisText: '气虚', prescriptionText: '甘草6g，甘遂1g' },
    });
    const id = created.body.draft.draftId;
    const analyzed = await call('POST', `/api/ai/drafts/${id}/analyze`, { as: 'prescriber', body: {} });
    assert.ok((analyzed.body.suggestions || []).some((s) => s.status === 'pending'));
    const submitted = await call('POST', `/api/ai/drafts/${id}/submit`, { as: 'prescriber', body: {} });
    assert.strictEqual(submitted.status, 201, JSON.stringify(submitted.body));
    assert.ok(['pharmacist_review_required', 'information_incomplete'].includes(submitted.body.case.state));
    const after = await call('GET', `/api/ai/drafts/${id}/suggestions`, { as: 'prescriber' });
    assert.ok((after.body.suggestions || []).every((s) => s.status !== 'pending'));
    const decide = await call('POST', `/api/ai/cases/${submitted.body.case.caseId}/pharmacist-decision`, {
      as: 'prescriber',
      body: { action: 'approve', analysisId: submitted.body.analysis.analysisId, comment: 'AI自批' },
    });
    assert.strictEqual(decide.status, 403);
  });
});

describe('architecture convergence: AI modes and providers', () => {
  it('model failure degrades to the rule engine', async () => {
    const r = await analyzeCase({
      caseId: 'deg', ...caseInput(),
    }, { provider: createMockProvider({ behavior: 'timeout' }), timeoutMs: 40, aiMode: 'live' });
    assert.strictEqual(r.semanticTrackResult.status, 'timeout');
    assert.strictEqual(r.displaySource, 'degraded_rules');
    assert.ok(r.ruleTrackResult.tier);
  });

  it('shadow results do not drive clinical decisions', async () => {
    const r = await analyzeCase({ caseId: 'sh', ...caseInput() }, {
      provider: createMockProvider(), aiMode: 'shadow',
    });
    assert.ok(r.shadowResult);
    assert.notStrictEqual(r.displaySource, 'live_model');
    assert.ok(!(r.alerts || []).some((a) => a.source === 'ai'));
  });

  it('mock provider is refused in production', () => {
    assert.throws(() => createProvider({ NODE_ENV: 'production', AI_PROVIDER: 'mock' }), /refused/);
  });

  it('live evaluate command refuses mock', () => {
    const run = spawnSync(process.execPath, [path.join(__dirname, '../../scripts/ai/evaluate-live.js')], {
      env: { ...process.env, AI_PROVIDER: 'mock' },
      encoding: 'utf8',
    });
    assert.notStrictEqual(run.status, 0);
    assert.match(run.stderr, /mock/);
  });

  it('admin runtime overlay never echoes the API key; physicians cannot configure it', async () => {
    const secret = 'sk-test-secret-do-not-leak';
    runtime.clearProviderOverride();
    const save = await call('POST', '/api/ai/runtime/provider', {
      as: 'admin',
      body: {
        preset: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: secret,
        timeoutMs: 30000,
        dataResidency: 'external',
      },
    });
    assert.strictEqual(save.status, 200, JSON.stringify(save.body));
    const saved = JSON.stringify(save.body);
    assert.ok(!saved.includes(secret));
    assert.strictEqual(save.body.local.apiKeyConfigured, true);
    assert.strictEqual(save.body.runtime.isMock, false);
    assert.strictEqual(save.body.runtime.provider, 'openai-compatible');
    assert.strictEqual(save.body.runtime.model, 'gpt-4o-mini');
    assert.strictEqual(save.body.runtime.aiMode, 'shadow');
    assert.strictEqual(save.body.local.aiMode, 'shadow');

    const forceLive = await call('POST', '/api/ai/runtime/provider', {
      as: 'admin',
      body: {
        preset: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: secret,
        aiMode: 'live',
      },
    });
    assert.strictEqual(forceLive.status, 409, JSON.stringify(forceLive.body));

    const view = await call('GET', '/api/ai/runtime', { as: 'prescriber' });
    assert.strictEqual(view.status, 200, JSON.stringify(view.body));
    assert.ok(!JSON.stringify(view.body).includes(secret));
    assert.strictEqual(view.body.local.apiKeyConfigured, true);

    const forbidden = await call('POST', '/api/ai/runtime/provider', {
      as: 'prescriber',
      body: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: secret },
    });
    assert.strictEqual(forbidden.status, 403);

    runtime.setProviderOverride({
      id: 'openai-compatible',
      isMock: false,
      modelVersion: 'gpt-4o-mini',
      lastMeta: { requestId: 'req_test' },
      complete: async () => '{"ok":true}',
    });
    const ping = await call('POST', '/api/ai/runtime/test', { as: 'admin' });
    assert.strictEqual(ping.status, 200, JSON.stringify(ping.body));
    assert.strictEqual(ping.body.ok, true);
    assert.strictEqual(ping.body.isMock, false);
    assert.ok(!JSON.stringify(ping.body).includes(secret));
  });
});

describe('architecture convergence: pickup, data mode, learning, queue', () => {
  it('public pickup no longer leaks patient records', async () => {
    const leaked = await call('GET', '/api/prescriptions/pickup/TCM128456');
    assert.ok([401, 410].includes(leaked.status));
    if (leaked.body) {
      const raw = JSON.stringify(leaked.body);
      assert.ok(!raw.includes('patientName'));
      assert.ok(!raw.includes('phone'));
    }
    const empty = await call('POST', '/api/pickup/redeem', { body: { token: 'not-a-valid-token-value-xxx' } });
    assert.ok([400, 404, 410].includes(empty.status), `pickup redeem status ${empty.status} ${JSON.stringify(empty.body)}`);
    assert.ok(!JSON.stringify(empty.body).includes('合成患者'));
  });

  it('low-risk cases still require pharmacist sign-off', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput() });
    const analyzed = await call('POST', `/api/ai/cases/${created.body.case.caseId}/analyze`, { as: 'technician', body: {} });
    assert.strictEqual(analyzed.body.case.state, 'pharmacist_review_required');
    assert.notStrictEqual(analyzed.body.analysis.recommendation, 'auto_release');
    const c = repo.getCase(created.body.case.caseId);
    assert.strictEqual(c.approval, null);
  });

  it('unapproved models and prompts cannot enter live', async () => {
    const reg = await call('POST', '/api/ai/learning/models', {
      as: 'admin',
      body: { version: '0.0.1-candidate', status: 'live', promptVersion: 'unapproved' },
    });
    assert.ok([400, 409].includes(reg.status), JSON.stringify(reg.body));
    const ok = await call('POST', '/api/ai/learning/models', {
      as: 'admin',
      body: { version: '0.0.1-candidate', status: 'candidate' },
    });
    assert.strictEqual(ok.status, 201);
    const skip = await call('POST', `/api/ai/learning/models/${ok.body.modelId}/status`, {
      as: 'admin', body: { status: 'live', reason: 'skip shadow' },
    });
    assert.strictEqual(skip.status, 409);
    const shadowed = await call('POST', `/api/ai/learning/models/${ok.body.modelId}/status`, {
      as: 'admin', body: { status: 'shadow', reason: 'enter shadow' },
    });
    assert.strictEqual(shadowed.status, 200, JSON.stringify(shadowed.body));
    const earlyLive = await call('POST', `/api/ai/learning/models/${ok.body.modelId}/status`, {
      as: 'admin', body: { status: 'live', reason: 'no report', pharmacistApproverId: '2' },
    });
    assert.strictEqual(earlyLive.status, 409);
    assert.strictEqual(earlyLive.body.error.code, 'shadow_incomplete');
  });

  it('high-risk labels reject a proxy secondReviewerId; a second pharmacist must sign in', async () => {
    const proxy = await call('POST', '/api/ai/learning/labels', {
      as: 'pharmacist',
      body: { suggestionId: 'sug_x', label: 'true_positive', risk: 'high', secondReviewerId: '3' },
    });
    assert.strictEqual(proxy.status, 400);
    assert.strictEqual(proxy.body.error.code, 'proxy_second_review_forbidden');
    const first = await call('POST', '/api/ai/learning/labels', {
      as: 'pharmacist',
      body: { suggestionId: 'sug_x', label: 'true_positive', risk: 'high' },
    });
    assert.strictEqual(first.status, 201, JSON.stringify(first.body));
    const second = await call('POST', '/api/ai/learning/labels', {
      as: 'pharmacist2',
      body: { suggestionId: 'sug_x', label: 'true_positive', risk: 'high' },
    });
    assert.strictEqual(second.status, 201, JSON.stringify(second.body));
  });

  it('draft submit copies license status from the roster, not a hardcoded true', async () => {
    const created = await call('POST', '/api/ai/drafts', {
      as: 'prescriber', body: { diagnosisText: '气虚', prescriptionText: '黄芪15g，白术10g' },
    });
    const submitted = await call('POST', `/api/ai/drafts/${created.body.draft.draftId}/submit`, { as: 'prescriber', body: {} });
    assert.strictEqual(submitted.status, 201, JSON.stringify(submitted.body));
    assert.strictEqual(submitted.body.case.prescriber.licenseVerified, true);
    assert.strictEqual(submitted.body.case.prescriber.licenseSource, 'demo_institution_roster');
  });

  it('createCase uses DATA_MODE rather than a hardcoded synthetic flag', async () => {
    assert.strictEqual(getDataMode(), 'demo');
    assert.strictEqual(isSyntheticMode(), true);
    const created = await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput() });
    assert.strictEqual(created.body.case.synthetic, true);
    assert.strictEqual(created.body.case.dataMode, 'demo');
    assert.notStrictEqual(created.body.case.prescriber.licenseVerified, true);
    assert.strictEqual(created.body.case.prescriber.licenseSource, 'not_on_file');
  });

  it('synthetic knowledge is unusable when clinical knowledge is required', () => {
    const orig = process.env.DATA_MODE;
    process.env.DATA_MODE = 'production';
    try {
      assert.strictEqual(clinicalKnowledgeRequired(), true);
      const reg = loadRegistry({ force: true });
      assert.ok(reg.bases.every((b) => b.clinicalUse !== true));
      assert.ok(reg.entries.every((e) => e.usable === false));
    } finally {
      process.env.DATA_MODE = orig;
      loadRegistry({ force: true });
    }
  });

  it('exception queue splits priority from batch; sampling is recorded', async () => {
    await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput({ prescription: { herbs: [{ name: '甘草', dosage: 6 }, { name: '甘遂', dosage: 1 }] } }) })
      .then((c) => call('POST', `/api/ai/cases/${c.body.case.caseId}/analyze`, { as: 'technician', body: {} }));
    const q = await call('GET', '/api/ai/review-queue', { as: 'pharmacist' });
    assert.strictEqual(q.status, 200);
    assert.ok(Array.isArray(q.body.priority));
    assert.ok(Array.isArray(q.body.secondReview));
    assert.ok(q.body.priority.some((x) => x.riskTier === 'A3'));
    const sample = await call('POST', '/api/ai/governance/sampling', { as: 'pharmacist', body: { rate: 0.1 } });
    assert.strictEqual(sample.status, 200);
  });

  it('audit events include model, prompt, knowledge and human decision versions', async () => {
    const created = await call('POST', '/api/ai/cases', { as: 'technician', body: caseInput() });
    const id = created.body.case.caseId;
    const analyzed = await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'technician', body: {} });
    await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analyzed.body.analysis.analysisId, comment: '签署' },
    });
    const audit = await call('GET', `/api/ai/cases/${id}/audit`, { as: 'pharmacist' });
    assert.strictEqual(audit.body.chain.valid, true);
    const types = audit.body.events.map((e) => e.eventType);
    assert.ok(types.includes('ai_analysis'));
    assert.ok(types.includes('pharmacist_decision'));
    const aiEvent = audit.body.events.find((e) => e.eventType === 'ai_analysis');
    assert.ok(aiEvent.modelVersion);
    assert.ok(aiEvent.payload.promptVersion || analyzed.body.analysis.promptVersion);
  });

  it('legacy prescriptions API is a compatibility layer into cases', async () => {
    const created = await call('POST', '/api/prescriptions', {
      as: 'prescriber',
      body: { patientName: '合成甲', diagnosis: '气虚', herbs: [{ name: '黄芪', dosage: '15g' }], reviewer: 'should-be-stripped' },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.ok(created.body.caseId);
    assert.strictEqual(created.body.workflow, 'case');
    assert.strictEqual(created.body.pickupCode, null);
    assert.strictEqual(created.body.status, '待审核');
  });
});

describe('experiment controls and case constructor', () => {
  it('reads rulesEnabled and retrievalEnabled instead of inferring from group names', async () => {
    const input = { caseId: 'exp-1', ...caseInput() };
    const off = await analyzeCase(input, {
      provider: createMockProvider(), aiMode: 'live', rulesEnabled: true, retrievalEnabled: false, clarificationMode: 'none',
    });
    assert.strictEqual(off.experimentControl.retrievalEnabled, false);
    assert.strictEqual(off.experimentControl.retrievalUsed, false);
    const on = await analyzeCase(input, {
      provider: createMockProvider(), aiMode: 'live', rulesEnabled: true, retrievalEnabled: true, clarificationMode: 'none',
    });
    assert.strictEqual(on.experimentControl.retrievalEnabled, true);
    const a3 = await analyzeCase({
      caseId: 'exp-a3',
      ...caseInput(),
      prescription: { herbs: [{ name: '甘草', dosage: 6 }, { name: '甘遂', dosage: 1 }], doseCount: 7, usage: '水煎服' },
    }, { provider: createMockProvider(), aiMode: 'live', rulesEnabled: false, retrievalEnabled: false });
    assert.ok(a3.hardStops.some((h) => h.code === 'EIGHTEEN_INCOMPATIBLE') || a3.riskTier === 'A3');
  });

  it('case constructor hides labels and merges issuedAtOffsetDays', () => {
    const ctor = require('../research/caseConstructor');
    const pack = {
      defaults: {
        patient: { ageYears: 45, sex: 'male' },
        prescriber: { name: '合成医师', licenseVerified: true },
        prescription: { doseCount: 7, issuedAtOffsetDays: 0 },
        source: { channel: 'counter' },
      },
    };
    const raw = {
      id: 'X01',
      initialObservedFacts: { ageYears: 30, sex: 'female' },
      hiddenPatientFacts: { pregnancy: 'yes' },
      patientAnswerScript: { 'patient.facts.pregnancy': { status: 'reported', value: 'yes' } },
      expertReferenceLabels: { unsafe: true },
      expected: { tier: 'A3' },
      prescription: { herbs: [{ name: '红花', dosage: 6 }], issuedAtOffsetDays: -12 },
    };
    const visible = ctor.buildVisibleCase(pack, raw, { now: new Date('2026-10-03T00:00:00.000Z') });
    assert.strictEqual(visible.patient.ageYears, 30);
    assert.strictEqual(visible.prescription.issuedAt, '2026-09-21');
    ctor.assertNoHiddenLeak(visible);
    const hidden = ctor.hiddenBundle(raw);
    assert.strictEqual(hidden.hiddenPatientFacts.pregnancy, 'yes');
    assert.ok(!JSON.stringify(visible).includes('expertReferenceLabels'));
    assert.ok(!JSON.stringify(visible).includes('hiddenPatientFacts'));
  });
});
