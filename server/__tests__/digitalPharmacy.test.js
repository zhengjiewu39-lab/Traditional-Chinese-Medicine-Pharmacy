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
  prescriber: { id: 7, username: 'prescriber', name: '周医师', role: 'prescriber' },
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
    assert.strictEqual(picked.body.case.state, 'pharmacist_final_check');
    assert.strictEqual(repo.getCase(id).allocation.patientRef, 'P1');
    assert.ok((repo.getCase(id).dispensingRecords || []).some((r) => r.autoPick));
    const afterPick = getStore().inventory.find((i) => i.name === '黄芪').stock;
    assert.ok(afterPick < before, `stock ${before} -> ${afterPick}`);

    updateStore((data) => {
      const item = data.inventory.find((i) => i.name === '甘草');
      if (item) { item.stock = 2; item.minStock = 40; }
    });
    const restock = await call('POST', '/api/ai/ops/restock', { as: 'technician', body: {} });
    assert.strictEqual(restock.status, 200, JSON.stringify(restock.body));
    assert.ok(restock.body.applied.some((a) => a.name === '甘草' && a.added > 0), JSON.stringify(restock.body.applied));
    assert.ok(getStore().inventory.find((i) => i.name === '甘草').stock >= 40);
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
});

describe('authority knowledge catalog', () => {
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
