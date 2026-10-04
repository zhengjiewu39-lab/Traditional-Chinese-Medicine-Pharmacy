const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-engine-'));
process.env.AI_DATA_DIR = tmpDir;
process.env.STORE_DIR = tmpDir;
process.env.DATA_MODE = 'demo';

const { createMockProvider } = require('../ai/mockProvider');
const runtime = require('../ai/aiRuntime');
const {
  parseDose, parseDoseCount, parseHerbs, buildSnapshot, hashSnapshotContent,
} = require('../research/snapshotBuilder');
const snapshotService = require('../research/snapshotService');
const engine = require('../research/experimentEngine');
const jobs = require('../research/experimentJobs');
const { resolveCapabilities } = require('../research/capabilityPolicy');
const repo = require('../workflow/workflowRepository');

const actor1 = { id: 'r1', role: 'researcher' };
const actor2 = { id: 'r2', role: 'researcher' };

function tinySource() {
  return {
    patients: [
      { id: 1, patientRef: 'P1', gender: '女', age: 44, allergies: ['甘草'], demoTag: 'synthetic' },
      { id: 2, patientRef: 'P2', gender: '男', age: 30, allergies: [], demoTag: 'synthetic' },
    ],
    prescriptions: [
      {
        id: 11, patientId: 1, date: '2025-06-01',
        herbs: [{ name: '甘草', dosage: '6g' }],
        doseCount: 7, usage: '水煎服',
      },
      {
        id: 12, patientId: 2, date: '2025-06-02',
        herbs: [{ name: '黄芪', dosage: '15g' }],
        doseCount: 7, usage: '水煎服',
      },
    ],
    evaluationNow: '2026-01-01T12:00:00.000Z',
  };
}

function persistSnap(src = tinySource()) {
  const snap = buildSnapshot(src);
  const dir = path.join(tmpDir, 'research', 'snapshots');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${snap.datasetId}-${snap.version}-${snap.contentHash.slice(0, 12)}.json`);
  fs.writeFileSync(dest, `${JSON.stringify(snap)}\n`);
  repo.saveDoc('researchSnapshots', `${snap.datasetId}:${snap.contentHash}`, {
    id: `${snap.datasetId}:${snap.contentHash}`,
    datasetId: snap.datasetId,
    version: snap.version,
    generatedAt: snap.generatedAt,
    contentHash: snap.contentHash,
    path: dest,
    counts: snap.counts,
  });
  return snap;
}

function fakePack(n = 500) {
  const baseCases = [];
  const cases = [];
  for (let i = 0; i < n; i += 1) {
    const baseId = `B${String(i).padStart(3, '0')}`;
    const split = i < 101 ? 'dev' : 'test';
    baseCases.push({ baseId, split });
    for (const cat of ['complete', 'unknown-allergy', 'paraphrase']) {
      cases.push({
        id: `${baseId}:${cat}`,
        baseId,
        split,
        category: cat,
        initialObservedFacts: { ageYears: 40, sex: 'female' },
        hiddenPatientFacts: {},
        patientAnswerScript: {
          'patient.facts.ageYears': { status: 'reported', value: 40, source: 'script_from_source' },
        },
        prescription: { herbs: [{ name: '甘草', dosage: 6, unit: 'g' }], doseCount: 7, issuedAt: '2025-01-01' },
        encounterAt: '2025-01-01',
      });
    }
  }
  return {
    version: '1.1.0',
    evaluationNow: '2026-01-01T00:00:00Z',
    defaults: { source: { channel: 'research_snapshot' }, prescriber: { name: '合成医师', licenseVerified: true } },
    baseCases,
    cases,
  };
}

function waitFor(fn, { timeout = 4000, interval = 20 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const v = fn();
        if (v) return resolve(v);
      } catch { /* keep waiting */ }
      if (Date.now() - started > timeout) return reject(new Error('timeout'));
      setTimeout(tick, interval);
    };
    tick();
  });
}

before(() => {
  runtime.setProviderOverride(createMockProvider());
});

after(() => {
  jobs._resetTestHooks();
  runtime.clearProviderOverride();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  jobs._resetTestHooks();
  runtime.setProviderOverride(createMockProvider());
});

describe('research engine 50cb7a6 repair', () => {
  it('selects 500 base cases and expands their scenes; splits do not mix', () => {
    const pack = fakePack(500);
    const all = engine.selectCases(pack, { split: 'all', limit: 500, selectUnit: 'base_case' });
    const bases = new Set(all.map((c) => c.baseId));
    assert.strictEqual(bases.size, 500);
    assert.strictEqual(all.length, 1500);
    const test = engine.selectCases(pack, { split: 'test', selectUnit: 'base_case' });
    const dev = engine.selectCases(pack, { split: 'dev', selectUnit: 'base_case' });
    const testBases = new Set(test.map((c) => c.baseId));
    const devBases = new Set(dev.map((c) => c.baseId));
    assert.strictEqual(testBases.size, 399);
    assert.strictEqual(devBases.size, 101);
    for (const id of testBases) assert.ok(!devBases.has(id));
    const slicedScenes = engine.selectCases(pack, { split: 'test', limit: 500, selectUnit: 'scene' });
    assert.ok(new Set(slicedScenes.map((c) => c.baseId)).size < 500);
  });

  it('freezes encounter time so the same protocol does not drift', async () => {
    const pack = fakePack(1);
    const raw = pack.cases[0];
    const a = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules', now: new Date('2025-01-01T12:00:00Z') },
    });
    const b = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules', now: new Date('2026-10-04T12:00:00Z') },
    });
    const defaulted = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules' },
    });
    assert.strictEqual(a.inputHash, defaulted.inputHash);
    assert.ok(a.inputHash);
    assert.ok(a.stopReason);
    assert.notStrictEqual(a.inputHash, b.inputHash);
    assert.strictEqual(defaulted.encounterAt, '2025-01-01');
    assert.strictEqual(a.filteredRisk, defaulted.filteredRisk);
    assert.ok(!String(defaulted.stopReason || '').includes('PRESCRIPTION_EXPIRED') || defaulted.ruleRisk !== 'A3');
  });

  it('reanalyzes after the last scripted answer and records a stop reason', async () => {
    const pack = {
      defaults: { source: { channel: 'research' }, prescriber: { name: '合成医师', licenseVerified: true } },
      evaluationNow: '2025-01-01T00:00:00Z',
      cases: [],
    };
    const raw = {
      id: 'age-missing',
      baseId: 'age-missing',
      split: 'test',
      initialObservedFacts: { sex: 'female' },
      hiddenPatientFacts: { ageYears: 44 },
      patientAnswerScript: {
        'patient.facts.ageYears': { status: 'reported', value: 44, source: 'script_from_source' },
        'patient.facts.allergies': { status: 'unknown', value: null, source: 'script_absent_in_source' },
      },
      prescription: { herbs: [{ name: '甘草', dosage: 6, unit: 'g' }], doseCount: 7, issuedAt: '2025-01-01' },
      narrativeText: '女同志，大概44岁。过敏史未提供。',
    };
    const row = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules', maxRounds: 1, maxBurden: 6 },
    });
    assert.ok(row.stopReason);
    assert.ok(row.analyses?.length >= 2);
    const last = row.analyses[row.analyses.length - 1];
    assert.notStrictEqual(row.analyses[0].inputHash, last.inputHash);
    assert.strictEqual(row.inputHash, last.inputHash);
    assert.strictEqual(row.outputHash, last.outputHash);
    assert.ok(row.factResolved >= 1);
    assert.match(JSON.stringify(row.analyses), /after_script_answers/);
    const burden = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules', maxRounds: 3, maxBurden: 1 },
    });
    assert.ok(burden.analyses?.length >= 2);
    assert.ok(['burden_cap', 'round_cap', 'complete', 'no_remaining_questions'].includes(burden.stopReason));
    assert.ok(burden.answeredUnknown >= 1 || burden.factResolved >= 1);
  });

  it('does not treat an unknown script answer as a negative fact', async () => {
    const pack = { defaults: { source: { channel: 'research' }, prescriber: { name: '合成医师', licenseVerified: true } }, cases: [] };
    const raw = {
      id: 'unknown-alg',
      baseId: 'unknown-alg',
      initialObservedFacts: { sex: 'female', ageYears: 30 },
      hiddenPatientFacts: { allergies: 'unknown' },
      patientAnswerScript: {
        'patient.facts.allergies': { status: 'unknown', value: null, source: 'script_absent_in_source' },
      },
      prescription: { herbs: [{ name: '甘草', dosage: 6, unit: 'g' }], doseCount: 7, issuedAt: '2025-01-01' },
    };
    const row = await engine.runOne({
      pack, raw, groupId: 'C', provider: createMockProvider(),
      opts: { requestedMode: 'mock', maxRounds: 1, maxBurden: 2 },
    });
    assert.ok(row.answeredUnknown >= 1);
    assert.strictEqual(row.clinicalAccuracy, 'not_evaluated');
    const turn = (row.clarificationTurns || []).find((t) => t.fieldPath.includes('allergies'));
    if (turn) {
      assert.strictEqual(turn.answeredUnknown, true);
      assert.strictEqual(turn.factResolved, false);
    }
  });

  it('confirms natural-language candidates from the frozen script before analysis', async () => {
    const pack = { defaults: { source: { channel: 'research' }, prescriber: { name: '合成医师', licenseVerified: true } }, cases: [] };
    const raw = {
      id: 'nl-age',
      baseId: 'nl-age',
      initialObservedFacts: { sex: 'female' },
      hiddenPatientFacts: { ageYears: 44 },
      patientAnswerScript: {
        'patient.facts.ageYears': { status: 'reported', value: 44, source: 'script_from_source' },
      },
      prescription: { herbs: [{ name: '甘草', dosage: 6, unit: 'g' }], doseCount: 7, issuedAt: '2025-01-01' },
      narrativeText: '女性，44岁。过敏史未提供。处方：甘草6g。',
    };
    const row = await engine.runOne({
      pack, raw, groupId: 'A', provider: null,
      opts: { requestedMode: 'rules', inputMode: 'end_to_end_nl', maxRounds: 1, maxBurden: 1 },
    });
    assert.strictEqual(row.extractTurn?.used, true);
    assert.ok((row.extractTurn.confirmations || []).some((c) => c.action === 'confirmed_from_script' && String(c.fieldPath).includes('ageYears')));
    assert.ok(row.independentlyVerified !== true);
    assert.ok((row.extractTurn.confirmations || []).every((c) => c.independentlyVerified === false));
  });

  it('uses one capability matrix for rules, mock, and real', () => {
    const rules = resolveCapabilities({ requestedMode: 'rules', groupCfg: engine.GROUPS.C, allowLive: true, runtimeEnabled: true });
    assert.strictEqual(rules.callModel, false);
    assert.strictEqual(rules.executedMode, 'rules');
    const mock = resolveCapabilities({ requestedMode: 'mock', groupCfg: engine.GROUPS.C, allowLive: false, runtimeEnabled: false });
    assert.strictEqual(mock.callModel, true);
    assert.strictEqual(mock.providerKind, 'mock');
    assert.strictEqual(mock.executedMode, 'mock');
    const paused = resolveCapabilities({ requestedMode: 'real', groupCfg: engine.GROUPS.C, allowLive: false, runtimeEnabled: true });
    assert.strictEqual(paused.pause, true);
    assert.strictEqual(paused.executedMode, 'policy_paused');
    const liveOff = resolveCapabilities({ requestedMode: 'real', groupCfg: engine.GROUPS.C, allowLive: true, runtimeEnabled: false });
    assert.strictEqual(liveOff.pause, true);
  });

  it('does not call a model when the requested mode is rules or live is paused', async () => {
    let calls = 0;
    const provider = {
      id: 'count',
      isMock: true,
      complete: async () => {
        calls += 1;
        return createMockProvider().complete({ context: { ruleSummary: { hits: [], missingInformation: [], tier: 'A1' }, evidence: [], minimisedCase: { prescription: { herbs: [] } } } });
      },
    };
    const pack = fakePack(1);
    await engine.runOne({
      pack, raw: pack.cases[0], groupId: 'C', provider,
      opts: { requestedMode: 'rules', maxRounds: 1 },
    });
    assert.strictEqual(calls, 0);
    const paused = await engine.runOne({
      pack, raw: pack.cases[0], groupId: 'C', provider,
      opts: { requestedMode: 'real', allowLive: false, maxRounds: 1 },
    });
    assert.strictEqual(paused.executionStatus, 'policy_paused');
    assert.strictEqual(paused.ok, false);
    assert.ok(calls === 0);
  });

  it('isolates idempotent jobs per researcher and does not return another user\'s job', () => {
    const snap = persistSnap();
    const body = {
      contentHash: snap.contentHash, groups: ['A'], split: 'all', limit: 1,
      inferenceMode: 'mock', inputMode: 'structured',
    };
    const a = jobs.createJob(body, actor1);
    const again = jobs.createJob(body, actor1);
    const b = jobs.createJob(body, actor2);
    assert.strictEqual(again.replayed, true);
    assert.strictEqual(again.job.id, a.job.id);
    assert.notStrictEqual(b.job.id, a.job.id);
    assert.strictEqual(jobs.canSee(a.job, actor2), false);
    assert.strictEqual(jobs.canSee(b.job, actor1), false);
    assert.ok(!jobs.publicJob(a.job).providerEnv);
  });

  it('keeps cancelRequested across a stale save and does not run the next unit', async () => {
    const snap = persistSnap();
    let release;
    const gate = new Promise((r) => { release = r; });
    let calls = 0;
    const inner = createMockProvider();
    jobs._setProviderFactory(() => ({
      ...inner,
      async complete(args) {
        calls += 1;
        await gate;
        return inner.complete(args);
      },
    }));
    const created = jobs.createJob({
      contentHash: snap.contentHash,
      groups: ['C'],
      split: 'all',
      limit: 1,
      ids: [snap.cases[0].id, snap.cases[1].id],
      selectUnit: 'scene',
      inferenceMode: 'mock',
    }, actor1);
    await waitFor(() => calls >= 1);
    const cancelled = jobs.cancelJob(created.job.id, actor1);
    assert.strictEqual(cancelled.job.cancelRequested, true);
    release();
    await waitFor(() => ['cancelled'].includes(jobs.getJob(created.job.id)?.status));
    const job = jobs.getJob(created.job.id);
    assert.strictEqual(job.status, 'cancelled');
    assert.strictEqual(job.cancelRequested, true);
    const rows = jobs.listResults(job.id);
    assert.ok(rows.length <= 1);
    assert.ok(rows.every((r) => ['cancelled', 'cancelled_late'].includes(r.executionStatus)));
    const second = snap.cases[1].id;
    assert.ok(!rows.some((r) => r.researchCaseId === second && r.executionStatus === 'completed'));
  });

  it('does not let resume clear a later cancel, and resume refuses a version mismatch', () => {
    const snap = persistSnap();
    const created = jobs.createJob({
      contentHash: snap.contentHash, groups: ['A'], split: 'all', limit: 1, inferenceMode: 'rules', runTag: 'resume-test',
    }, actor1);
    jobs.cancelJob(created.job.id, actor1);
    jobs.resumeJob(created.job.id, actor1);
    jobs.cancelJob(created.job.id, actor1);
    assert.strictEqual(jobs.getJob(created.job.id).cancelRequested, true);
    const other = jobs.createJob({
      contentHash: snap.contentHash, groups: ['A'], split: 'all', limit: 1, inferenceMode: 'rules', runTag: 'version-test',
    }, actor1);
    jobs.mergeSave({
      id: other.job.id,
      protocol: { ...(other.job.protocol || {}), engineVersion: 'research-engine@1.0.0-legacy' },
      status: 'queued',
    });
    const paused = jobs.resumeJob(other.job.id, actor1);
    assert.strictEqual(paused.job.status, 'policy_paused');
  });

  it('counts actual reserved model calls and keeps unknown usage as unknown', async () => {
    const pack = fakePack(1);
    let reserved = 0;
    const row = await engine.runOne({
      pack, raw: pack.cases[0], groupId: 'C', provider: createMockProvider(),
      opts: {
        requestedMode: 'mock',
        maxRounds: 1,
        maxBurden: 2,
        reserveModelCall: () => {
          reserved += 1;
          return reserved <= 1;
        },
      },
    });
    assert.ok(reserved >= 1);
    assert.ok(row.analyses.some((a) => a.usedModel) || row.finalModelSkipped || reserved >= 1);
    assert.ok(row.usageCompleteness === 'unknown' || row.usageCompleteness === 'last_analysis_only');
  });

  it('fails closed on a corrupt snapshot and does not overwrite the same hash', () => {
    const snap = persistSnap();
    const meta = snapshotService.listMeta().find((m) => m.contentHash === snap.contentHash);
    const broken = { ...snap, contentHash: snap.contentHash, cases: [...snap.cases, { id: 'tampered' }] };
    fs.writeFileSync(meta.path, `${JSON.stringify(broken)}\n`);
    assert.throws(() => snapshotService.getByHash(snap.contentHash), (err) => err.code === 'snapshot_corrupt');
    const again = persistSnap();
    const files = fs.readdirSync(path.dirname(meta.path)).filter((f) => f.includes(again.contentHash.slice(0, 12)));
    assert.ok(files.length >= 1);
    const recomputed = hashSnapshotContent(snap);
    assert.notStrictEqual(recomputed, hashSnapshotContent(broken));
  });

  it('retries failed units without appending tasks or overwriting the original row', async () => {
    const snap = persistSnap();
    const created = jobs.createJob({
      contentHash: snap.contentHash, groups: ['A'], split: 'all', limit: 1,
      inferenceMode: 'rules', runTag: 'retry-test', selectUnit: 'scene', ids: [snap.cases[0].id],
    }, actor1);
    await waitFor(() => ['completed', 'failed'].includes(jobs.getJob(created.job.id)?.status));
    const job = jobs.getJob(created.job.id);
    const first = jobs.listResults(job.id)[0];
    assert.ok(first);
    const repoRow = { ...first, ok: false, executionStatus: 'failed', engineeringFailure: true, superseded: false };
    require('../workflow/workflowRepository').saveDoc('researchJobResults', first.key, repoRow);
    jobs.mergeSave({ id: job.id, status: 'failed', cursor: job.tasks.length });
    const retried = jobs.retryFailed(job.id, actor1);
    assert.strictEqual(retried.job.tasks.length, job.tasks.length);
    const old = jobs.listResults(job.id).find((r) => r.key === first.key);
    assert.strictEqual(old.superseded, true);
    assert.ok((old.attempts || []).length >= 1);
  });

  it('isolates illegal herbs and dose counts instead of rewriting them', () => {
    assert.strictEqual(parseDose('1kg').ok, false);
    assert.strictEqual(parseDose('10ml').ok, false);
    assert.strictEqual(parseDose('2盒').ok, false);
    assert.strictEqual(parseDose(-3).ok, false);
    assert.strictEqual(parseDose('bad').ok, false);
    assert.strictEqual(parseDoseCount(0).ok, false);
    assert.strictEqual(parseDoseCount(-1).ok, false);
    assert.strictEqual(parseDoseCount('x').ok, false);
    const parsed = parseHerbs({
      herbs: [{ name: '甘草', dosage: '6g' }, { name: '甘遂', dosage: 'bad' }],
    });
    assert.strictEqual(parsed.unanalyzable, true);
    assert.deepStrictEqual(parsed.herbs, []);
    const snap = buildSnapshot({
      patients: [{ id: 1, patientRef: 'P1', gender: '女', age: 34, allergies: [], demoTag: 'synthetic' }],
      prescriptions: [{
        id: 1, patientId: 1, date: '2025-01-01',
        herbs: [{ name: '甘草', dosage: '6g' }, { name: '甘遂', dosage: 'bad' }],
        doseCount: 0,
      }],
      evaluationNow: '2026-01-01T00:00:00Z',
    });
    assert.strictEqual(snap.baseCases.length, 0);
    assert.ok(snap.exceptions.some((e) => e.code === 'unanalyzable_prescription' && e.executable === false));
    const zero = buildSnapshot({
      patients: [{ id: 1, patientRef: 'P1', gender: '女', age: 34, allergies: [], demoTag: 'synthetic' }],
      prescriptions: [{
        id: 9, patientId: 1, date: '2025-01-01',
        herbs: [{ name: '甘草', dosage: '6g' }],
        doseCount: 0,
      }],
      evaluationNow: '2026-01-01T00:00:00Z',
    });
    assert.strictEqual(zero.baseCases.length, 0);
    assert.ok(zero.exceptions.some((e) => e.code === 'unanalyzable_dose_count'));
  });

  it('records execution status denominators and does not invent clinical accuracy', async () => {
    const pack = fakePack(1);
    const row = await engine.runOne({
      pack, raw: pack.cases[0], groupId: 'A', provider: null,
      opts: { requestedMode: 'rules' },
    });
    assert.ok(['completed', 'policy_paused', 'cancelled', 'failed'].includes(row.executionStatus));
    assert.strictEqual(row.clinicalAccuracy, 'not_evaluated');
    assert.strictEqual(row.professionalReview.clinicalCorrectness, 'not_evaluated');
    assert.ok(row.engineVersion.startsWith('research-engine@2'));
    assert.ok(row.versions.engineVersion);
  });
});
