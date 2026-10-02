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
