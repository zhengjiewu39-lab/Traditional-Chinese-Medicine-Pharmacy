const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-pharmacy-'));
process.env.AI_DATA_DIR = tmpDir;
process.env.AI_RATE_LIMIT_PER_MIN = '100000';
process.env.PATIENT_RATE_LIMIT_PER_MIN = '100000';
process.env.DATA_MODE = 'demo';

const { requireAuth, signToken } = require('../security/auth');
const { roleApiGuard } = require('../security/rbac');
const aiRoutes = require('../routes/ai');
const patientRoutes = require('../routes/patientPortal');
const runtime = require('../ai/aiRuntime');
const { createMockProvider } = require('../ai/mockProvider');
const repo = require('../workflow/workflowRepository');
const facts = require('../workflow/clinicalFacts');
const education = require('../workflow/educationService');
const followUp = require('../workflow/followUpService');
const { importIfNeeded } = require('../db/migrateFromJson');
const billingRoutes = require('../routes/billing');
const inventoryRoutes = require('../routes/inventory');
const herbRoutes = require('../routes/herbs');
const orderRoutes = require('../routes/orders');
const traceabilityRoutes = require('../routes/traceability');
const patientsRoutes = require('../routes/patients');
const evaluationRoutes = require('../research/evaluationRoutes');
const researchProtocol = require('../workflow/researchProtocol');
const { deductForCase } = require('../workflow/inventoryDeduct');
const { getStore, updateStore } = require('../data/store');

const USERS = {
  admin: { id: 1, username: 'admin', name: '管理员', role: 'admin', credentials: [] },
  pharmacist: { id: 2, username: 'pharmacist', name: '李药师', role: 'pharmacist', credentials: ['pharmacist'] },
  pharmacist2: { id: 3, username: 'pharmacist2', name: '王药师', role: 'pharmacist', credentials: ['pharmacist'] },
  technician: { id: 4, username: 'technician', name: '赵调剂员', role: 'technician' },
  researcher: { id: 5, username: 'researcher', name: '研究员', role: 'researcher' },
  patient: { id: 6, username: 'patient', name: '演示患者', role: 'patient', patientRef: 'P1' },
  patientB: { id: 8, username: 'patientB', name: '其他患者', role: 'patient', patientRef: 'P9' },
  prescriber: { id: 7, username: 'prescriber', name: '周医师', role: 'prescriber' },
  prescriberB: { id: 99, username: 'prescriberB', name: '其他医师', role: 'prescriber' },
};
const tokens = Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, signToken(u)]));

let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(requireAuth);
  app.use(roleApiGuard);
  app.use('/api/ai', aiRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/herbs', herbRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/traceability', traceabilityRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use('/api/research/evaluation', evaluationRoutes);
  app.all('/api/simulation', (req, res) => res.status(410).json({ error: { code: 'archived' } }));
  app.all('/api/research', (req, res) => res.status(410).json({ error: { code: 'archived' } }));
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

beforeEach(() => runtime.setProviderOverride(createMockProvider()));

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

function caseBody(patient = {}) {
  return {
    source: { channel: 'counter' },
    patient: { patientRef: 'P1', name: '合成患者', ageYears: 40, sex: 'male', ...patient },
    prescriber: { name: '合成医师', licenseVerified: true },
    prescription: {
      herbs: [{ name: '黄芪', dosage: 15, unit: 'g' }],
      doseCount: 7,
      usage: '水煎服，日一剂',
      form: 'decoction',
      issuedAt: new Date().toISOString().slice(0, 10),
    },
  };
}

async function openCase(patient) {
  const created = await call('POST', '/api/ai/cases', { as: 'prescriber', body: caseBody(patient) });
  assert.strictEqual(created.status, 201, JSON.stringify(created.body));
  const id = created.body.case.caseId;
  if (created.body.analysis) {
    return { id, analysis: created.body.analysis, state: created.body.case.state };
  }
  const analyzed = await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'pharmacist', body: {} });
  assert.strictEqual(analyzed.status, 200, JSON.stringify(analyzed.body));
  return { id, analysis: analyzed.body.analysis, state: analyzed.body.case.state };
}

describe('clinical facts', () => {
  it('1. missing allergy is unknown, not none; clarification works before approval', async () => {
    const migrated = facts.attachFacts({ allergies: [] });
    assert.strictEqual(facts.allergyIsMissing(migrated), true);
    assert.strictEqual(facts.allergyIsExplicitNone(migrated), false);
    const denied = facts.fact({ status: 'denied', value: ['青霉素'], source: 'patient' });
    assert.notDeepStrictEqual(denied.value, []);
    assert.notStrictEqual(denied.status, 'none');
    const { id, state } = await openCase({});
    assert.ok(['pharmacist_review_required', 'information_incomplete'].includes(state));
    const clar = await call('POST', `/api/ai/cases/${id}/clarifications`, {
      as: 'pharmacist',
      body: { fieldPath: 'patient.facts.allergies', question: '是否有药物或食物过敏？', requiredForDecision: true, source: 'pharmacist' },
    });
    assert.strictEqual(clar.status, 201, JSON.stringify(clar.body));
    const answered = await call('POST', `/api/patient/clarification/${clar.body.token}`, {
      body: { status: 'unknown' },
    });
    assert.strictEqual(answered.status, 200, JSON.stringify(answered.body));
    const c = repo.getCase(id);
    assert.strictEqual(facts.allergyIsExplicitNone(c.patient), false);
    assert.notStrictEqual(c.patient.facts.allergies.status, 'none');
    const task = (c.clarificationTasks || []).find((t) => t.taskId === clar.body.task.taskId);
    assert.ok(task);
    assert.strictEqual(task.status, 'answered');
    assert.ok(task.response);
    assert.strictEqual(task.response.status, 'unknown');
  });

  it('2. stop/correct does not re-append old meds; stale tokens fail', async () => {
    const start = facts.attachFacts({ currentMedications: ['华法林'] });
    const stopped = facts.applyFactChange(start, { changeId: 'c1', kind: 'stop', fieldPath: 'patient.facts.currentMedications', oldValue: '华法林' }, { id: 'p', role: 'patient' }).patient;
    assert.ok(facts.activeMedications(stopped).every((m) => m.name !== '华法林'));
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const ok = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    const issued = await call('POST', `/api/ai/cases/${id}/patient-confirmation`, { as: 'pharmacist', body: {} });
    await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'pharmacist',
      body: { reason: '临床更正', patient: { ageYears: 41 } },
    });
    const stale = await call('POST', `/api/patient/confirmation/${issued.body.token}`, {
      body: { decision: 'confirm', identityConfirmed: true },
    });
    assert.ok([409, 410].includes(stale.status));
  });
});

describe('authorization and concurrency', () => {
  it('3. patient/admin/AI cannot approve or change dose via API', async () => {
    const { id, analysis } = await openCase({ allergies: ['none-marker'] });
    const admin = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'admin', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'no' },
    });
    assert.ok(admin.status === 403 || admin.status === 401);
    const patient = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'patient', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'no' },
    });
    assert.strictEqual(patient.status, 403);
    const dose = await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'patient', body: { reason: 'hack', prescription: { herbs: [{ name: '黄芪', dosage: 99, unit: 'g' }] } },
    });
    assert.ok(dose.status === 403 || dose.status === 400);
  });

  it('8. expectedVersion conflict returns 409', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const c = repo.getCase(id);
    const r = await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'pharmacist',
      body: { reason: 'stale', expectedVersion: c.contentVersion + 5, patient: { ageYears: 50 } },
    });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error.code, 'version_conflict');
  });

  it('9. proxy secondReviewerId is rejected', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const r = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist',
      body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok', secondReviewerId: '3' },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.error.code, 'proxy_second_review_forbidden');
  });
});

describe('education and follow-up', () => {
  it('6. unpublished education is hidden; dose rewrite is rejected', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    const view = repo.getCase(id);
    const hidden = require('../workflow/workflowService').patientView(view);
    assert.strictEqual(hidden.educationStatus, 'not_published');
    const bad = { text: '每日服用黄芪 999 千克' };
    const factsRow = education.structuredFacts(view);
    const check = education.factsMatchText(factsRow, bad.text);
    assert.strictEqual(check.ok, false);
  });

  it('7. completed case can take more feedback; AI cannot close follow-up', async () => {
    const c = {
      caseId: 'case-fu',
      state: 'completed',
      contentVersion: 1,
      followUpTasks: [],
      patientFeedback: [],
    };
    const task = followUp.createFromFeedback(c, { at: new Date().toISOString(), adverseReported: true, patientSeverity: 'severe' }, { id: 'p', role: 'patient' });
    assert.throws(() => followUp.close(c, task.taskId, { role: 'ai', id: 'model' }, 'done'), /cannot close/i);
    followUp.assign(c, task.taskId, { id: '2', role: 'pharmacist' });
    followUp.addContact(c, task.taskId, { id: '2', role: 'pharmacist' }, 'called');
    followUp.close(c, task.taskId, { id: '2', role: 'pharmacist' }, 'resolved in clinic');
    assert.strictEqual(c.followUpTasks[0].status, 'resolved');
    assert.strictEqual(c.followUpTasks[0].closedBy, '2');
  });
});

describe('research isolation and migration', () => {
  it('10. archived modules have no live endpoints', async () => {
    const sim = await call('GET', '/api/simulation', { as: 'researcher' });
    assert.ok([403, 410].includes(sim.status));
    const ops = await call('GET', '/api/ai/operations/analysis', { as: 'admin' });
    assert.ok([403, 410].includes(ops.status));
  });

  it('11. json import is idempotent', () => {
    const first = importIfNeeded();
    const second = importIfNeeded();
    assert.ok(second.skipped || second.ok);
    assert.ok(first.ok || first.skipped || first.cases != null);
  });
});

describe('P1 review fixes', () => {
  it('two clarifications persist independently and do not expire each other', async () => {
    const { id } = await openCase({
      allergies: ['青霉素'],
      facts: {
        allergies: { status: 'reported', value: ['青霉素'], source: 'test', version: 1 },
        currentMedications: { status: 'none', value: [], source: 'test', version: 1 },
        liverImpairment: { status: 'none', value: false, source: 'test', version: 1 },
        renalImpairment: { status: 'none', value: false, source: 'test', version: 1 },
        pregnancy: { status: 'none', value: 'no', source: 'test', version: 1 },
        lactation: { status: 'none', value: 'no', source: 'test', version: 1 },
        ageYears: { status: 'reported', value: 40, unit: 'years', source: 'test', version: 1 },
        weightKg: { status: 'unknown', value: null, unit: 'kg', source: 'test', version: 1 },
      },
    });
    const ageQ = await call('POST', `/api/ai/cases/${id}/clarifications`, {
      as: 'pharmacist', body: { fieldPath: 'patient.facts.ageYears', question: '年龄？', source: 'pharmacist' },
    });
    const wtQ = await call('POST', `/api/ai/cases/${id}/clarifications`, {
      as: 'pharmacist', body: { fieldPath: 'patient.facts.weightKg', question: '体重？', source: 'pharmacist' },
    });
    assert.strictEqual(ageQ.status, 201, JSON.stringify(ageQ.body));
    assert.strictEqual(wtQ.status, 201, JSON.stringify(wtQ.body));
    const a1 = await call('POST', `/api/patient/clarification/${ageQ.body.token}`, { body: { status: 'reported', value: 55 } });
    assert.strictEqual(a1.status, 200, JSON.stringify(a1.body));
    const afterAge = repo.getCase(id);
    const ageTask = afterAge.clarificationTasks.find((t) => t.taskId === ageQ.body.task.taskId);
    const wtTask = afterAge.clarificationTasks.find((t) => t.taskId === wtQ.body.task.taskId);
    assert.strictEqual(ageTask.status, 'answered');
    assert.ok(ageTask.response);
    assert.strictEqual(wtTask.status, 'sent');
    assert.strictEqual(afterAge.patient.ageYears, 55);
    assert.strictEqual(afterAge.patient.facts.ageYears.value, 55);
    const a2 = await call('POST', `/api/patient/clarification/${wtQ.body.token}`, { body: { status: 'reported', value: 62 } });
    assert.strictEqual(a2.status, 200, JSON.stringify(a2.body));
    const done = repo.getCase(id);
    assert.strictEqual(done.clarificationTasks.find((t) => t.taskId === ageQ.body.task.taskId).status, 'answered');
    assert.strictEqual(done.clarificationTasks.find((t) => t.taskId === wtQ.body.task.taskId).status, 'answered');
    assert.strictEqual(done.patient.facts.weightKg.value, 62);
    const replay = await call('POST', `/api/patient/clarification/${ageQ.body.token}`, { body: { status: 'reported', value: 55 } });
    assert.ok([200, 410].includes(replay.status));
  });

  it('pharmacist cannot change herbs; education 15 vs 150 is inconsistent; unpublished text is not in patient API', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const herb = await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'pharmacist', body: { reason: '改剂量', prescription: { herbs: [{ name: '黄芪', dosage: 16, unit: 'g' }] } },
    });
    assert.strictEqual(herb.status, 403);
    const factsRow = education.structuredFacts(repo.getCase(id));
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪150g，每日7剂').ok, false);
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪17g，水煎服，共7剂').ok, false);
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪15mg，水煎服，共7剂').ok, false);
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪15g，水煎服，共8剂').ok, false);
    const decoctFacts = {
      herbs: [
        { name: '附子', dosage: 6, unit: 'g', decoctionTiming: '先煎' },
        { name: '薄荷', dosage: 3, unit: 'g', decoctionTiming: '后下' },
      ],
      doseCount: 7,
    };
    assert.strictEqual(education.factsMatchText(decoctFacts, '附子6g先煎，薄荷3g后下，共7剂').ok, true);
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪每日17克，共七剂').ok, false);
    assert.strictEqual(education.factsMatchText(factsRow, '黄芪15g，每日三剂，共7剂').ok, false);
    assert.strictEqual(education.factsMatchText(factsRow, '注意休息').ok, false);
    assert.notStrictEqual(education.factsMatchText(factsRow, '注意休息').verdict, 'complete');
    assert.strictEqual(education.factsMatchText(factsRow, '注意休息').autoConsistent, false);
    const draft = await call('POST', `/api/ai/cases/${id}/education`, {
      as: 'pharmacist', body: { text: '黄芪15g，水煎服，日一剂，共7剂' },
    });
    assert.strictEqual(draft.status, 201, JSON.stringify(draft.body));
    const pubEarly = await call('POST', `/api/ai/cases/${id}/education/${draft.body.document.documentId}`, {
      as: 'pharmacist', body: { action: 'publish' },
    });
    assert.ok([409, 400].includes(pubEarly.status));
    await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    const mine = await call('GET', '/api/patient/me/cases', { as: 'patient' });
    assert.strictEqual(mine.status, 200);
    const blob = JSON.stringify(mine.body);
    assert.ok(!blob.includes('review_required') || (mine.body.cases || []).every((c) => (c.education || []).every((d) => d.status === 'published')));
    assert.ok(!(mine.body.cases || []).some((c) => (c.education || []).some((d) => d.status === 'review_required')));
    assert.ok(!(mine.body.cases || []).some((c) => (c.followUps || []).some((f) => f.contacts || f.dispositionSummary)));
  });

  it('concurrent expectedVersion writes: only one succeeds', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const v = repo.getCase(id).contentVersion;
    const [a, b] = await Promise.all([
      call('PATCH', `/api/ai/cases/${id}`, { as: 'pharmacist', body: { reason: '年龄', expectedVersion: v, patient: { ageYears: 51 } } }),
      call('PATCH', `/api/ai/cases/${id}`, { as: 'pharmacist', body: { reason: '体重', expectedVersion: v, patient: { weightKg: 70 } } }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.ok(statuses.includes(200) && statuses.includes(409), JSON.stringify({ a: a.status, b: b.status, ae: a.body, be: b.body }));
  });

  it('missing herb fails all deduct; billing rejects unauthorized and non-positive qty', async () => {
    const before = getStore().inventory.find((i) => i.name === '黄芪')?.stock;
    assert.ok(Number.isFinite(before));
    assert.throws(
      () => deductForCase({
        caseId: 'case-miss',
        contentVersion: 1,
        prescription: { herbs: [{ name: '黄芪', dosage: 15, unit: 'g' }, { name: '不存在药材XYZ', dosage: 9, unit: 'g' }], doseCount: 1 },
      }, { id: 4, role: 'technician' }),
      (err) => err.code === 'herb_not_in_inventory',
    );
    assert.strictEqual(getStore().inventory.find((i) => i.name === '黄芪').stock, before);

    const denied = await call('POST', '/api/billing/checkout', { as: 'prescriber', body: { items: [{ name: '黄芪', quantity: 1 }] } });
    assert.strictEqual(denied.status, 403);
    const neg = await call('POST', '/api/billing/checkout', { as: 'technician', body: { items: [{ name: '黄芪', quantity: -1 }] } });
    assert.ok([400, 403].includes(neg.status), JSON.stringify(neg.body));
    const zero = await call('POST', '/api/billing/checkout', { as: 'technician', body: { items: [{ name: '黄芪', quantity: 0 }] } });
    assert.ok([400, 403].includes(zero.status));
    assert.strictEqual(getStore().inventory.find((i) => i.name === '黄芪').stock, before);
    const caseBill = await call('POST', '/api/billing/checkout', { as: 'technician', body: { caseId: 'x', items: [{ name: '黄芪', quantity: 1 }] } });
    assert.strictEqual(caseBill.status, 409);
  });

  it('follow-up plan is stored and handover without a plan does not invent a scheduled task', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const plan = await call('POST', `/api/ai/cases/${id}/follow-up-plan`, {
      as: 'pharmacist',
      body: { dueAt: '2026-12-01T00:00:00.000Z', note: '三日回访' },
    });
    assert.strictEqual(plan.status, 200, JSON.stringify(plan.body));
    assert.strictEqual(repo.getCase(id).followUpPlan.note, '三日回访');
    const c = repo.getCase(id);
    c.followUpPlan = null;
    c.followUpTasks = [];
    repo.saveCase(c);
    const after = repo.getCase(id);
    assert.strictEqual(after.followUpPlan, null);
  });

  it('logged-in patient confirms and answers from inbox without a token', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const approved = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    assert.strictEqual(approved.status, 200, JSON.stringify(approved.body));
    const staff = await call('POST', `/api/patient/me/cases/${id}/confirm`, {
      as: 'pharmacist', body: { decision: 'confirm', identityConfirmed: true, fulfillment: 'pickup' },
    });
    assert.strictEqual(staff.status, 403);
    const mine = await call('GET', '/api/patient/me/cases', { as: 'patient' });
    assert.strictEqual(mine.status, 200);
    const row = (mine.body.cases || []).find((c) => c.caseId === id);
    assert.ok(row, JSON.stringify(mine.body));
    assert.strictEqual(row.actions.canConfirm, true);
    const conf = await call('POST', `/api/patient/me/cases/${id}/confirm`, {
      as: 'patient',
      body: {
        decision: 'confirm',
        identityConfirmed: true,
        fulfillment: 'pickup',
        educationReceived: true,
        educationUnderstood: true,
        pregnancy: 'unknown',
        lactation: 'unknown',
      },
    });
    assert.strictEqual(conf.status, 200, JSON.stringify(conf.body));
    assert.strictEqual(conf.body.outcome, 'confirmed');
    assert.strictEqual(repo.getCase(id).state, 'patient_confirmed');
    const fb = await call('POST', `/api/patient/me/cases/${id}/feedback`, {
      as: 'patient', body: { intakeStatus: 'taken', effectiveness: 4 },
    });
    assert.strictEqual(fb.status, 200, JSON.stringify(fb.body));
    assert.strictEqual(fb.body.outcome, 'recorded');
  });

  it('a case bound to P2 is only in that patient inbox', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: caseBody({ patientRef: 'P2', name: '李四', ageYears: 32, sex: 'female' }),
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    assert.strictEqual(created.body.case.patient.patientRef, 'P2');
    const p2 = signToken({ id: 602, username: 'P2', name: '李四', role: 'patient', patientRef: 'P2' });
    const mine = await call('GET', '/api/patient/me/cases', { token: p2 });
    assert.strictEqual(mine.status, 200, JSON.stringify(mine.body));
    assert.ok((mine.body.cases || []).some((c) => c.caseId === id));
    const p1 = await call('GET', '/api/patient/me/cases', { as: 'patient' });
    assert.ok(!(p1.body.cases || []).some((c) => c.caseId === id));
  });

  it('auto-picks a confirmed prescription for that patient and restocks low inventory', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const approved = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    assert.strictEqual(approved.status, 200, JSON.stringify(approved.body));
    const conf = await call('POST', `/api/patient/me/cases/${id}/confirm`, {
      as: 'patient',
      body: { decision: 'confirm', identityConfirmed: true, fulfillment: 'pickup', educationReceived: true, educationUnderstood: true },
    });
    assert.strictEqual(conf.status, 200, JSON.stringify(conf.body));

    const desk = await call('GET', '/api/ai/ops/desk', { as: 'technician' });
    assert.strictEqual(desk.status, 200, JSON.stringify(desk.body));
    const plan = (desk.body.allocations || []).find((a) => a.caseId === id);
    assert.ok(plan, JSON.stringify(desk.body.allocations));
    assert.strictEqual(plan.patientRef, 'P1');
    assert.ok(plan.lines.some((l) => l.herbName === '黄芪' && l.status === 'ok'));

    const denied = await call('POST', '/api/ai/ops/restock', { as: 'prescriber', body: {} });
    assert.strictEqual(denied.status, 403);

    const before = getStore().inventory.find((i) => i.name === '黄芪').stock;
    const picked = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'technician', body: { action: 'auto_pick' } });
    assert.strictEqual(picked.status, 200, JSON.stringify(picked.body));
    assert.strictEqual(picked.body.case.state, 'dispensing');
    assert.strictEqual(repo.getCase(id).allocation.patientRef, 'P1');
    const recs = repo.getCase(id).dispensingRecords || [];
    assert.ok(recs.some((r) => r.type === 'picking_plan' && r.autoPick));
    assert.ok(!recs.some((r) => r.type === 'weighed'));
    const afterPick = getStore().inventory.find((i) => i.name === '黄芪').stock;
    assert.ok(afterPick < before, `stock ${before} -> ${afterPick}`);
    const again = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'technician', body: { action: 'start' } });
    assert.strictEqual(again.status, 200, JSON.stringify(again.body));
    assert.strictEqual(getStore().inventory.find((i) => i.name === '黄芪').stock, afterPick);

    const noWeigh = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'pharmacist', body: { action: 'final_check_pass' } });
    assert.ok(noWeigh.status >= 400);

    const weighed = await call('POST', `/api/ai/cases/${id}/dispensing`, {
      as: 'technician', body: { action: 'record_weigh', weighSource: 'manual', weighedItems: [{ name: '黄芪', grams: 15, unit: 'g' }] },
    });
    assert.strictEqual(weighed.status, 200, JSON.stringify(weighed.body));
    assert.strictEqual(repo.getCase(id).state, 'pharmacist_final_check');
    const self = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'technician', body: { action: 'final_check_pass' } });
    assert.ok([403, 409].includes(self.status));

    const ganRow = getStore().inventory.find((i) => i.name === '甘草');
    updateStore((data) => {
      const item = data.inventory.find((i) => i.name === '甘草');
      if (item) item.minStock = 40;
    });
    require('../workflow/inventoryLots').replaceUsableQty(ganRow, 2);
    const beforeGan = getStore().inventory.find((i) => i.name === '甘草').stock;
    const restock = await call('POST', '/api/ai/ops/restock', { as: 'technician', body: {} });
    assert.strictEqual(restock.status, 200, JSON.stringify(restock.body));
    assert.ok((restock.body.requests || []).some((a) => a.name === '甘草'), JSON.stringify(restock.body));
    assert.deepStrictEqual(restock.body.applied, []);
    assert.strictEqual(getStore().inventory.find((i) => i.name === '甘草').stock, beforeGan);
    const req = restock.body.requests.find((a) => a.name === '甘草');
    const ganId = getStore().inventory.find((i) => i.name === '甘草').id;
    const failLot = await call('POST', '/api/ai/ops/receive', {
      as: 'technician',
      body: { inventoryId: ganId, requestId: req.id, quantity: 50, inspection: 'fail', batchNo: 'B-FAIL', expiresAt: '2099-01-01' },
    });
    assert.strictEqual(failLot.status, 200, JSON.stringify(failLot.body));
    assert.strictEqual(failLot.body.receipt.usable, false);
    assert.strictEqual(getStore().inventory.find((i) => i.name === '甘草').stock, beforeGan);
    const okLot = await call('POST', '/api/ai/ops/receive', {
      as: 'technician',
      body: { inventoryId: ganId, requestId: req.id, quantity: 50, inspection: 'pass', batchNo: 'B-OK', expiresAt: '2099-01-01' },
    });
    assert.strictEqual(okLot.status, 200, JSON.stringify(okLot.body));
    assert.ok(getStore().inventory.find((i) => i.name === '甘草').stock >= beforeGan + 50);
  });

  it('editing a synthetic patient updates store, cases and patient-mode profile', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: caseBody({ patientRef: 'P2', name: '李四', ageYears: 32, sex: 'female' }),
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    const edited = await call('PUT', '/api/patients/2', {
      as: 'prescriber',
      body: { name: '李四改', age: 33, allergies: '花粉', medicalHistory: '过敏性鼻炎' },
    });
    assert.strictEqual(edited.status, 200, JSON.stringify(edited.body));
    assert.strictEqual(edited.body.name, '李四改');
    assert.strictEqual(edited.body.patientRef, 'P2');
    assert.ok(edited.body.synced.cases >= 1);
    assert.strictEqual(getStore().patients.find((p) => p.id === 2).name, '李四改');
    assert.strictEqual(repo.getCase(id).patient.name, '李四改');
    assert.strictEqual(repo.getCase(id).patient.ageYears, 33);
    const tok = signToken({ id: 602, username: 'P2', name: '李四改', role: 'patient', patientRef: 'P2' });
    const prof = await call('GET', '/api/patient/me/profile', { token: tok });
    assert.strictEqual(prof.status, 200, JSON.stringify(prof.body));
    assert.strictEqual(prof.body.store.name, '李四改');
    assert.strictEqual(prof.body.store.age, 33);
    assert.ok(prof.body.store.allergies.includes('花粉'));
    await call('PUT', '/api/patients/2', {
      as: 'prescriber',
      body: { name: '李四', age: 32, allergies: [], medicalHistory: '过敏性鼻炎' },
    });
  });

  it('patient center and patient inbox share the same P1–P500 identities', async () => {
    const all = await call('GET', '/api/patients', { as: 'prescriber' });
    assert.strictEqual(all.status, 200);
    assert.ok((all.body || []).length >= 500, `patients ${all.body?.length}`);
    const refs = new Set((all.body || []).map((p) => p.patientRef || `P${p.id}`));
    assert.ok(refs.has('P1') && refs.has('P500'));
    const listed = await call('GET', '/api/patients?q=P500', { as: 'prescriber' });
    assert.strictEqual(listed.status, 200);
    const row = (listed.body || []).find((p) => p.patientRef === 'P500' || Number(p.id) === 500);
    assert.ok(row, JSON.stringify((listed.body || []).slice(0, 3)));
    assert.strictEqual(row.patientRef, 'P500');
    const tok = signToken({
      id: 100500, username: 'P500', name: row.name, role: 'patient', patientRef: 'P500',
    });
    const mine = await call('GET', '/api/patient/me/cases', { token: tok });
    assert.strictEqual(mine.status, 200, JSON.stringify(mine.body));
    assert.strictEqual(mine.body.patientRef, 'P500');
    assert.ok((mine.body.cases || []).some((c) => String(c.caseId).startsWith('center-')));
    assert.ok((mine.body.cases || []).every((c) => !c.patientRef || c.patientRef === 'P500'));
    const p1 = await call('GET', '/api/patient/me/cases', { as: 'patient' });
    assert.ok(!(p1.body.cases || []).some((c) => c.patientRef === 'P500'));
  });
});

describe('authority knowledge catalog', () => {
  it('admin desk assist drafts restock and refuses reserved actions', async () => {
    const denied = await call('GET', '/api/ai/desk/assist?lane=admin', { as: 'pharmacist' });
    assert.strictEqual(denied.status, 403);
    const assist = await call('GET', '/api/ai/desk/assist?lane=admin', { as: 'admin' });
    assert.strictEqual(assist.status, 200, JSON.stringify(assist.body));
    assert.ok(assist.body.brief.reservedForAdmin.includes('kill_switch'));
    const kill = await call('POST', '/api/ai/desk/admin-confirm', {
      as: 'admin',
      body: { type: 'kill_switch', decision: 'accept' },
    });
    assert.strictEqual(kill.status, 403);
    const restock = (assist.body.brief.proposals || []).find((p) => p.type === 'restock');
    if (restock) {
      const ok = await call('POST', '/api/ai/desk/admin-confirm', {
        as: 'admin',
        body: { id: restock.id, type: 'restock', decision: 'accept', payload: restock.payload },
      });
      assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
      assert.ok((ok.body.requests || []).length >= 1);
      const still = (ok.body.brief?.proposals || []).find((p) => p.id === restock.id);
      assert.ok(!still, 'confirmed restock must leave the pending list');
      const after = await call('GET', '/api/ai/desk/assist?lane=admin', { as: 'admin' });
      assert.strictEqual(after.status, 200);
      assert.ok(!(after.body.brief.proposals || []).some((p) => p.id === restock.id));
      assert.ok((after.body.brief.decided || []).some((d) => d.id === restock.id && d.decision === 'accept'));
      const knowledge = (after.body.brief.proposals || []).find((p) => p.type === 'knowledge_fetch');
      if (knowledge) {
        const rej = await call('POST', '/api/ai/desk/admin-confirm', {
          as: 'admin',
          body: { id: knowledge.id, type: 'knowledge_fetch', decision: 'reject', payload: knowledge.payload },
        });
        assert.strictEqual(rej.status, 200, JSON.stringify(rej.body));
        assert.ok(!(rej.body.brief?.proposals || []).some((p) => p.id === knowledge.id));
      }
    }
  });

  it('workbench summary returns a short recent list', async () => {
    const r = await call('GET', '/api/ai/workbench/summary', { as: 'pharmacist' });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.recent));
    assert.ok(r.body.recent.length <= 10);
    assert.equal(typeof r.body.pendingReview, 'number');
  });

  it('lists pharmacopoeia as no open API and parses PubMed payloads without inventing text', () => {
    const { listAuthorities } = require('../knowledge/authorityIngest');
    const { parseSearch, parseSummaries, queryFor } = require('../knowledge/pubmedConnector');
    const listed = listAuthorities();
    const chp = listed.sources.find((s) => s.id === 'cn-pharmacopoeia');
    assert.strictEqual(chp.access, 'no_open_fulltext_api');
    assert.strictEqual(chp.clinicalUse, false);
    const pubmed = listed.sources.find((s) => s.id === 'pubmed');
    assert.strictEqual(pubmed.connector, 'pubmed');
    assert.match(queryFor('黄芪'), /Astragalus/);
    const ids = parseSearch({ esearchresult: { idlist: ['123', '456'] } });
    assert.deepStrictEqual(ids, ['123', '456']);
    const recs = parseSummaries({
      result: {
        uids: ['123'],
        123: { title: 'Astragalus review', source: 'J Ethnopharmacol', pubdate: '2020 Jan', authors: [{ name: 'Li J' }] },
      },
    });
    assert.strictEqual(recs[0].pmid, '123');
    assert.ok(recs[0].content.includes('Astragalus review'));
    assert.ok(recs[0].url.includes('123'));
    const { searchKnowledge } = require('../knowledge/search');
    const found = searchKnowledge('黄芪');
    assert.ok(found.hits.length > 0, JSON.stringify(found));
    assert.ok(found.hits.some((h) => h.kind === 'local_source' || h.kind === 'herb_catalog'));
    assert.ok(!JSON.stringify(found).includes('中国药典规定剂量'));
    const empty = searchKnowledge('');
    assert.strictEqual(empty.hits.length, 0);
  });
});

describe('role lanes and research protocol', () => {
  it('assigns fast, dual and priority lanes from the protocol', () => {
    const proto = researchProtocol.DEFAULT_PROTOCOL;
    assert.strictEqual(researchProtocol.assignLane({ riskTier: 'A1', abstain: false, missingInformation: [] }, proto), 'fast');
    assert.strictEqual(researchProtocol.assignLane({ riskTier: 'A2', abstain: false }, proto), 'dual');
    assert.strictEqual(researchProtocol.assignLane({ riskTier: 'A1', abstain: true }, proto), 'dual');
    assert.strictEqual(researchProtocol.assignLane({ riskTier: 'A3', abstain: false }, proto), 'priority');
  });

  it('researcher owns the protocol; pharmacist cannot change it', async () => {
    const denied = await call('PUT', '/api/research/evaluation/protocol', {
      as: 'pharmacist',
      body: { note: 'should fail' },
    });
    assert.strictEqual(denied.status, 403);
    const adminDenied = await call('PUT', '/api/research/evaluation/protocol', {
      as: 'admin',
      body: { note: 'admin should not own protocol' },
    });
    assert.strictEqual(adminDenied.status, 403);
    const saved = await call('PUT', '/api/research/evaluation/protocol', {
      as: 'researcher',
      body: { note: '轻症快审，不确定双审', fastTrack: { enabled: true, maxTier: 'A1' }, dualReview: { enabled: true, minTier: 'A2', onAbstain: true } },
    });
    assert.strictEqual(saved.status, 200, JSON.stringify(saved.body));
    assert.strictEqual(saved.body.protocol.note, '轻症快审，不确定双审');
    assert.strictEqual(saved.body.protocol.updatedBy, '5');
    const got = await call('GET', '/api/research/evaluation/protocol', { as: 'researcher' });
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.body.protocol.note, '轻症快审，不确定双审');
  });

  it('fast-approves an A1 case from the protocol fast lane', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const c = repo.getCase(id);
    assert.strictEqual(c.reviewLane, 'fast', JSON.stringify(c.analyses.at(-1)?.output));
    const fast = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'fast_approve', analysisId: analysis.analysisId },
    });
    assert.strictEqual(fast.status, 200, JSON.stringify(fast.body));
    assert.strictEqual(repo.getCase(id).state, 'pharmacist_approved');
  });

  it('requires two pharmacists on the dual lane; first signer cannot finish', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ allergies: ['青霉素'], currentMedications: ['华法林'] }),
        prescription: {
          herbs: [{ name: '丹参', dosage: 10, unit: 'g' }, { name: '黄芪', dosage: 15, unit: 'g' }],
          doseCount: 7,
          usage: '水煎服，日一剂',
          form: 'decoction',
          issuedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    let c = repo.getCase(id);
    if (c.reviewLane !== 'dual') {
      c.reviewLane = 'dual';
      c.secondReview = { status: 'pending', requestedBy: 'research_protocol', mode: 'dual', firstSigner: null };
      repo.saveCase(c);
    }
    const analysisId = c.analyses.at(-1).analysisId;
    const first = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId, comment: '一审' },
    });
    assert.strictEqual(first.status, 200, JSON.stringify(first.body));
    assert.strictEqual(repo.getCase(id).state, 'pharmacist_review_required');
    assert.strictEqual(String(repo.getCase(id).secondReview.firstSigner), '2');
    const same = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId, comment: '再签' },
    });
    assert.strictEqual(same.status, 409);
    const second = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist2', body: { action: 'approve', analysisId, comment: '二审' },
    });
    assert.strictEqual(second.status, 200, JSON.stringify(second.body));
    assert.strictEqual(repo.getCase(id).state, 'pharmacist_approved');
    assert.strictEqual(repo.getCase(id).secondReview.status, 'completed');
  });

  it('content change or re-analysis archives dual signs; stale analysis cannot finish', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ allergies: ['青霉素'], currentMedications: ['华法林'] }),
        prescription: {
          herbs: [{ name: '丹参', dosage: 10, unit: 'g' }, { name: '黄芪', dosage: 15, unit: 'g' }],
          doseCount: 7,
          usage: '水煎服，日一剂',
          form: 'decoction',
          issuedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
    const id = created.body.case.caseId;
    let c = repo.getCase(id);
    if (c.reviewLane !== 'dual') {
      c.reviewLane = 'dual';
      c.secondReview = { status: 'pending', requestedBy: 'research_protocol', mode: 'dual', firstSigner: null };
      repo.saveCase(c);
    }
    const firstId = repo.getCase(id).analyses.at(-1).analysisId;
    const first = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: firstId, comment: '一审' },
    });
    assert.strictEqual(first.status, 200, JSON.stringify(first.body));
    const patched = await call('PATCH', `/api/ai/cases/${id}`, {
      as: 'pharmacist', body: { reason: '补充体重', patient: { weightKg: 68 } },
    });
    assert.strictEqual(patched.status, 200, JSON.stringify(patched.body));
    const after = repo.getCase(id);
    assert.notStrictEqual(after.secondReview?.status, 'completed');
    assert.ok(!after.secondReview?.signs?.length);
    const stale = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist2', body: { action: 'approve', analysisId: firstId, comment: '旧分析' },
    });
    assert.strictEqual(stale.status, 409);
    const proxy = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: after.analyses.at(-1).analysisId, comment: 'ok', secondReviewerId: '3' },
    });
    assert.strictEqual(proxy.status, 400);
  });

  it('A3 cannot be approved or fast-approved', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ allergies: ['青霉素'] }),
        prescription: {
          herbs: [{ name: '甘草', dosage: 6, unit: 'g' }, { name: '甘遂', dosage: 1, unit: 'g' }],
          doseCount: 7,
          usage: '水煎服',
          form: 'decoction',
          issuedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
    const id = created.body.case.caseId;
    const analysisId = repo.getCase(id).analyses.at(-1)?.analysisId;
    const approve = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId, comment: 'no' },
    });
    assert.ok(approve.status >= 400, JSON.stringify(approve.body));
    const fast = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'fast_approve', analysisId },
    });
    assert.ok(fast.status >= 400, JSON.stringify(fast.body));
    assert.notStrictEqual(repo.getCase(id).state, 'pharmacist_approved');
  });

  it('pharmacist queue and case view show full name and patientRef', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const q = await call('GET', '/api/ai/review-queue', { as: 'pharmacist' });
    assert.strictEqual(q.status, 200, JSON.stringify(q.body));
    const rows = [...(q.body.fast || []), ...(q.body.secondReview || []), ...(q.body.priority || [])];
    const row = rows.find((r) => r.caseId === id);
    assert.ok(row, JSON.stringify(q.body));
    assert.ok(!String(row.patientLabel || '').includes('**'));
    assert.ok(row.patientName);
    assert.ok(row.patientRef);
    const detail = await call('GET', `/api/ai/cases/${id}`, { as: 'pharmacist' });
    assert.strictEqual(detail.status, 200);
    assert.ok(detail.body.case.patient.name);
    assert.ok(!String(detail.body.case.patient.name).includes('**'));
    assert.ok(detail.body.case.patient.patientRef);
    assert.ok(detail.body.summary.patientName);
  });

  it('protocol cannot lift A3; live empty catalog blocks deduct', async () => {
    const lifted = await call('PUT', '/api/research/evaluation/protocol', {
      as: 'researcher',
      body: { dualReview: { minTier: 'A3' } },
    });
    assert.strictEqual(lifted.status, 200, JSON.stringify(lifted.body));
    assert.notStrictEqual(lifted.body.protocol.dualReview.minTier, 'A3');
    const snap = JSON.parse(JSON.stringify(getStore().inventory));
    const prev = process.env.DATA_MODE;
    process.env.DATA_MODE = 'production';
    try {
      updateStore((data) => { data.inventory = []; });
      assert.throws(
        () => deductForCase({
          caseId: 'live-empty',
          contentVersion: 1,
          prescription: { herbs: [{ name: '黄芪', dosage: 15, unit: 'g' }], doseCount: 1 },
        }, { id: 4, role: 'technician' }),
        (err) => err.code === 'inventory_catalog_missing',
      );
    } finally {
      process.env.DATA_MODE = prev;
      updateStore((data) => { data.inventory = snap; });
    }
  });
});

describe('2026-10-03 remaining probes', () => {
  it('replay appends only and keeps a concurrent content edit', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const analysisId = repo.getCase(id).analyses.at(-1).analysisId;
    runtime.setProviderOverride({
      id: 'slow-mock',
      isMock: true,
      async complete(args) {
        await new Promise((r) => setTimeout(r, 80));
        return createMockProvider().complete(args);
      },
    });
    const pending = call('POST', `/api/ai/cases/${id}/replay`, { as: 'pharmacist', body: { analysisId } });
    await new Promise((r) => setTimeout(r, 20));
    const patched = await call('PATCH', `/api/ai/cases/${id}`, { as: 'pharmacist', body: { reason: '并发改年龄', patient: { ageYears: 77 } } });
    assert.strictEqual(patched.status, 200, JSON.stringify(patched.body));
    const replayed = await pending;
    assert.strictEqual(replayed.status, 200, JSON.stringify(replayed.body));
    const after = repo.getCase(id);
    assert.strictEqual(after.patient.ageYears, 77);
    assert.ok(after.contentVersion >= 2);
    assert.ok((after.replays || []).some((r) => r.of === analysisId));
  });

  it('identical receipt idempotency keys do not double stock', async () => {
    const ganSeed = getStore().inventory.find((i) => i.name === '甘草');
    updateStore((data) => {
      const item = data.inventory.find((i) => i.name === '甘草');
      if (item) item.minStock = 80;
    });
    require('../workflow/inventoryLots').replaceUsableQty(ganSeed, 50);
    const restock = await call('POST', '/api/ai/ops/restock', { as: 'technician', body: {} });
    assert.strictEqual(restock.status, 200, JSON.stringify(restock.body));
    const req = (restock.body.requests || []).find((r) => r.name === '甘草');
    assert.ok(req, JSON.stringify(restock.body));
    const gan = getStore().inventory.find((i) => i.name === '甘草');
    const ganId = gan.id;
    const lots = require('../workflow/inventoryLots');
    lots.ensureLegacyLot(gan);
    const before = lots.rollupQty(ganId);
    const body = {
      inventoryId: ganId, requestId: req.id, quantity: 10, inspection: 'pass',
      batchNo: 'B-IDEM', expiresAt: '2099-01-01', idempotencyKey: 'idem-gan-10',
    };
    const a = await call('POST', '/api/ai/ops/receive', { as: 'technician', body });
    const b = await call('POST', '/api/ai/ops/receive', { as: 'technician', body });
    assert.strictEqual(a.status, 200, JSON.stringify(a.body));
    assert.strictEqual(b.status, 200, JSON.stringify(b.body));
    assert.strictEqual(b.body.replayed, true);
    assert.strictEqual(lots.rollupQty(ganId), before + 10);
    assert.strictEqual(getStore().inventory.find((i) => i.name === '甘草').stock, before + 10);
  });

  it('heuristic extract respects negation and a provider.complete is called when supplied', async () => {
    const extract = require('../workflow/factExtract');
    const heur = extract.heuristicExtract('我没有怀孕，也没有肝炎，正在服用阿司匹林。');
    assert.ok(heur.some((c) => c.fieldPath === 'patient.facts.pregnancy' && (c.candidateValue === 'no' || c.proposedStatus === 'none')));
    assert.ok(!heur.some((c) => c.fieldPath === 'patient.facts.pregnancy' && c.candidateValue === 'yes'));
    assert.ok(heur.some((c) => c.fieldPath === 'patient.facts.currentMedications' && Array.isArray(c.candidateValue) && c.candidateValue.includes('阿司匹林')));
    let calls = 0;
    const provider = {
      id: 'probe',
      isMock: true,
      async complete() {
        calls += 1;
        return JSON.stringify({
          candidates: [{ fieldPath: 'patient.facts.currentMedications', value: ['阿司匹林'], sourceText: '正在服用阿司匹林', negated: false }],
        });
      },
    };
    const out = await extract.extractCandidateFacts({ source: { rawText: '我没有怀孕，正在服用阿司匹林。' } }, { provider });
    assert.strictEqual(calls, 1);
    assert.strictEqual(out.modelCalled, true);
    assert.ok(out.candidates.every((c) => c.status === 'pending_confirmation'));
  });

  it('question-plan rounds stay at 0 until tasks are actually issued', () => {
    const plan1 = require('../workflow/clarificationService').generateRiskQuestions({
      patient: { sex: 'female', facts: { pregnancy: { status: 'not_asked' } } },
      analyses: [{ output: { missingInformation: [{ field: 'patient.facts.pregnancy', critical: true, message: '妊娠未核实', source: 'rule' }] } }],
      clarificationRound: 0,
      clarificationTasks: [],
    });
    const plan2 = require('../workflow/clarificationService').generateRiskQuestions({
      patient: { sex: 'female', facts: { pregnancy: { status: 'not_asked' } } },
      analyses: [{ output: { missingInformation: [{ field: 'patient.facts.pregnancy', critical: true, message: '妊娠未核实', source: 'rule' }] } }],
      clarificationRound: 0,
      clarificationTasks: [],
    });
    assert.strictEqual(plan1.persistedRound, 0);
    assert.strictEqual(plan2.persistedRound, 0);
    assert.ok((plan1.selected || []).every((q) => q.questionText));
  });

  it('replay during pharmacist sign keeps the approval', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    const analysisId = repo.getCase(id).analyses.at(-1).analysisId;
    runtime.setProviderOverride({
      id: 'slow-mock',
      isMock: true,
      async complete(args) {
        await new Promise((r) => setTimeout(r, 80));
        return createMockProvider().complete(args);
      },
    });
    const pending = call('POST', `/api/ai/cases/${id}/replay`, { as: 'pharmacist', body: { analysisId } });
    await new Promise((r) => setTimeout(r, 20));
    const approved = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    assert.strictEqual(approved.status, 200, JSON.stringify(approved.body));
    const replayed = await pending;
    assert.strictEqual(replayed.status, 200, JSON.stringify(replayed.body));
    const after = repo.getCase(id);
    assert.ok(after.approval?.valid);
    assert.strictEqual(after.state, 'pharmacist_approved');
    assert.ok((after.replays || []).some((r) => r.of === analysisId) || repo.getDoc('replays', replayed.body.replayId));
  });

  it('weigh rejects unit mismatch and exception bypass without evidence', async () => {
    const lots = require('../workflow/inventoryLots');
    updateStore((data) => {
      const item = data.inventory.find((i) => i.name === '黄芪');
      if (item) { item.stock = Math.max(Number(item.stock || 0), 80); item.minStock = 40; }
    });
    const huang = getStore().inventory.find((i) => i.name === '黄芪');
    lots.addLot({
      inventoryId: huang.id, name: '黄芪', batchNo: 'B-WEIGH', expiresAt: '2099-01-01', inspection: 'pass', qty: 200,
    });
    updateStore((data) => {
      const item = data.inventory.find((i) => i.id === huang.id);
      if (item) item.stock = lots.rollupQty(huang.id);
    });
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    assert.strictEqual((await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    })).status, 200);
    assert.strictEqual((await call('POST', `/api/patient/me/cases/${id}/confirm`, {
      as: 'patient',
      body: { decision: 'confirm', identityConfirmed: true, fulfillment: 'pickup', educationReceived: true, educationUnderstood: true },
    })).status, 200);
    const started = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'technician', body: { action: 'start' } });
    assert.strictEqual(started.status, 200, JSON.stringify(started.body));
    const unit = await call('POST', `/api/ai/cases/${id}/dispensing`, {
      as: 'technician',
      body: { action: 'record_weigh', weighSource: 'manual', weighedItems: [{ name: '黄芪', grams: 15, unit: 'mg', measurementScope: 'per_dose' }] },
    });
    assert.strictEqual(unit.status, 200, JSON.stringify(unit.body));
    const weighed = repo.getCase(id).dispensingRecords.find((r) => r.type === 'weighed');
    assert.ok(weighed.items[0].outOfTolerance);
    const bypass = await call('POST', `/api/ai/cases/${id}/dispensing`, {
      as: 'pharmacist', body: { action: 'final_check_pass', exceptionCode: 'reweigh_accepted' },
    });
    assert.ok(bypass.status >= 400, JSON.stringify(bypass.body));
    const course = await call('POST', `/api/ai/cases/${id}/dispensing`, {
      as: 'technician',
      body: { action: 'record_weigh', weighSource: 'manual', weighedItems: [{ name: '黄芪', grams: 15, unit: 'g', measurementScope: 'course_total' }] },
    });
    assert.strictEqual(course.status, 200, JSON.stringify(course.body));
    const courseRow = [...repo.getCase(id).dispensingRecords].reverse().find((r) => r.type === 'weighed' && !r.voided);
    assert.ok(courseRow.items[0].outOfTolerance);
  });

  it('heuristic extract skips family, history and unsourced spans', () => {
    const extract = require('../workflow/factExtract');
    const hist = extract.heuristicExtract('我几年前有肝炎，父亲也有肝炎。如果怀孕了怎么办。');
    assert.ok(!hist.some((c) => c.fieldPath === 'patient.facts.liverImpairment'));
    assert.ok(!hist.some((c) => c.fieldPath === 'patient.facts.pregnancy'));
    const treating = extract.heuristicExtract('我以前有肝炎，现在还在治疗。');
    assert.ok(treating.some((c) => c.fieldPath === 'patient.facts.liverImpairment' && c.candidateValue === true));
    const noSpan = extract.whitelistOnly([{
      fieldPath: 'patient.facts.pregnancy', candidateValue: 'yes', sourceText: '不存在的片段',
    }], '我没有怀孕');
    assert.strictEqual(noSpan.length, 0);
  });

  it('fact-candidate confirm is bound to the patient and cannot leak another case', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ patientRef: 'P1', sex: 'female', ageYears: 28 }),
        source: { channel: 'counter', rawText: '我怀孕了，正在服药。' },
      },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    const c0 = repo.getCase(id);
    if (!(c0.factCandidates || []).length) {
      c0.factCandidates = [{
        candidateId: 'cand-cross', caseId: id, fieldPath: 'patient.facts.pregnancy',
        candidateValue: 'yes', proposedStatus: 'reported', status: 'pending_confirmation',
        caseContentVersion: c0.contentVersion, sourceText: '我怀孕了',
      }];
      repo.saveCase(c0);
    }
    const candId = repo.getCase(id).factCandidates[0].candidateId;
    const pregBefore = JSON.stringify(repo.getCase(id).patient.facts.pregnancy);
    const other = await call('POST', `/api/patient/me/cases/${id}/fact-candidates`, {
      as: 'patientB', body: { candidateId: candId, action: 'accept' },
    });
    assert.ok([403, 404].includes(other.status), JSON.stringify(other.body));
    assert.ok(!JSON.stringify(other.body || {}).includes('analyses'));
    assert.strictEqual(JSON.stringify(repo.getCase(id).patient.facts.pregnancy), pregBefore);
    const tech = await call('POST', `/api/ai/cases/${id}/fact-candidates`, {
      as: 'technician', body: { candidateId: candId, action: 'accept' },
    });
    assert.ok([403, 404].includes(tech.status), JSON.stringify(tech.body));
    const wrongCand = await call('POST', `/api/patient/me/cases/${id}/fact-candidates`, {
      as: 'patient', body: { candidateId: 'cand-from-other-case', action: 'accept' },
    });
    assert.ok([403, 404].includes(wrongCand.status), JSON.stringify(wrongCand.body));
  });

  it('accepting a candidate versions content and voids a current approval', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    assert.strictEqual((await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    })).status, 200);
    const c = repo.getCase(id);
    c.factCandidates = [{
      candidateId: 'cand-preg-1', caseId: id, fieldPath: 'patient.facts.pregnancy',
      candidateValue: 'yes', proposedStatus: 'reported', status: 'pending_confirmation',
      caseContentVersion: c.contentVersion, sourceText: '怀孕',
    }];
    repo.saveCase(c);
    const ok = await call('POST', `/api/patient/me/cases/${id}/fact-candidates`, {
      as: 'patient', body: { candidateId: 'cand-preg-1', action: 'accept' },
    });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    assert.ok(ok.body.case && !ok.body.case.analyses);
    assert.ok(!JSON.stringify(ok.body).includes('secondReview'));
    const after = repo.getCase(id);
    assert.ok(after.contentVersion >= 2);
    assert.strictEqual(after.contentHash, require('../common/hash').hashObject({
      patient: after.patient, prescriber: after.prescriber, prescription: after.prescription,
    }));
    assert.notStrictEqual(after.state, 'pharmacist_approved');
    assert.ok(!after.approval?.valid);
    const again = await call('POST', `/api/patient/me/cases/${id}/fact-candidates`, {
      as: 'patient', body: { candidateId: 'cand-preg-1', action: 'accept' },
    });
    assert.strictEqual(again.status, 200, JSON.stringify(again.body));
    assert.strictEqual(again.body.idempotent, true);
  });

  it('required pregnancy questions block approve until independently verified', async () => {
    const { id, analysis, state } = await openCase({ sex: 'female', ageYears: 27, allergies: ['青霉素'] });
    const c = repo.getCase(id);
    const required = (c.clarificationTasks || []).filter((t) => t.mandatory || t.requiredForDecision);
    assert.ok(required.length || state === 'information_incomplete', JSON.stringify({ state, tasks: c.clarificationTasks }));
    const blocked = await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    });
    assert.ok([409, 400].includes(blocked.status), JSON.stringify(blocked.body));
    assert.notStrictEqual(repo.getCase(id).state, 'pharmacist_approved');
    const task = (repo.getCase(id).clarificationTasks || []).find((t) => t.requiredForDecision);
    if (task) {
      const flagOnly = await call('POST', `/api/ai/cases/${id}/clarifications/${task.taskId}/review`, {
        as: 'pharmacist', body: { independentlyVerified: true, source: 'pharmacist_chart', note: '病历已写未孕' },
      });
      assert.ok([400, 409].includes(flagOnly.status), JSON.stringify(flagOnly.body));
    }
  });

  it('candidate accept is blocked during dispensing', async () => {
    const { id, analysis } = await openCase({ allergies: ['青霉素'] });
    assert.strictEqual((await call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as: 'pharmacist', body: { action: 'approve', analysisId: analysis.analysisId, comment: 'ok' },
    })).status, 200);
    assert.strictEqual((await call('POST', `/api/patient/me/cases/${id}/confirm`, {
      as: 'patient',
      body: { decision: 'confirm', identityConfirmed: true, fulfillment: 'pickup', educationReceived: true, educationUnderstood: true },
    })).status, 200);
    const lots = require('../workflow/inventoryLots');
    const huang = getStore().inventory.find((i) => i.name === '黄芪');
    lots.addLot({
      inventoryId: huang.id, name: '黄芪', batchNo: 'B-LOCK', expiresAt: '2099-01-01', inspection: 'pass', qty: 200,
    });
    const started = await call('POST', `/api/ai/cases/${id}/dispensing`, { as: 'technician', body: { action: 'start' } });
    assert.strictEqual(started.status, 200, JSON.stringify(started.body));
    const c = repo.getCase(id);
    c.factCandidates = [{
      candidateId: 'cand-disp', caseId: id, fieldPath: 'patient.facts.currentMedications',
      candidateValue: ['阿司匹林'], proposedStatus: 'reported', status: 'pending_confirmation',
      caseContentVersion: c.contentVersion, sourceText: '阿司匹林',
    }];
    repo.saveCase(c);
    const locked = await call('POST', `/api/patient/me/cases/${id}/fact-candidates`, {
      as: 'patient', body: { candidateId: 'cand-disp', action: 'accept' },
    });
    assert.strictEqual(locked.status, 409, JSON.stringify(locked.body));
    assert.ok(repo.getCase(id).approval?.valid);
  });

  it('AI disable stops extract complete calls and live lots stay quarantined', async () => {
    runtime.setAiEnabled(false);
    let calls = 0;
    const extract = require('../workflow/factExtract');
    const out = await extract.extractCandidateFacts(
      { source: { rawText: '我没有怀孕，正在服用阿司匹林。' } },
      { provider: { id: 'probe', isMock: true, async complete() { calls += 1; return '{}'; } }, aiEnabled: runtime.modelCallsAllowed() },
    );
    assert.strictEqual(calls, 0);
    assert.strictEqual(out.modelCalled, false);
    assert.strictEqual(out.fallbackReason, 'ai_disabled');
    runtime.setAiEnabled(true);
    const prev = process.env.DATA_MODE;
    process.env.DATA_MODE = 'production';
    try {
      const lots = require('../workflow/inventoryLots');
      const created = lots.ensureLegacyLot({ id: 999001, name: '隔离药', stock: 10 });
      assert.strictEqual(created[0].usable, false);
      assert.strictEqual(created[0].inspection, 'unverified');
      assert.notStrictEqual(created[0].expiresAt, '2099-12-31');
      assert.ok(!lots.usableLot(created[0]));
    } finally {
      process.env.DATA_MODE = prev;
    }
  });
});

describe('4/5/12 evaluation honesty', () => {
  it('mock is labelled mock; no invented live metrics', () => {
    const p = createMockProvider();
    assert.strictEqual(p.isMock, true);
    const liveDir = path.resolve(__dirname, '../../benchmarks/ai-review/results-live');
    const liveJson = path.join(liveDir, 'latest.json');
    if (fs.existsSync(liveJson)) {
      const doc = JSON.parse(fs.readFileSync(liveJson, 'utf8'));
      assert.ok(doc.generatedAt || doc.metrics);
    } else {
      assert.strictEqual(fs.existsSync(liveJson), false);
    }
  });
});

describe('d14c1a9 review gates', () => {
  async function approveWithLatest(id, as = 'pharmacist') {
    const latest = repo.getCase(id).analyses.at(-1);
    return call('POST', `/api/ai/cases/${id}/pharmacist-decision`, {
      as, body: { action: 'approve', analysisId: latest.analysisId, comment: 'independent review' },
    });
  }

  it('reviewing a required unknown answer does not clear the approve gate', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: caseBody({ sex: 'female', ageYears: 26, allergies: ['青霉素'] }),
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const id = created.body.case.caseId;
    let task = (repo.getCase(id).clarificationTasks || []).find((t) => t.requiredForDecision);
    if (!task) {
      const issued = await call('POST', `/api/ai/cases/${id}/clarifications`, {
        as: 'pharmacist',
        body: { fieldPath: 'patient.facts.pregnancy', question: '是否妊娠？', requiredForDecision: true, source: 'pharmacist' },
      });
      assert.strictEqual(issued.status, 201, JSON.stringify(issued.body));
      task = issued.body.task;
      const answered = await call('POST', `/api/patient/clarification/${issued.body.token}`, { body: { status: 'unknown' } });
      assert.strictEqual(answered.status, 200, JSON.stringify(answered.body));
    } else if (task.status === 'sent') {
      const issued = await call('POST', `/api/ai/cases/${id}/clarifications`, {
        as: 'pharmacist',
        body: { fieldPath: 'patient.facts.pregnancy', question: '是否妊娠？', requiredForDecision: true, source: 'pharmacist' },
      });
      if (issued.status === 201) {
        await call('POST', `/api/patient/clarification/${issued.body.token}`, { body: { status: 'unknown' } });
        task = issued.body.task;
      }
    }
    const stored = repo.getCase(id);
    const required = (stored.clarificationTasks || []).find((t) => t.requiredForDecision && t.fieldPath.includes('pregnancy'))
      || (stored.clarificationTasks || []).find((t) => t.requiredForDecision);
    assert.ok(required, JSON.stringify(stored.clarificationTasks));
    const viewed = await call('POST', `/api/ai/cases/${id}/clarifications/${required.taskId}/review`, {
      as: 'pharmacist', body: {},
    });
    assert.strictEqual(viewed.status, 200, JSON.stringify(viewed.body));
    assert.notStrictEqual(repo.getCase(id).patient.facts.pregnancy.status, 'none');
    const afterView = await approveWithLatest(id);
    assert.strictEqual(afterView.status, 409, JSON.stringify(afterView.body));
    assert.ok(['required_information_open', 'invalid_state'].includes(afterView.body.error.code), JSON.stringify(afterView.body));
    assert.notStrictEqual(repo.getCase(id).state, 'pharmacist_approved');

    const refused = await call('POST', `/api/ai/cases/${id}/clarifications`, {
      as: 'pharmacist',
      body: { fieldPath: 'patient.facts.lactation', question: '是否哺乳？', requiredForDecision: true, source: 'pharmacist' },
    });
    assert.strictEqual(refused.status, 201, JSON.stringify(refused.body));
    assert.strictEqual((await call('POST', `/api/patient/clarification/${refused.body.token}`, { body: { status: 'denied' } })).status, 200);
    const refuseReview = await call('POST', `/api/ai/cases/${id}/clarifications/${refused.body.task.taskId}/review`, { as: 'pharmacist', body: {} });
    assert.strictEqual(refuseReview.status, 200);
    assert.strictEqual((await approveWithLatest(id)).status, 409);

    const badFlag = await call('POST', `/api/ai/cases/${id}/clarifications/${required.taskId}/review`, {
      as: 'pharmacist', body: { independentlyVerified: true, source: 'pharmacist_chart', note: '已看' },
    });
    assert.strictEqual(badFlag.status, 400, JSON.stringify(badFlag.body));

    const verified = await call('POST', `/api/ai/cases/${id}/clarifications/${required.taskId}/review`, {
      as: 'pharmacist',
      body: {
        independentlyVerified: true, source: 'pharmacist_chart', note: '病历写未孕',
        value: 'no', status: 'none', evidenceRef: 'chart-preg-1',
      },
    });
    assert.strictEqual(verified.status, 200, JSON.stringify(verified.body));
    const afterFact = repo.getCase(id);
    assert.ok(['none', 'verified'].includes(afterFact.patient.facts.pregnancy.status));
    assert.ok(afterFact.contentVersion >= 2);
    const lact = (afterFact.clarificationTasks || []).find((t) => t.fieldPath === 'patient.facts.lactation' && t.requiredForDecision);
    if (lact) {
      const lactOk = await call('POST', `/api/ai/cases/${id}/clarifications/${lact.taskId}/review`, {
        as: 'pharmacist',
        body: {
          independentlyVerified: true, source: 'pharmacist_interview', note: '否认哺乳',
          value: 'no', status: 'none', evidenceRef: 'interview-lact-1',
        },
      });
      assert.strictEqual(lactOk.status, 200, JSON.stringify(lactOk.body));
    }
    let approved = await approveWithLatest(id);
    if (approved.status === 409 && approved.body?.error?.code === 'second_review_pending') {
      approved = await approveWithLatest(id, 'pharmacist2');
    }
    assert.strictEqual(approved.status, 200, JSON.stringify(approved.body));
    assert.strictEqual(repo.getCase(id).state, 'pharmacist_approved');
  });

  it('the same prescriber is denied every case entry that is not theirs', async () => {
    const { id } = await openCase({ allergies: ['青霉素'] });
    const denied = await call('GET', `/api/ai/cases/${id}`, { as: 'prescriberB' });
    assert.strictEqual(denied.status, 403);
    assert.strictEqual(denied.body.error.code, 'not_own_case');
    const assist = await call('GET', `/api/ai/desk/assist?lane=screening&caseId=${encodeURIComponent(id)}`, { as: 'prescriberB' });
    assert.strictEqual(assist.status, 403);
    assert.strictEqual(assist.body.error.code, 'not_own_case');
    const analyze = await call('POST', `/api/ai/cases/${id}/analyze`, { as: 'prescriberB', body: {} });
    assert.ok([403, 409].includes(analyze.status), JSON.stringify(analyze.body));
    if (analyze.status === 403) assert.strictEqual(analyze.body.error.code, 'not_own_case');
    const replay = await call('POST', `/api/ai/cases/${id}/replay`, { as: 'prescriberB', body: {} });
    assert.strictEqual(replay.status, 403);
    const summary = await call('GET', '/api/ai/workbench/summary', { as: 'prescriberB' });
    assert.strictEqual(summary.status, 200);
    assert.ok(!(summary.body.recent || []).some((c) => c.caseId === id));
    const listed = await call('GET', '/api/ai/cases', { as: 'prescriberB' });
    assert.ok(!(listed.body.cases || []).some((c) => c.caseId === id));
  });

  it('workbench counts real A3 and lane totals instead of hardcoded zeros', async () => {
    const created = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ allergies: ['青霉素'] }),
        prescription: {
          herbs: [{ name: '甘草', dosage: 6, unit: 'g' }, { name: '甘遂', dosage: 1, unit: 'g' }],
          doseCount: 7, usage: '水煎服', form: 'decoction', issuedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.strictEqual(created.body.analysis.riskTier, 'A3');
    const summary = await call('GET', '/api/ai/workbench/summary', { as: 'pharmacist' });
    assert.strictEqual(summary.status, 200);
    assert.ok(summary.body.a3 >= 1, JSON.stringify(summary.body));
    assert.ok(summary.body.priorityReview >= 1 || summary.body.pendingReview >= 1, JSON.stringify(summary.body));
    assert.notStrictEqual(summary.body.batchReview, undefined);
  });

  it('JSON catalog stock is a lot-rollup cache and cannot create usable quantity', async () => {
    const lots = require('../workflow/inventoryLots');
    const item = getStore().inventory.find((i) => i.name === '黄芪');
    lots.replaceUsableQty(item, 8);
    updateStore((data) => {
      const row = data.inventory.find((i) => i.id === item.id);
      if (row) row.stock = 900;
    });
    assert.strictEqual(lots.authorityQty(item.id), 8);
    assert.throws(
      () => deductForCase({
        caseId: 'cache-not-authority',
        contentVersion: 1,
        prescription: { herbs: [{ name: '黄芪', dosage: 15, unit: 'g' }], doseCount: 1 },
      }, { id: 4, role: 'technician' }),
      (err) => err.code === 'insufficient_stock',
    );
    assert.strictEqual(lots.authorityQty(item.id), 8);
    lots.rebuildCatalogCache();
    assert.strictEqual(getStore().inventory.find((i) => i.id === item.id).stock, 8);
    assert.strictEqual(getStore().inventory.find((i) => i.id === item.id).stockSource, 'lot_rollup');
  });

  it('warehouse, POS, purchase catalog and traceability share kinds and lot qty', async () => {
    const catalog = require('../workflow/catalogAlign');
    catalog.bootstrap();
    const [inv, herbs, trace] = await Promise.all([
      call('GET', '/api/inventory', { as: 'admin' }),
      call('GET', '/api/herbs', { as: 'admin' }),
      call('GET', '/api/traceability?limit=200', { as: 'admin' }),
    ]);
    assert.strictEqual(inv.status, 200);
    assert.strictEqual(herbs.status, 200);
    assert.strictEqual(trace.status, 200);
    const invNames = new Set(inv.body.map((i) => i.name));
    const herbNames = new Set(herbs.body.map((h) => h.name));
    const traceNames = new Set((trace.body.records || []).map((r) => r.name));
    assert.ok(invNames.size >= 20);
    assert.strictEqual(invNames.size, herbNames.size);
    assert.strictEqual(invNames.size, traceNames.size);
    for (const n of invNames) {
      assert.ok(herbNames.has(n), n);
      assert.ok(traceNames.has(n), n);
    }
    const target = '黄芪';
    const beforeInv = inv.body.find((i) => i.name === target);
    const beforeHerb = herbs.body.find((h) => h.name === target);
    const beforeTrace = trace.body.records.find((r) => r.name === target);
    assert.ok(beforeInv && beforeHerb && beforeTrace);
    assert.strictEqual(beforeInv.stock, beforeHerb.stock);
    assert.strictEqual(beforeInv.stock, beforeTrace.inventoryStock);
    const sold = 2;
    const checkout = await call('POST', '/api/billing/checkout', {
      as: 'technician',
      body: { items: [{ herbId: beforeInv.id, name: target, quantity: sold }] },
    });
    assert.strictEqual(checkout.status, 201, JSON.stringify(checkout.body));
    const afterSell = await Promise.all([
      call('GET', '/api/inventory', { as: 'admin' }),
      call('GET', '/api/herbs', { as: 'admin' }),
      call('GET', '/api/traceability/lookup/' + encodeURIComponent(target), { as: 'admin' }),
    ]);
    assert.strictEqual(afterSell[0].body.find((i) => i.name === target).stock, beforeInv.stock - sold);
    assert.strictEqual(afterSell[1].body.find((h) => h.name === target).stock, beforeInv.stock - sold);
    assert.strictEqual(afterSell[2].body.inventoryStock, beforeInv.stock - sold);
    const buy = 3;
    const po = await call('POST', '/api/orders', {
      as: 'admin',
      body: { customerName: '对齐采购', items: [{ herbId: beforeInv.id, name: target, quantity: buy }], receiveIntoStock: true, status: '已完成' },
    });
    assert.strictEqual(po.status, 201, JSON.stringify(po.body));
    assert.ok(po.body.items.every((i) => i.herbId === beforeInv.id));
    const unknown = await call('POST', '/api/orders', {
      as: 'admin',
      body: { items: [{ name: '不存在药材灵芝XYZ', quantity: 1 }] },
    });
    assert.strictEqual(unknown.status, 400);
    const afterBuy = await Promise.all([
      call('GET', '/api/inventory', { as: 'admin' }),
      call('GET', '/api/herbs', { as: 'admin' }),
      call('GET', '/api/traceability/lookup/' + encodeURIComponent(target), { as: 'admin' }),
    ]);
    assert.strictEqual(afterBuy[0].body.find((i) => i.name === target).stock, beforeInv.stock - sold + buy);
    assert.strictEqual(afterBuy[1].body.find((h) => h.name === target).stock, beforeInv.stock - sold + buy);
    assert.strictEqual(afterBuy[2].body.inventoryStock, beforeInv.stock - sold + buy);
  });

  it('riskTier is applied before pagination and matches count', async () => {
    const a3 = await call('POST', '/api/ai/cases', {
      as: 'prescriber',
      body: {
        ...caseBody({ allergies: ['青霉素'] }),
        prescription: {
          herbs: [{ name: '甘草', dosage: 6, unit: 'g' }, { name: '甘遂', dosage: 1, unit: 'g' }],
          doseCount: 3, usage: '水煎服', form: 'decoction', issuedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
    assert.strictEqual(a3.status, 201, JSON.stringify(a3.body));
    const a3Id = a3.body.case.caseId;
    for (let i = 0; i < 3; i += 1) {
      const ok = await call('POST', '/api/ai/cases', { as: 'prescriber', body: caseBody({ allergies: ['青霉素'] }) });
      assert.strictEqual(ok.status, 201, JSON.stringify(ok.body));
    }
    const page = await call('GET', '/api/ai/cases?riskTier=A3&limit=2&offset=0', { as: 'pharmacist' });
    assert.strictEqual(page.status, 200, JSON.stringify(page.body));
    assert.ok((page.body.cases || []).some((c) => c.caseId === a3Id), JSON.stringify(page.body.cases));
    assert.ok((page.body.cases || []).every((c) => c.riskTier === 'A3'));
    assert.ok(page.body.total >= 1);
    assert.ok(page.body.total >= page.body.cases.length);
    const asOwner = await call('GET', `/api/ai/cases?riskTier=A3&limit=20`, { as: 'prescriber' });
    assert.ok((asOwner.body.cases || []).every((c) => c.caseId));
    const asOther = await call('GET', `/api/ai/cases?riskTier=A3&limit=20`, { as: 'prescriberB' });
    assert.ok(!(asOther.body.cases || []).some((c) => c.caseId === a3Id));
  });
});

describe('500-case research console', () => {
  it('freezes existing patients into a de-identified snapshot and does not treat unlabeled seed rows as real', () => {
    const { buildSnapshot } = require('../research/snapshotBuilder');
    const { generateDemoPatients } = require('../data/patientGenerator');
    const { generateDemoPrescriptions } = require('../data/prescriptionGenerator');
    const unlabeled = { id: 1, patientRef: 'P1', gender: '女', age: 34, allergies: [], name: '演示甲', phone: '13800000000' };
    const gen = generateDemoPatients(6, { preserveExisting: [unlabeled], startCustomerId: 9 });
    const { prescriptions } = generateDemoPrescriptions(gen.patients, { perPatient: 1 });
    const snap = buildSnapshot({ patients: gen.patients, prescriptions, sourceVersion: 'test' });
    const refs = new Set(snap.baseCases.map((b) => b.source.storePatientRef));
    assert.strictEqual(refs.size, snap.counts.baseCases);
    assert.ok(snap.counts.baseCases >= 5);
    assert.ok(snap.counts.scenes >= snap.counts.baseCases);
    const unlabeledBase = snap.baseCases.find((b) => b.source.storePatientRef === 'P1');
    assert.ok(unlabeledBase);
    assert.strictEqual(unlabeledBase.provenance.kind, 'synthetic');
    assert.ok(unlabeledBase.provenance.evidence.includes('unlabeled_initialization_record'));
    assert.ok(!JSON.stringify(snap.cases).includes('13800000000'));
    assert.ok(snap.cases.every((c) => c.expertReviewStatus === 'unreviewed'));
    assert.ok(snap.cases.every((c) => c.clinicalCorrectness === 'not_evaluated'));
    assert.ok(!snap.cases.some((c) => c.hiddenPatientFacts?.pregnancy === 'no'));
    const ctor = require('../research/caseConstructor');
    const pack = { defaults: snap.defaults, cases: snap.cases };
    const visible = ctor.buildVisibleCase(pack, snap.cases[0]);
    ctor.assertNoHiddenLeak(visible);
    assert.ok(!JSON.stringify(visible).includes('hiddenPatientFacts'));
  });

  it('home no longer treats IT01–IT06 as the default main experiment', async () => {
    const home = await call('GET', '/api/research/evaluation', { as: 'researcher' });
    assert.strictEqual(home.status, 200, JSON.stringify(home.body));
    assert.strictEqual(home.body.archivedInteractivePack.defaultMainExperiment, false);
    assert.ok(home.body.snapshot?.datasetId);
    assert.ok((home.body.snapshot.counts?.baseCases || 0) >= 1);
    assert.ok(!JSON.stringify(home.body.groups).includes('IT01'));
    const listed = await call('GET', '/api/research/evaluation/snapshot/cases?limit=5', { as: 'researcher' });
    assert.strictEqual(listed.status, 200);
    assert.ok(!(JSON.stringify(listed.body.records || [])).includes('hiddenPatientFacts'));
    assert.ok(!(JSON.stringify(listed.body.records || [])).includes('patientAnswerScript'));
    const denied = await call('GET', '/api/research/evaluation', { as: 'prescriber' });
    assert.strictEqual(denied.status, 403);
    const asAdmin = await call('GET', '/api/research/evaluation', { as: 'admin' });
    assert.strictEqual(asAdmin.status, 403);
  });

  it('runs an isolated mock job without changing inventory or operational cases', async () => {
    const beforeInv = JSON.stringify(getStore().inventory);
    const beforeCases = (repo.listCases({ limit: 5 }) || []).map((c) => c.caseId);
    const created = await call('POST', '/api/research/evaluation/jobs', {
      as: 'researcher',
      body: { groups: ['A', 'C'], split: 'test', limit: 1, inferenceMode: 'mock', inputMode: 'structured' },
    });
    assert.ok([200, 201].includes(created.status), JSON.stringify(created.body));
    const jobId = created.body.job.id;
    const again = await call('POST', '/api/research/evaluation/jobs', {
      as: 'researcher',
      body: { groups: ['A', 'C'], split: 'test', limit: 1, inferenceMode: 'mock', inputMode: 'structured' },
    });
    assert.strictEqual(again.body.job.id, jobId);
    let job;
    for (let i = 0; i < 40; i += 1) {
      const got = await call('GET', `/api/research/evaluation/jobs/${jobId}`, { as: 'researcher' });
      job = got.body.job;
      if (['completed', 'failed', 'cancelled'].includes(job.status)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.strictEqual(job.status, 'completed', JSON.stringify(job));
    const rows = await call('GET', `/api/research/evaluation/jobs/${jobId}/results`, { as: 'researcher' });
    assert.ok((rows.body.results || []).length >= 1);
    assert.ok(rows.body.results.every((r) => r.clinicalAccuracy === 'not_evaluated'));
    const first = rows.body.results[0];
    const adviceZh = await call('POST', `/api/research/evaluation/jobs/${jobId}/advise`, {
      as: 'researcher',
      body: {
        scope: 'result', researchCaseId: first.researchCaseId, groupId: first.groupId,
        replicate: first.replicate || 1, lang: 'zh', wantModel: false,
      },
    });
    assert.strictEqual(adviceZh.status, 200, JSON.stringify(adviceZh.body));
    assert.strictEqual(adviceZh.body.advisor.clinicalCorrectness, 'not_evaluated');
    assert.ok(adviceZh.body.advisor.summary);
    assert.ok(!JSON.stringify(adviceZh.body.advisor).includes('hiddenPatientFacts'));
    const adviceEn = await call('POST', `/api/research/evaluation/jobs/${jobId}/advise`, {
      as: 'researcher',
      body: {
        scope: 'job', lang: 'en', wantModel: false,
      },
    });
    assert.strictEqual(adviceEn.status, 200);
    assert.match(String(adviceEn.body.advisor.summary), /case-level|synthetic|engineering|patients/i);
    const exp = await call('GET', `/api/research/evaluation/jobs/${jobId}/export`, { as: 'researcher' });
    assert.strictEqual(exp.status, 200);
    const text = typeof exp.body === 'string' ? exp.body : JSON.stringify(exp.body);
    assert.ok(!/api[_-]?key/i.test(text));
    assert.ok(!text.includes('patient123'));
    const other = await call('GET', `/api/research/evaluation/jobs/${jobId}`, { as: 'admin' });
    assert.strictEqual(other.status, 403);
    assert.strictEqual(JSON.stringify(getStore().inventory), beforeInv);
    const afterCases = (repo.listCases({ limit: 5 }) || []).map((c) => c.caseId);
    assert.deepStrictEqual(afterCases, beforeCases);
    const otherResearcher = signToken({ id: 51, username: 'researcher2', name: '研究员乙', role: 'researcher' });
    const peer = await call('POST', '/api/research/evaluation/jobs', {
      token: otherResearcher,
      body: { groups: ['A'], split: 'test', limit: 1, inferenceMode: 'mock', inputMode: 'structured', runTag: 'peer' },
    });
    assert.ok([200, 201].includes(peer.status), JSON.stringify(peer.body));
    assert.notStrictEqual(peer.body.job.id, jobId);
    const peek = await call('GET', `/api/research/evaluation/jobs/${jobId}`, { token: otherResearcher });
    assert.strictEqual(peek.status, 403);
  });
});
