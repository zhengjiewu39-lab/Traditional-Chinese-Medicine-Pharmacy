/**
 * Persistent research jobs. Results survive refresh and process restart.
 * Does not mutate operational cases, inventory, signatures, or API keys.
 */
const repo = require('../workflow/workflowRepository');
const { hashObject, randomId } = require('../common/hash');
const { createProvider } = require('../ai/providerAdapter');
const { createMockProvider } = require('../ai/mockProvider');
const runtime = require('../ai/aiRuntime');
const { getAiMode } = require('../ai/aiMode');
const { effectiveEnv } = require('../ai/runtimeConfig');
const snapshotService = require('./snapshotService');
const engine = require('./experimentEngine');
const advisor = require('./resultAdvisor');

const JOBS = 'researchJobs';
const RESULTS = 'researchJobResults';
const LIMITS = 'researchExperimentLimits';

const running = new Set();

function limits() {
  return repo.getDoc(LIMITS, 'default') || {
    allowLive: false,
    maxConcurrency: 1,
    maxRequestsPerJob: 4000,
    maxCasesLive: 8,
  };
}

function saveLimits(body, actor) {
  const next = {
    allowLive: Boolean(body.allowLive),
    maxConcurrency: Math.max(1, Number(body.maxConcurrency) || 1),
    maxRequestsPerJob: Math.max(1, Number(body.maxRequestsPerJob) || 4000),
    maxCasesLive: Math.max(1, Number(body.maxCasesLive) || 8),
    updatedBy: String(actor?.id || ''),
    updatedAt: new Date().toISOString(),
  };
  repo.saveDoc(LIMITS, 'default', next);
  return next;
}

function listJobs() {
  return (repo.listDocs(JOBS) || []).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function getJob(id) {
  return repo.getDoc(JOBS, id);
}

function saveJob(job) {
  repo.saveDoc(JOBS, job.id, job);
  return job;
}

function resultKey(jobId, researchCaseId, groupId, replicate) {
  return `${jobId}:${researchCaseId}:${groupId}:${replicate}`;
}

function getResult(key) {
  return repo.getDoc(RESULTS, key);
}

function saveResult(row) {
  repo.saveDoc(RESULTS, row.key, row);
  return row;
}

function listResults(jobId) {
  return (repo.listDocs(RESULTS) || []).filter((r) => r.jobId === jobId);
}

function canSee(job, user) {
  if (!job || !user) return false;
  return user.role === 'researcher' && String(job.createdById) === String(user.id);
}

function publicJob(job) {
  if (!job) return null;
  const { providerEnv: _drop, ...rest } = job;
  return rest;
}

function configKey(cfg) {
  return hashObject({
    datasetId: cfg.datasetId,
    contentHash: cfg.contentHash,
    groups: cfg.groups,
    split: cfg.split,
    offset: cfg.offset,
    limit: cfg.limit,
    ids: cfg.ids || [],
    replicates: cfg.replicates,
    inferenceMode: cfg.inferenceMode,
    inputMode: cfg.inputMode,
    maxBurden: cfg.maxBurden,
    maxRounds: cfg.maxRounds,
    runTag: cfg.runTag || '',
  });
}

function estimate(cfg, caseCount) {
  const groups = cfg.groups.length;
  const tasks = caseCount * groups * cfg.replicates;
  return {
    cases: caseCount,
    groups,
    replicates: cfg.replicates,
    tasks,
    note: 'Task count is not a currency cost. Token price is unknown unless the provider returns usage.',
    estimatedCost: 'unknown',
  };
}

function providerFor(mode) {
  if (mode === 'rules' || mode === 'mock') return createMockProvider();
  const env = effectiveEnv();
  if ((env.AI_PROVIDER || '') !== 'openai-compatible' || !env.AI_BASE_URL || !env.AI_MODEL || !env.AI_API_KEY) {
    const err = new Error('No administrator-approved real model overlay is configured');
    err.code = 'provider_not_approved';
    throw err;
  }
  return createProvider();
}

function createJob(body, actor) {
  const snap = body.contentHash ? snapshotService.getByHash(body.contentHash) : snapshotService.current();
  if (!snap) {
    const err = new Error('research snapshot missing');
    err.code = 'snapshot_missing';
    throw err;
  }
  const groups = (body.groups || ['A', 'C', 'D']).filter((g) => engine.GROUPS[g]);
  if (!groups.length) throw Object.assign(new Error('no valid groups'), { code: 'invalid_groups' });
  const inferenceMode = body.inferenceMode === 'real' ? 'real' : (body.inferenceMode === 'rules' ? 'rules' : 'mock');
  const cap = limits();
  const limit = body.limit == null ? 1 : Number(body.limit);
  if (inferenceMode === 'real') {
    if (!cap.allowLive) throw Object.assign(new Error('Administrator has not allowed live research calls'), { code: 'live_forbidden' });
    if (!body.confirmLive) throw Object.assign(new Error('Live run requires confirmLive'), { code: 'confirm_live_required' });
    if (limit > cap.maxCasesLive && !body.confirmFullLive) {
      throw Object.assign(new Error(`Live range exceeds admin cap ${cap.maxCasesLive}. Set confirmFullLive to acknowledge.`), { code: 'confirm_full_live_required' });
    }
  }
  const cfg = {
    datasetId: snap.datasetId,
    contentHash: snap.contentHash,
    groups,
    split: body.split || 'test',
    offset: Number(body.offset) || 0,
    limit: Number.isFinite(limit) ? limit : 1,
    ids: Array.isArray(body.ids) ? body.ids.slice(0, 40) : [],
    replicates: Math.max(1, Math.min(3, Number(body.replicates) || 1)),
    inferenceMode,
    inputMode: body.inputMode === 'end_to_end_nl' ? 'end_to_end_nl' : 'structured',
    maxBurden: Math.max(1, Math.min(12, Number(body.maxBurden) || 6)),
    maxRounds: Math.max(1, Math.min(6, Number(body.maxRounds) || 3)),
    runTag: String(body.runTag || ''),
  };
  const pack = engine.packFromSnapshot(snap);
  const selected = engine.selectCases(pack, cfg);
  const key = configKey(cfg);
  const existing = listJobs().find((j) => j.configKey === key && j.status !== 'cancelled');
  if (existing) return { job: existing, replayed: true };
  const tasks = [];
  for (const raw of selected) {
    for (const groupId of groups) {
      for (let replicate = 1; replicate <= cfg.replicates; replicate += 1) {
        tasks.push({ researchCaseId: raw.id, baseId: raw.baseId, groupId, replicate });
      }
    }
  }
  if (tasks.length > cap.maxRequestsPerJob) {
    throw Object.assign(new Error(`Task count ${tasks.length} exceeds admin cap ${cap.maxRequestsPerJob}`), { code: 'job_too_large' });
  }
  const job = {
    id: randomId('rjob'),
    experimentId: randomId('rexp'),
    configKey: key,
    status: 'queued',
    createdAt: new Date().toISOString(),
    createdById: String(actor.id),
    createdByRole: actor.role,
    datasetId: snap.datasetId,
    datasetHash: snap.contentHash,
    selectionRule: snap.selectionRule,
    expertReviewStatus: snap.expertReviewStatus,
    config: cfg,
    estimate: estimate(cfg, selected.length),
    cursor: 0,
    tasks,
    counts: { queued: tasks.length, running: 0, completed: 0, failed: 0, cancelled: 0, policy_paused: 0 },
    usage: { known: false, totalTokens: null, note: 'Usage stays unknown until a provider returns token counts.' },
    cancelRequested: false,
  };
  saveJob(job);
  kick(job.id);
  return { job, replayed: false };
}

function summarize(job) {
  const rows = listResults(job.id);
  const byGroup = {};
  for (const g of job.config.groups) {
    const gs = rows.filter((r) => r.groupId === g);
    byGroup[g] = {
      n: gs.length,
      engineeringFailures: gs.filter((r) => r.engineeringFailure).length,
      modelFailures: gs.filter((r) => r.modelFailure).length,
      asked: gs.reduce((s, r) => s + (r.asked || 0), 0),
      answered: gs.reduce((s, r) => s + (r.answered || 0), 0),
      latencyMs: gs.length ? Math.round(gs.reduce((s, r) => s + (r.latencyMs || 0), 0) / gs.length) : null,
      clinicalAccuracy: 'not_evaluated',
    };
  }
  return { byGroup, pairedNote: 'Rows with the same baseId are related scenes, not extra patients.', clinicalAccuracy: 'not_evaluated' };
}

async function processNext(jobId) {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    const job = getJob(jobId);
    if (!job || (['completed', 'cancelled', 'failed'].includes(job.status) && !job.resume)) return;
    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.finishedAt = new Date().toISOString();
      saveJob(job);
      return;
    }
    if (!runtime.isAiEnabled() && job.config.inferenceMode === 'real') {
      job.status = 'policy_paused';
      job.pausedReason = 'Global AI switch is off. No new model or automatic external search is scheduled.';
      saveJob(job);
      return;
    }
    job.status = 'running';
    job.startedAt = job.startedAt || new Date().toISOString();
    saveJob(job);
    const snap = snapshotService.getByHash(job.datasetHash) || snapshotService.current();
    const pack = engine.packFromSnapshot(snap);
    let provider;
    try {
      provider = providerFor(job.config.inferenceMode);
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      job.finishedAt = new Date().toISOString();
      saveJob(job);
      return;
    }
    const cap = limits();
    const slice = job.tasks.slice(job.cursor, job.cursor + cap.maxConcurrency);
    for (const task of slice) {
      if (getJob(jobId).cancelRequested) {
        job.cancelRequested = true;
        break;
      }
      const key = resultKey(job.id, task.researchCaseId, task.groupId, task.replicate);
      const prior = getResult(key);
      if (prior?.ok) {
        job.cursor += 1;
        job.counts.completed += 1;
        continue;
      }
      const raw = (snap.cases || []).find((c) => c.id === task.researchCaseId);
      const row = await engine.runOne({
        pack,
        raw,
        groupId: task.groupId,
        provider,
        opts: {
          inputMode: job.config.inputMode,
          maxBurden: job.config.maxBurden,
          maxRounds: job.config.maxRounds,
          aiMaster: runtime.isAiEnabled(),
          aiMode: getAiMode(),
          isCancelled: () => Boolean(getJob(jobId)?.cancelRequested),
        },
      });
      saveResult({
        key,
        jobId: job.id,
        experimentId: job.experimentId,
        ...row,
        replicate: task.replicate,
        createdAt: new Date().toISOString(),
      });
      job.cursor += 1;
      if (row.ok) job.counts.completed += 1;
      else if (row.stopReason === 'policy_paused_ai_disabled') job.counts.policy_paused += 1;
      else job.counts.failed += 1;
      if (row.tokenUsage?.total_tokens != null) {
        job.usage.known = true;
        job.usage.totalTokens = (job.usage.totalTokens || 0) + Number(row.tokenUsage.total_tokens);
      }
      job.counts.queued = Math.max(0, job.tasks.length - job.cursor);
      saveJob(job);
    }
    const fresh = getJob(jobId);
    if (fresh.cancelRequested) {
      fresh.status = 'cancelled';
      fresh.finishedAt = new Date().toISOString();
      saveJob(fresh);
      return;
    }
    if (fresh.cursor >= fresh.tasks.length) {
      fresh.status = 'completed';
      fresh.finishedAt = new Date().toISOString();
      fresh.summary = summarize(fresh);
      saveJob(fresh);
      return;
    }
    setImmediate(() => processNext(jobId));
  } finally {
    running.delete(jobId);
  }
}

function kick(jobId) {
  setImmediate(() => processNext(jobId));
}

function cancelJob(id, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  job.cancelRequested = true;
  if (job.status === 'queued') {
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
  }
  saveJob(job);
  return { job };
}

function resumeJob(id, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  job.cancelRequested = false;
  job.resume = true;
  if (['cancelled', 'policy_paused', 'failed', 'queued', 'running'].includes(job.status) && job.cursor < job.tasks.length) {
    job.status = 'queued';
    saveJob(job);
    kick(job.id);
  }
  return { job };
}

function retryFailed(id, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  const failed = listResults(job.id).filter((r) => !r.ok);
  job.tasks = job.tasks.concat(failed.map((r) => ({
    researchCaseId: r.researchCaseId,
    baseId: r.baseId,
    groupId: r.groupId,
    replicate: r.replicate,
    retryOf: r.key,
  })));
  job.status = 'queued';
  job.cancelRequested = false;
  saveJob(job);
  kick(job.id);
  return { job };
}

function resumeUnfinished() {
  for (const job of listJobs()) {
    if (['queued', 'running'].includes(job.status) && job.cursor < (job.tasks || []).length) kick(job.id);
  }
}

async function adviseOnResult(id, body, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  const researchCaseId = String(body.researchCaseId || '');
  const groupId = String(body.groupId || '');
  const replicate = Number(body.replicate || 1);
  const row = getResult(resultKey(job.id, researchCaseId, groupId, replicate));
  if (!row) return { missing: true };
  const out = await advisor.adviseResult({
    job,
    row,
    lang: body.lang === 'en' ? 'en' : 'zh',
    wantModel: body.wantModel !== false,
  });
  row.advisor = out;
  saveResult(row);
  return { job, result: row, advisor: out };
}

async function adviseOnJob(id, body, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  const rows = listResults(job.id);
  const out = await advisor.adviseJob({
    job,
    rows,
    lang: body.lang === 'en' ? 'en' : 'zh',
    wantModel: body.wantModel !== false,
  });
  job.advisor = out;
  saveJob(job);
  return { job, advisor: out };
}

function exportJob(job, format) {
  const rows = listResults(job.id).map((r) => {
    const { providerMeta, ...rest } = r;
    return {
      ...rest,
      providerMeta: providerMeta ? { model: providerMeta.model, latencyMs: providerMeta.latencyMs } : null,
    };
  });
  const doc = {
    experimentId: job.experimentId,
    datasetId: job.datasetId,
    datasetHash: job.datasetHash,
    createdByRole: job.createdByRole,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    status: job.status,
    config: job.config,
    summary: job.summary || summarize(job),
    note: '500 synthetic base cases × groups are case-level evaluations, not real patients. Mock and real rows stay separate. No identifiers or API keys.',
    clinicalAccuracy: 'not_evaluated',
    rows,
  };
  if (format === 'csv') {
    const header = ['experimentId', 'researchCaseId', 'baseId', 'groupId', 'replicate', 'ok', 'filteredRisk', 'asked', 'answered', 'stopReason', 'clinicalAccuracy'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(header.map((k) => JSON.stringify(r[k] ?? job[k] ?? '')).join(','));
    }
    return { filename: `${job.id}.csv`, body: `${lines.join('\n')}\n`, type: 'text/csv' };
  }
  return { filename: `${job.id}.json`, body: `${JSON.stringify(doc, null, 2)}\n`, type: 'application/json' };
}

module.exports = {
  limits,
  saveLimits,
  listJobs,
  getJob,
  canSee,
  publicJob,
  createJob,
  cancelJob,
  resumeJob,
  retryFailed,
  listResults,
  exportJob,
  resumeUnfinished,
  estimate,
  adviseOnResult,
  adviseOnJob,
};
