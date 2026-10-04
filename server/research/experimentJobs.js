/**
 * Persistent research jobs. Results survive refresh and process restart.
 * Does not mutate operational cases, inventory, signatures, or API keys.
 */
const repo = require('../workflow/workflowRepository');
const { hashObject, randomId } = require('../common/hash');
const runtime = require('../ai/aiRuntime');
const { getPrompt } = require('../ai/promptRegistry');
const { knowledgeBaseVersion } = require('../knowledge/sourceRegistry');
const { ruleSetVersion } = require('../ai/ruleTrack');
const snapshotService = require('./snapshotService');
const engine = require('./experimentEngine');
const advisor = require('./resultAdvisor');
const {
  ENGINE_VERSION, uniqueSorted, resolveCapabilities, providerForKind, overlayMeta,
} = require('./capabilityPolicy');

const JOBS = 'researchJobs';
const RESULTS = 'researchJobResults';
const LIMITS = 'researchExperimentLimits';

const running = new Set();
const waiters = [];
let globalUsed = 0;
let providerFactory = null;

function limits() {
  return repo.getDoc(LIMITS, 'default') || {
    allowLive: false,
    maxConcurrency: 1,
    maxRequestsPerJob: 4000,
    maxModelCallsPerJob: 4000,
    maxCasesLive: 8,
    confirmCasesThreshold: 8,
  };
}

function saveLimits(body, actor) {
  const next = {
    allowLive: Boolean(body.allowLive),
    maxConcurrency: Math.max(1, Number(body.maxConcurrency) || 1),
    maxRequestsPerJob: Math.max(1, Number(body.maxRequestsPerJob) || 4000),
    maxModelCallsPerJob: Math.max(1, Number(body.maxModelCallsPerJob) || 4000),
    maxCasesLive: Math.max(1, Number(body.maxCasesLive) || 8),
    confirmCasesThreshold: Math.max(1, Number(body.confirmCasesThreshold) || 8),
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

function mergeSave(patch) {
  const cur = getJob(patch.id);
  if (!cur) return saveJob(patch);
  const next = { ...cur, ...patch };
  if (cur.cancelRequested && !patch._clearCancel) next.cancelRequested = true;
  next.cursor = Math.max(Number(cur.cursor || 0), Number(patch.cursor || 0));
  delete next._clearCancel;
  return saveJob(next);
}

function resultKey(jobId, researchCaseId, groupId, replicate, attempt = 1) {
  const base = `${jobId}:${researchCaseId}:${groupId}:${replicate}`;
  return attempt > 1 ? `${base}:a${attempt}` : base;
}

function getResult(key) {
  return repo.getDoc(RESULTS, key);
}

function saveResult(row) {
  repo.saveDoc(RESULTS, row.key, row);
  return row;
}

function listResults(jobId, { offset = 0, limit = null } = {}) {
  const rows = (repo.listDocs(RESULTS) || []).filter((r) => r.jobId === jobId);
  if (limit == null) return rows;
  return {
    total: rows.length,
    offset,
    limit,
    results: rows.slice(offset, offset + limit),
  };
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

function configKey(cfg, actor) {
  return hashObject({
    createdById: String(actor?.id || cfg.createdById || ''),
    datasetId: cfg.datasetId,
    contentHash: cfg.contentHash,
    groups: uniqueSorted(cfg.groups),
    split: cfg.split,
    offset: cfg.offset,
    limit: cfg.limit,
    ids: [...(cfg.ids || [])].sort(),
    selectUnit: cfg.selectUnit || 'base_case',
    replicates: cfg.replicates,
    inferenceMode: cfg.inferenceMode,
    inputMode: cfg.inputMode,
    maxBurden: cfg.maxBurden,
    maxRounds: cfg.maxRounds,
    runTag: cfg.runTag || '',
  });
}

function estimate(cfg, selected) {
  const baseIds = new Set(selected.map((c) => c.baseId));
  const groups = uniqueSorted(cfg.groups).length;
  const tasks = selected.length * groups * cfg.replicates;
  return {
    selectUnit: cfg.selectUnit || 'base_case',
    baseCases: baseIds.size,
    scenes: selected.length,
    groups,
    replicates: cfg.replicates,
    tasks,
    note: 'Task count is not a model-call count or a currency cost. Token price is unknown unless the provider returns usage.',
    estimatedCost: 'unknown',
  };
}

function freezeProtocol(snap, cfg) {
  let promptRef = null;
  try { promptRef = getPrompt('rx-screening').ref; } catch { /* keep null */ }
  return {
    engineVersion: ENGINE_VERSION,
    datasetId: snap.datasetId,
    datasetVersion: snap.version,
    datasetHash: snap.contentHash,
    evaluationNow: snap.evaluationNow || snap.generatedAt,
    encounterRule: snap.encounterRule || null,
    promptVersion: promptRef,
    knowledgeBaseVersion: knowledgeBaseVersion() || null,
    ruleSetVersion: typeof ruleSetVersion === 'function' ? ruleSetVersion() : null,
    requestedMode: cfg.inferenceMode,
    overlay: cfg.inferenceMode === 'real' ? overlayMeta() : { provider: cfg.inferenceMode, model: null, baseUrlHost: null },
  };
}

function protocolMismatch(job) {
  if (!job.protocol) return 'Job has no frozen protocol';
  if (job.protocol.engineVersion !== ENGINE_VERSION) {
    return `Frozen engine ${job.protocol.engineVersion} does not match ${ENGINE_VERSION}`;
  }
  if (job.config.inferenceMode === 'real') {
    const now = overlayMeta();
    if (job.protocol.overlay?.model && job.protocol.overlay.model !== now.model) {
      return 'Approved model changed after this job was frozen';
    }
  }
  return null;
}

function acquireSlot() {
  return new Promise((resolve) => {
    const cap = Math.max(1, limits().maxConcurrency || 1);
    if (globalUsed < cap) {
      globalUsed += 1;
      resolve();
      return;
    }
    waiters.push(resolve);
  });
}

function releaseSlot() {
  if (waiters.length) {
    const next = waiters.shift();
    next();
    return;
  }
  globalUsed = Math.max(0, globalUsed - 1);
}

function createJob(body, actor) {
  let snap;
  try {
    snap = body.contentHash ? snapshotService.getByHash(body.contentHash) : snapshotService.current();
  } catch (err) {
    if (err.code === 'snapshot_missing' || err.code === 'snapshot_corrupt') throw err;
    throw err;
  }
  const groups = uniqueSorted((body.groups || ['A', 'C', 'D']).filter((g) => engine.GROUPS[g]));
  if (!groups.length) throw Object.assign(new Error('no valid groups'), { code: 'invalid_groups' });
  const inferenceMode = body.inferenceMode === 'real' ? 'real' : (body.inferenceMode === 'rules' ? 'rules' : 'mock');
  const cap = limits();
  const limit = body.limit == null ? 1 : Number(body.limit);
  const selectUnit = body.selectUnit === 'scene' ? 'scene' : 'base_case';
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 40) : [];
  const cfg = {
    datasetId: snap.datasetId,
    contentHash: snap.contentHash,
    groups,
    split: body.split || 'test',
    offset: Number(body.offset) || 0,
    limit: Number.isFinite(limit) ? limit : 1,
    ids,
    selectUnit,
    replicates: Math.max(1, Math.min(3, Number(body.replicates) || 1)),
    inferenceMode,
    inputMode: body.inputMode === 'end_to_end_nl' ? 'end_to_end_nl' : 'structured',
    maxBurden: Math.max(1, Math.min(12, Number(body.maxBurden) || 6)),
    maxRounds: Math.max(1, Math.min(6, Number(body.maxRounds) || 3)),
    runTag: String(body.runTag || ''),
  };
  const pack = engine.packFromSnapshot(snap);
  const selected = engine.selectCases(pack, cfg);
  const baseCount = new Set(selected.map((c) => c.baseId)).size;
  if (inferenceMode === 'real') {
    if (!cap.allowLive) throw Object.assign(new Error('Administrator has not allowed live research calls'), { code: 'live_forbidden' });
    if (!runtime.isAiEnabled()) throw Object.assign(new Error('Global AI switch is off'), { code: 'ai_disabled' });
    if (!body.confirmLive) throw Object.assign(new Error('Live run requires confirmLive'), { code: 'confirm_live_required' });
    if (baseCount > cap.maxCasesLive) {
      throw Object.assign(new Error(`Live range ${baseCount} exceeds administrator hard cap ${cap.maxCasesLive}`), { code: 'live_hard_cap' });
    }
    if (baseCount > (cap.confirmCasesThreshold || cap.maxCasesLive) && !body.confirmFullLive) {
      throw Object.assign(new Error(`Live range exceeds confirm threshold ${cap.confirmCasesThreshold}. Set confirmFullLive to acknowledge. This does not raise the hard cap.`), { code: 'confirm_full_live_required' });
    }
  }
  const key = configKey(cfg, actor);
  const existing = listJobs().find((j) => j.configKey === key && j.status !== 'cancelled');
  if (existing) {
    if (!canSee(existing, actor)) {
      throw Object.assign(new Error('An experiment with this configuration belongs to another researcher'), { code: 'job_forbidden' });
    }
    return { job: existing, replayed: true };
  }
  const tasks = [];
  for (const raw of selected) {
    for (const groupId of groups) {
      for (let replicate = 1; replicate <= cfg.replicates; replicate += 1) {
        tasks.push({ researchCaseId: raw.id, baseId: raw.baseId, groupId, replicate, attempt: 1 });
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
    protocol: freezeProtocol(snap, cfg),
    estimate: estimate(cfg, selected),
    cursor: 0,
    tasks,
    counts: { queued: tasks.length, running: 0, completed: 0, failed: 0, cancelled: 0, policy_paused: 0 },
    usage: {
      known: false,
      completeness: 'unknown',
      totalTokens: null,
      modelCalls: 0,
      note: 'Usage stays unknown until a provider returns token counts. Known fragments are partial.',
    },
    cancelRequested: false,
    engineVersion: ENGINE_VERSION,
    legacyNote: null,
  };
  saveJob(job);
  kick(job.id);
  return { job, replayed: false };
}

function summarize(job) {
  const rows = listResults(job.id);
  const byGroup = {};
  for (const g of job.config.groups) {
    const gs = rows.filter((r) => r.groupId === g && !r.superseded);
    byGroup[g] = {
      n: gs.length,
      denominatorNote: 'n is scene×replicate rows, not extra patients',
      engineeringFailures: gs.filter((r) => r.engineeringFailure).length,
      modelFailures: gs.filter((r) => r.modelFailure).length,
      cancelled: gs.filter((r) => r.executionStatus === 'cancelled').length,
      policyPaused: gs.filter((r) => r.executionStatus === 'policy_paused').length,
      asked: gs.reduce((s, r) => s + (r.asked || 0), 0),
      scriptResponded: gs.reduce((s, r) => s + (r.scriptResponded || 0), 0),
      factResolved: gs.reduce((s, r) => s + (r.factResolved || 0), 0),
      answeredUnknown: gs.reduce((s, r) => s + (r.answeredUnknown || 0), 0),
      noScript: gs.reduce((s, r) => s + (r.noScript || 0), 0),
      latencyMs: gs.length ? Math.round(gs.reduce((s, r) => s + (r.latencyMs || 0), 0) / gs.length) : null,
      clinicalAccuracy: 'not_evaluated',
    };
  }
  return {
    byGroup,
    pairedNote: 'Pair C/D on the same baseId and related scenes. Multiple scenes are not independent patients.',
    clinicalAccuracy: 'not_evaluated',
    engineVersion: job.engineVersion || ENGINE_VERSION,
  };
}

function recount(job) {
  const rows = listResults(job.id).filter((r) => !r.superseded);
  const counts = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, policy_paused: 0 };
  counts.queued = Math.max(0, (job.tasks || []).length - (job.cursor || 0));
  for (const r of rows) {
    if (r.executionStatus === 'cancelled' || r.executionStatus === 'cancelled_late') counts.cancelled += 1;
    else if (r.executionStatus === 'policy_paused') counts.policy_paused += 1;
    else if (r.executionStatus === 'failed' || r.engineeringFailure) counts.failed += 1;
    else if (r.executionStatus === 'completed' || r.ok) counts.completed += 1;
  }
  return counts;
}

function currentCaps(job, groupId) {
  const cfg = engine.GROUPS[groupId] || {};
  return resolveCapabilities({
    requestedMode: job.config.inferenceMode,
    groupCfg: cfg,
    allowLive: limits().allowLive,
    runtimeEnabled: runtime.isAiEnabled(),
  });
}

async function processNext(jobId) {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    let job = getJob(jobId);
    if (!job) return;
    if (job.cancelRequested) {
      mergeSave({ id: jobId, status: 'cancelled', finishedAt: new Date().toISOString() });
      return;
    }
    if (['completed', 'cancelled'].includes(job.status) && !job.resume) return;
    const mismatch = protocolMismatch(job);
    if (mismatch) {
      mergeSave({
        id: jobId, status: 'policy_paused', pausedReason: mismatch, resume: false,
      });
      return;
    }
    if (job.config.inferenceMode === 'real') {
      const cap = limits();
      if (!cap.allowLive || !runtime.isAiEnabled()) {
        mergeSave({
          id: jobId,
          status: 'policy_paused',
          pausedReason: !runtime.isAiEnabled()
            ? 'Global AI switch is off. No new model or automatic external search is scheduled.'
            : 'Live research calls are not allowed.',
          resume: false,
        });
        return;
      }
    }
    mergeSave({
      id: jobId,
      status: 'running',
      startedAt: job.startedAt || new Date().toISOString(),
      resume: false,
    });
    let snap;
    try {
      snap = snapshotService.getByHash(job.datasetHash);
    } catch (err) {
      mergeSave({
        id: jobId,
        status: 'failed',
        error: err.message,
        errorCode: err.code || 'snapshot_error',
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    const pack = engine.packFromSnapshot(snap);
    let provider;
    try {
      const kind = resolveCapabilities({
        requestedMode: job.config.inferenceMode,
        groupCfg: { aiEnabled: true },
        allowLive: limits().allowLive,
        runtimeEnabled: runtime.isAiEnabled(),
      }).providerKind;
      provider = providerFactory ? providerFactory(job) : providerForKind(kind);
    } catch (err) {
      mergeSave({
        id: jobId, status: 'failed', error: err.message, finishedAt: new Date().toISOString(),
      });
      return;
    }
    job = getJob(jobId);
    const slice = job.tasks.slice(job.cursor, job.cursor + 1);
    for (const task of slice) {
      const fresh = getJob(jobId);
      if (fresh.cancelRequested) {
        mergeSave({ id: jobId, cancelRequested: true, status: 'cancelled', finishedAt: new Date().toISOString() });
        return;
      }
      const attempt = task.attempt || 1;
      const key = resultKey(job.id, task.researchCaseId, task.groupId, task.replicate, attempt);
      const prior = getResult(key);
      if (prior && (prior.ok || prior.executionStatus === 'completed') && !prior.superseded) {
        mergeSave({ id: jobId, cursor: fresh.cursor + 1, counts: recount({ ...fresh, cursor: fresh.cursor + 1 }) });
        continue;
      }
      await acquireSlot();
      const controller = new AbortController();
      const watch = setInterval(() => {
        if (getJob(jobId)?.cancelRequested && !controller.signal.aborted) controller.abort();
      }, 50);
      try {
        const raw = (snap.cases || []).find((c) => c.id === task.researchCaseId);
        const liveJob = () => getJob(jobId);
        const row = await engine.runOne({
          pack,
          raw,
          groupId: task.groupId,
          provider,
          opts: {
            inputMode: job.config.inputMode,
            maxBurden: job.config.maxBurden,
            maxRounds: job.config.maxRounds,
            requestedMode: job.config.inferenceMode,
            allowLive: limits().allowLive,
            policyAllows: () => runtime.isAiEnabled() && (job.config.inferenceMode !== 'real' || limits().allowLive),
            isCancelled: () => Boolean(liveJob()?.cancelRequested),
            signal: controller.signal,
            reserveModelCall: () => {
              const cur = liveJob();
              const cap = limits();
              const used = Number(cur.usage?.modelCalls || 0);
              if (used + 1 > (cap.maxModelCallsPerJob || cap.maxRequestsPerJob)) return false;
              mergeSave({
                id: jobId,
                usage: { ...cur.usage, modelCalls: used + 1 },
              });
              return true;
            },
            onCall: ({ usage }) => {
              const cur = liveJob();
              const nextUsage = { ...(cur.usage || {}) };
              if (usage?.total_tokens != null) {
                nextUsage.known = true;
                nextUsage.completeness = nextUsage.completeness === 'unknown' ? 'partial' : 'partial';
                nextUsage.totalTokens = (nextUsage.totalTokens || 0) + Number(usage.total_tokens);
              } else if (!nextUsage.known) {
                nextUsage.completeness = 'unknown';
              } else {
                nextUsage.completeness = 'partial';
              }
              mergeSave({ id: jobId, usage: nextUsage });
            },
          },
        });
        const cancelledNow = Boolean(liveJob()?.cancelRequested);
        const executionStatus = cancelledNow
          ? (row.executionStatus === 'completed' ? 'cancelled_late' : 'cancelled')
          : (row.executionStatus || (row.ok ? 'completed' : 'failed'));
        saveResult({
          key,
          jobId: job.id,
          experimentId: job.experimentId,
          ...row,
          ok: executionStatus === 'completed',
          executionStatus,
          replicate: task.replicate,
          attempt,
          createdAt: new Date().toISOString(),
        });
        const after = liveJob();
        const nextCursor = after.cursor + 1;
        mergeSave({
          id: jobId,
          cursor: nextCursor,
          counts: recount({ ...after, cursor: nextCursor }),
        });
      } finally {
        clearInterval(watch);
        releaseSlot();
      }
    }
    const done = getJob(jobId);
    if (done.cancelRequested) {
      mergeSave({ id: jobId, status: 'cancelled', finishedAt: new Date().toISOString(), counts: recount(done) });
      return;
    }
    if (done.cursor >= done.tasks.length) {
      mergeSave({
        id: jobId,
        status: 'completed',
        finishedAt: new Date().toISOString(),
        summary: summarize(done),
        counts: recount({ ...done, cursor: done.tasks.length }),
      });
      return;
    }
    setImmediate(() => processNext(jobId));
  } catch (err) {
    mergeSave({
      id: jobId,
      status: 'failed',
      error: err.message,
      finishedAt: new Date().toISOString(),
    });
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
  const next = {
    id: job.id,
    cancelRequested: true,
  };
  if (job.status === 'queued' || job.status === 'policy_paused') {
    next.status = 'cancelled';
    next.finishedAt = new Date().toISOString();
  }
  const saved = mergeSave(next);
  return { job: saved };
}

function resumeJob(id, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  const mismatch = protocolMismatch(job);
  if (mismatch) {
    const saved = mergeSave({ id: job.id, status: 'policy_paused', pausedReason: mismatch });
    return { job: saved };
  }
  if (job.config.inferenceMode === 'real' && (!limits().allowLive || !runtime.isAiEnabled())) {
    const saved = mergeSave({
      id: job.id,
      status: 'policy_paused',
      pausedReason: 'Live research is not allowed at resume time.',
    });
    return { job: saved };
  }
  const saved = mergeSave({
    id: job.id,
    cancelRequested: false,
    _clearCancel: true,
    resume: true,
    status: job.cursor < job.tasks.length ? 'queued' : job.status,
    pausedReason: null,
  });
  if (saved.cursor < saved.tasks.length) kick(saved.id);
  return { job: saved };
}

function retryFailed(id, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  if (job.status === 'running') {
    throw Object.assign(new Error('Cannot retry while the job is running'), { code: 'job_running' });
  }
  const failed = listResults(job.id).filter((r) => !r.superseded && (r.executionStatus === 'failed' || r.engineeringFailure || (!r.ok && r.executionStatus !== 'cancelled' && r.executionStatus !== 'cancelled_late' && r.executionStatus !== 'policy_paused')));
  if (!failed.length) return { job };
  const firstIdx = job.tasks.findIndex((t) => failed.some((r) => r.researchCaseId === t.researchCaseId && r.groupId === t.groupId && r.replicate === t.replicate));
  const nextTasks = job.tasks.map((t) => {
    const hit = failed.find((r) => r.researchCaseId === t.researchCaseId && r.groupId === t.groupId && r.replicate === t.replicate);
    if (!hit) return t;
    return { ...t, attempt: (t.attempt || 1) + 1 };
  });
  for (const r of failed) {
    saveResult({
      ...r,
      superseded: true,
      attempts: [...(r.attempts || []), { key: r.key, at: new Date().toISOString(), executionStatus: r.executionStatus }],
    });
  }
  const saved = mergeSave({
    id: job.id,
    tasks: nextTasks,
    cursor: firstIdx >= 0 ? firstIdx : job.cursor,
    status: 'queued',
    cancelRequested: false,
    _clearCancel: true,
    retryGeneration: (job.retryGeneration || 0) + 1,
    counts: recount({ ...job, tasks: nextTasks, cursor: firstIdx >= 0 ? firstIdx : job.cursor }),
  });
  kick(saved.id);
  return { job: saved };
}

function resumeUnfinished() {
  for (const job of listJobs()) {
    if (['queued', 'running'].includes(job.status) && job.cursor < (job.tasks || []).length && !job.cancelRequested) {
      kick(job.id);
    }
  }
}

async function adviseOnResult(id, body, user) {
  const job = getJob(id);
  if (!job) return null;
  if (!canSee(job, user)) return { forbidden: true };
  const researchCaseId = String(body.researchCaseId || '');
  const groupId = String(body.groupId || '');
  const replicate = Number(body.replicate || 1);
  const attempt = Number(body.attempt || 1);
  const row = getResult(resultKey(job.id, researchCaseId, groupId, replicate, attempt))
    || listResults(job.id).find((r) => r.researchCaseId === researchCaseId && r.groupId === groupId && r.replicate === replicate && !r.superseded);
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
  const rows = listResults(job.id).filter((r) => !r.superseded);
  const out = await advisor.adviseJob({
    job,
    rows,
    lang: body.lang === 'en' ? 'en' : 'zh',
    wantModel: body.wantModel !== false,
  });
  const saved = mergeSave({ id: job.id, advisor: out });
  return { job: saved, advisor: out };
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
    engineVersion: job.engineVersion || ENGINE_VERSION,
    protocol: job.protocol || null,
    datasetId: job.datasetId,
    datasetHash: job.datasetHash,
    createdByRole: job.createdByRole,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    status: job.status,
    config: job.config,
    estimate: job.estimate,
    summary: job.summary || summarize(job),
    note: 'Synthetic base cases × groups are case-level evaluations, not real patients. Mock and real rows stay separate. Old engine rows are not a new-protocol formal analysis. No identifiers or API keys.',
    clinicalAccuracy: 'not_evaluated',
    rows,
  };
  if (format === 'csv') {
    const header = ['experimentId', 'researchCaseId', 'baseId', 'groupId', 'replicate', 'executionStatus', 'filteredRisk', 'asked', 'factResolved', 'stopReason', 'clinicalAccuracy'];
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
  configKey,
  mergeSave,
  processNext,
  resultKey,
  currentCaps,
  _setProviderFactory(fn) { providerFactory = fn; },
  _resetTestHooks() {
    providerFactory = null;
    globalUsed = 0;
    waiters.length = 0;
  },
};
