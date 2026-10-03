#!/usr/bin/env node
/**
 * Screen each of the 500 synthetic patient-center people once, using that
 * person's existing store prescription. Does not invent herbs, approve, or
 * promote the overlay from shadow to live.
 *
 * A row counts as screened only if the live model was actually invoked
 * (semantic ok / schema_invalid / policy_violation). Circuit-open rule
 * fallbacks are retried, not counted.
 *
 * Usage:
 *   node scripts/ai/screen-demo-patients.js --resume
 *   node scripts/ai/screen-demo-patients.js --dry-run
 *   node scripts/ai/screen-demo-patients.js --concurrency 1
 */
const fs = require('fs');
const path = require('path');
const { getStore } = require('../../server/data/store');
const repo = require('../../server/workflow/workflowRepository');
const { publicView } = require('../../server/ai/runtimeConfig');
const { refForStorePatient } = require('../../server/workflow/patientIdentity');

const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.resolve(ROOT, 'benchmarks/ai-review/results-live');
const PROGRESS = path.join(process.env.AI_DATA_DIR || path.join(ROOT, 'data/ai'), 'screen-500-progress.jsonl');
const SUMMARY = path.join(OUT_DIR, 'screen-500-latest.json');
const BASE = process.env.TCM_API_BASE || 'http://localhost:3002/api';
const REAL_SEMANTIC = new Set(['ok', 'schema_invalid', 'policy_violation']);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  if (v == null || v.startsWith('--')) return true;
  return v;
}

function fail(msg) {
  console.error(`[ai:screen:demo-500] ${msg}`);
  process.exit(2);
}

function isRealModelScreen(row) {
  return REAL_SEMANTIC.has(row?.semanticStatus);
}

function analysisIsReal(out) {
  return REAL_SEMANTIC.has(out?.semanticTrackResult?.status);
}

function loadDone() {
  const done = new Map();
  if (!fs.existsSync(PROGRESS)) return done;
  for (const line of fs.readFileSync(PROGRESS, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.patientRef && (row.status === 'skipped_existing' || (row.status === 'ok' && isRealModelScreen(row)))) {
        done.set(row.patientRef, row);
      }
    } catch { /* skip bad line */ }
  }
  return done;
}

function appendProgress(row) {
  fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
  fs.appendFileSync(PROGRESS, `${JSON.stringify(row)}\n`);
}

function firstRxByPatient(store) {
  const map = new Map();
  for (const rx of store.prescriptions || []) {
    if (rx.patientId == null) continue;
    if (!map.has(rx.patientId)) map.set(rx.patientId, rx);
  }
  return map;
}

function existingCaseFor(casesByRef, ref) {
  const rows = casesByRef.get(ref) || [];
  if (rows.some((c) => (c.analyses || []).some((a) => analysisIsReal(a.output)))) {
    return { skip: 'skipped_existing', caseId: null };
  }
  const latest = rows[rows.length - 1];
  return { skip: null, caseId: latest?.caseId || null };
}

function worklist() {
  const store = getStore();
  const casesByRef = new Map();
  for (const c of repo.listCases()) {
    const ref = c.patient?.patientRef;
    if (!ref) continue;
    if (!casesByRef.has(ref)) casesByRef.set(ref, []);
    casesByRef.get(ref).push(c);
  }
  const rxByPatient = firstRxByPatient(store);
  const jobs = [];
  for (const p of [...(store.patients || [])].sort((a, b) => Number(a.id) - Number(b.id))) {
    const ref = refForStorePatient(p);
    const rx = rxByPatient.get(p.id);
    const found = existingCaseFor(casesByRef, ref);
    jobs.push({
      patientRef: ref,
      patientId: p.id,
      name: p.name,
      rxId: rx ? rx.id : null,
      caseId: found.caseId,
      action: found.skip ? null : (found.caseId ? 'reanalyze' : 'create'),
      skip: found.skip || (!rx && !found.caseId ? 'no_store_rx' : null),
    });
  }
  return jobs;
}

async function login(username, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await r.json();
  if (!r.ok || !body.token) fail(`login failed ${r.status}`);
  return body.token;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(token, method, p, body, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.TCM_SCREEN_TIMEOUT_MS) || 90000);
  let r;
  try {
    r = await fetch(`${BASE}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (attempt < 4) {
      await sleep(2000 * attempt);
      return api(token, method, p, body, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  if (r.status === 429) {
    if (attempt < 6) {
      await sleep(65000);
      return api(token, method, p, body, attempt + 1);
    }
  } else if (r.status >= 500 && attempt < 4) {
    await sleep(2000 * attempt);
    return api(token, method, p, body, attempt + 1);
  }
  return { status: r.status, body: json };
}

function analysisMeta(payload) {
  const out = payload?.analysis || payload?.case?.analyses?.at?.(-1)?.output || null;
  return {
    caseId: payload?.case?.caseId || payload?.caseId || null,
    state: payload?.case?.state || null,
    riskTier: out?.riskTier || null,
    recommendation: out?.recommendation || null,
    displaySource: out?.displaySource || null,
    model: out?.modelVersion || out?.providerMeta?.model || null,
    semanticStatus: out?.semanticTrackResult?.status || null,
    screeningError: payload?.screeningError || null,
  };
}

async function analyzeCase(token, caseId) {
  const again = await api(token, 'POST', `/ai/cases/${caseId}/analyze`, {});
  if (again.status !== 200) {
    return { status: 'analyze_failed', http: again.status, caseId, error: again.body?.error?.message, analysis: null, case: { caseId } };
  }
  return { status: 'ok', case: again.body.case || { caseId }, analysis: again.body.analysis };
}

async function screenOne(token, job) {
  const started = Date.now();
  let caseId = job.caseId;
  let payload;
  if (caseId) {
    payload = await analyzeCase(token, caseId);
    if (payload.status === 'analyze_failed') {
      return { ...job, ...payload, latencyMs: Date.now() - started };
    }
  } else {
    const created = await api(token, 'POST', '/ai/cases', { fromPrescriptionId: job.rxId });
    if (created.status !== 201) {
      return {
        ...job, status: 'create_failed', http: created.status,
        error: created.body?.error?.message || created.body?.message,
        latencyMs: Date.now() - started,
      };
    }
    payload = created.body;
    caseId = payload.case?.caseId;
    if (payload.screeningError || !payload.analysis) {
      payload = await analyzeCase(token, caseId);
      if (payload.status === 'analyze_failed') {
        return { ...job, ...payload, latencyMs: Date.now() - started };
      }
    }
  }

  let meta = analysisMeta(payload);
  for (let i = 0; i < 4 && !isRealModelScreen(meta); i += 1) {
    const waitMs = meta.semanticStatus === 'circuit_open' ? 35000 : 8000;
    console.log(JSON.stringify({ wait: meta.semanticStatus || 'no_model', patientRef: job.patientRef, caseId, ms: waitMs }));
    await sleep(waitMs);
    payload = await analyzeCase(token, caseId);
    if (payload.status === 'analyze_failed') {
      return { ...job, ...payload, latencyMs: Date.now() - started };
    }
    meta = analysisMeta(payload);
  }

  return {
    ...job,
    status: isRealModelScreen(meta) ? 'ok' : 'model_not_called',
    latencyMs: Date.now() - started,
    ...meta,
    approved: false,
  };
}

async function pool(items, n, fn) {
  const pending = [...items];
  const workers = Array.from({ length: Math.max(1, n) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const concurrency = Number(arg('concurrency', 1)) || 1;
  const resume = Boolean(arg('resume', true));
  const overlay = publicView();
  if (!overlay.configured || !overlay.apiKeyConfigured) fail('No saved live overlay / API key. Refuse to invent scores.');
  if ((overlay.aiMode || 'shadow') === 'live') {
    console.error('[ai:screen:demo-500] Overlay is live; this job still will not approve or dispense.');
  }

  const jobs = worklist();
  if (arg('dry-run', false)) {
    const skip = jobs.filter((j) => j.skip);
    const ready = jobs.filter((j) => !j.skip);
    console.log(JSON.stringify({
      phase: 'dry-run',
      directory: jobs.length,
      ready: ready.length,
      reanalyze: ready.filter((j) => j.action === 'reanalyze').length,
      create: ready.filter((j) => j.action === 'create').length,
      skippedExisting: skip.filter((s) => s.skip === 'skipped_existing').length,
      noStoreRx: skip.filter((s) => s.skip === 'no_store_rx').length,
      first: ready[0] || jobs[0],
      last: ready.at(-1) || jobs.at(-1),
      overlay: { configured: overlay.configured, model: overlay.model, aiMode: overlay.aiMode, host: overlay.endpointHost },
    }, null, 2));
    return;
  }

  const adminToken = await login(process.env.TCM_ADMIN_USER || 'admin', process.env.TCM_ADMIN_PASSWORD || 'admin123');
  const probe = await api(adminToken, 'POST', '/ai/runtime/test', {});
  if (probe.status !== 200 || !probe.body?.ok) {
    fail(`Provider preflight failed (${probe.status}): ${probe.body?.error?.message || 'unknown'}. Will not invent scores or fall back to mock.`);
  }

  const token = await login(process.env.TCM_SCREEN_USER || 'prescriber', process.env.TCM_SCREEN_PASSWORD || 'doc123');
  const rt = await api(token, 'GET', '/ai/runtime');
  const runtime = rt.body?.runtime || {};
  if (runtime.isMock || runtime.provider === 'mock') fail('Running API is mock. Live screening refused.');
  if (!runtime.aiEnabled) fail('AI kill switch is off.');
  const done = resume ? loadDone() : new Map();
  const todo = [];
  const skipped = [];
  for (const job of jobs) {
    if (done.has(job.patientRef)) {
      skipped.push({ ...job, status: done.get(job.patientRef).status });
      continue;
    }
    if (job.skip) {
      const row = { ...job, status: job.skip, approved: false };
      appendProgress(row);
      skipped.push(row);
      continue;
    }
    todo.push(job);
  }

  console.log(JSON.stringify({
    phase: 'start',
    directory: jobs.length,
    todo: todo.length,
    alreadyDone: done.size,
    skippedExisting: skipped.filter((s) => s.status === 'skipped_existing').length,
    reanalyze: todo.filter((j) => j.action === 'reanalyze').length,
    create: todo.filter((j) => j.action === 'create').length,
    provider: runtime.provider,
    model: runtime.model,
    aiMode: runtime.aiMode || overlay.aiMode,
    circuit: runtime.circuit || null,
    concurrency,
  }));

  let ok = 0;
  let failN = 0;
  let i = 0;
  await pool(todo, concurrency, async (job) => {
    let row;
    try {
      row = await screenOne(token, job);
    } catch (err) {
      row = { ...job, status: 'error', error: err.message };
    }
    appendProgress(row);
    if (row.status === 'ok' && isRealModelScreen(row)) ok += 1;
    else failN += 1;
    i += 1;
    if (i % 10 === 0 || row.status !== 'ok' || !isRealModelScreen(row)) {
      console.log(JSON.stringify({
        progress: i, todo: todo.length, last: row.patientRef, status: row.status,
        semantic: row.semanticStatus || null, caseId: row.caseId || null, risk: row.riskTier || null,
      }));
    }
    if (concurrency === 1) await sleep(1200);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    inferenceMode: 'real',
    aiMode: runtime.aiMode || overlay.aiMode || 'shadow',
    clinicalLabels: 'not_evaluated',
    clinicalEffect: 'not_estimated',
    approved: false,
    promotedToLive: false,
    directory: jobs.length,
    alreadyDoneBeforeThisRun: done.size,
    attempted: todo.length,
    modelInvokedThisRun: ok,
    failedOrDegraded: failN,
    skipped: skipped.length,
    note: 'One existing store prescription per synthetic patient. Counted only when the live model was invoked. Shadow mode still displays rules. Not a clinical validation. Pharmacist still must review. Stopping or abstaining is not approval.',
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ phase: 'done', ...report }, null, 2));
  if (failN) process.exit(1);
}

main().catch((e) => fail(e.message));
