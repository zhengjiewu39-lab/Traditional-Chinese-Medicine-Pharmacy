const express = require('express');
const fs = require('fs');
const path = require('path');
const { requirePermission, sendError } = require('../security/rbac');
const { handle, validateBody } = require('../routes/aiHttp');
const researchProtocol = require('../workflow/researchProtocol');
const snapshotService = require('./snapshotService');
const jobs = require('./experimentJobs');
const engine = require('./experimentEngine');

const router = express.Router();

const PROTOCOL_BODY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    note: { type: 'string', maxLength: 400 },
    fastTrack: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        maxTier: { type: 'string', enum: ['A0', 'A1'] },
        noAbstain: { type: 'boolean' },
        noCriticalMissing: { type: 'boolean' },
      },
    },
    dualReview: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        minTier: { type: 'string', enum: ['A1', 'A2', 'A3'] },
        onAbstain: { type: 'boolean' },
      },
    },
  },
};

const JOB_BODY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    contentHash: { type: 'string', maxLength: 80 },
    groups: { type: 'array', items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'RAG_off'] } },
    split: { type: 'string', enum: ['test', 'dev', 'all'] },
    offset: { type: 'integer', minimum: 0, maximum: 5000 },
    limit: { type: 'integer', minimum: 1, maximum: 2000 },
    ids: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 40 },
    replicates: { type: 'integer', minimum: 1, maximum: 3 },
    inferenceMode: { type: 'string', enum: ['mock', 'rules', 'real'] },
    inputMode: { type: 'string', enum: ['structured', 'end_to_end_nl'] },
    maxBurden: { type: 'integer', minimum: 1, maximum: 12 },
    maxRounds: { type: 'integer', minimum: 1, maximum: 6 },
    confirmLive: { type: 'boolean' },
    confirmFullLive: { type: 'boolean' },
    runTag: { type: 'string', maxLength: 40 },
  },
};

const LIMITS_BODY = {
  type: 'object',
  additionalProperties: false,
  required: ['allowLive'],
  properties: {
    allowLive: { type: 'boolean' },
    maxConcurrency: { type: 'integer', minimum: 1, maximum: 4 },
    maxRequestsPerJob: { type: 'integer', minimum: 1, maximum: 20000 },
    maxCasesLive: { type: 'integer', minimum: 1, maximum: 500 },
  },
};

router.get('/protocol', requirePermission('research:protocol'), handle(async (req, res) => {
  res.json({ protocol: researchProtocol.getProtocol() });
}));

router.put('/protocol', requirePermission('research:protocol'), validateBody(PROTOCOL_BODY), handle(async (req, res) => {
  res.json({ protocol: researchProtocol.saveProtocol(req.body || {}, req.user) });
}));

router.get('/', requirePermission('research:evaluation'), handle(async (req, res) => {
  const snap = snapshotService.ensureCurrent();
  const mockPath = path.resolve(__dirname, '../../benchmarks/ai-review/results/latest.md');
  res.json({
    home: '/research/evaluation',
    protocol: researchProtocol.getProtocol(),
    paperQuestion: '患者信息缺失或矛盾时，证据检索和结构化澄清是否能提高AI药学审核提示的可靠性。',
    primaryComparison: 'D vs C',
    groups: engine.GROUP_LABELS,
    snapshot: snapshotService.publicMeta(snapshotService.listMeta()[0]) || {
      datasetId: snap.datasetId,
      contentHash: snap.contentHash,
      counts: snap.counts,
      generatedAt: snap.generatedAt,
      expertReviewStatus: snap.expertReviewStatus,
    },
    archivedInteractivePack: {
      path: 'benchmarks/ai-review/cases-interactive-v1.json',
      role: 'historical_regression',
      defaultMainExperiment: false,
      note: 'IT01–IT06 are archived. They are not the default main experiment.',
    },
    mockEngineeringReport: fs.existsSync(mockPath) ? { path: 'benchmarks/ai-review/results/latest.md', notLiveModel: true } : null,
    warning: 'This console evaluates synthetic base cases. Mock is engineering only. A successful model call is not medical correctness. Clinical labels stay not_evaluated until an independent rater finishes.',
    medwear: { enabled: false, reason: 'No real MedWear interface; integration is disabled.' },
    limits: { allowLive: jobs.limits().allowLive, maxCasesLive: jobs.limits().maxCasesLive },
  });
}));

router.get('/snapshot', requirePermission('research:evaluation'), handle(async (req, res) => {
  const snap = snapshotService.ensureCurrent();
  res.json({
    ...snapshotService.publicMeta(snapshotService.listMeta()[0]),
    versions: snapshotService.listMeta().map(snapshotService.publicMeta),
    exceptions: snap.exceptions || [],
  });
}));

router.get('/snapshot/cases', requirePermission('research:evaluation'), handle(async (req, res) => {
  const snap = snapshotService.current();
  res.json(snapshotService.listCases(snap, {
    q: req.query.q,
    split: req.query.split,
    offset: Number(req.query.offset) || 0,
    limit: Math.min(50, Number(req.query.limit) || 20),
  }));
}));

router.get('/snapshot/exceptions', requirePermission('research:evaluation'), handle(async (req, res) => {
  const snap = snapshotService.current();
  res.json({ total: (snap.exceptions || []).length, records: snap.exceptions || [] });
}));

router.get('/snapshot/cases/:id', requirePermission('research:evaluation'), handle(async (req, res) => {
  const snap = snapshotService.current();
  const annotate = req.query.annotate === '1' && req.user.role === 'researcher';
  const row = snapshotService.getCase(snap, req.params.id, { annotate });
  if (!row) return sendError(res, 404, 'not_found', 'Research case not found');
  res.json({
    case: row,
    annotate,
    note: annotate
      ? 'Hidden facts and scripts are for authorized labeling only. They are not sent to the model under test.'
      : 'Hidden facts and reference answers are omitted.',
  });
}));

router.post('/jobs', requirePermission('research:evaluation'), validateBody(JOB_BODY), handle(async (req, res) => {
  try {
    const out = jobs.createJob(req.body || {}, req.user);
    res.status(out.replayed ? 200 : 201).json({ job: jobs.publicJob(out.job), replayed: out.replayed });
  } catch (err) {
    const code = err.code || 'job_rejected';
    const status = code === 'snapshot_missing' ? 404 : 400;
    return sendError(res, status, code, err.message);
  }
}));

router.get('/jobs', requirePermission('research:evaluation'), handle(async (req, res) => {
  const rows = jobs.listJobs().filter((j) => jobs.canSee(j, req.user)).map(jobs.publicJob);
  res.json({ jobs: rows });
}));

router.get('/jobs/:id', requirePermission('research:evaluation'), handle(async (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return sendError(res, 404, 'not_found', 'Job not found');
  if (!jobs.canSee(job, req.user)) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  res.json({ job: jobs.publicJob(job), summary: job.summary || null });
}));

router.get('/jobs/:id/results', requirePermission('research:evaluation'), handle(async (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return sendError(res, 404, 'not_found', 'Job not found');
  if (!jobs.canSee(job, req.user)) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  res.json({ job: jobs.publicJob(job), results: jobs.listResults(job.id) });
}));

router.get('/jobs/:id/cases/:caseId', requirePermission('research:evaluation'), handle(async (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return sendError(res, 404, 'not_found', 'Job not found');
  if (!jobs.canSee(job, req.user)) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  const rows = jobs.listResults(job.id).filter((r) => r.researchCaseId === req.params.caseId || r.baseId === req.params.caseId);
  res.json({ jobId: job.id, researchCaseId: req.params.caseId, turns: rows });
}));

router.post('/jobs/:id/cancel', requirePermission('research:evaluation'), handle(async (req, res) => {
  const out = jobs.cancelJob(req.params.id, req.user);
  if (!out) return sendError(res, 404, 'not_found', 'Job not found');
  if (out.forbidden) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  res.json({ job: jobs.publicJob(out.job) });
}));

router.post('/jobs/:id/resume', requirePermission('research:evaluation'), handle(async (req, res) => {
  const out = jobs.resumeJob(req.params.id, req.user);
  if (!out) return sendError(res, 404, 'not_found', 'Job not found');
  if (out.forbidden) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  res.json({ job: jobs.publicJob(out.job) });
}));

router.post('/jobs/:id/retry-failed', requirePermission('research:evaluation'), handle(async (req, res) => {
  const out = jobs.retryFailed(req.params.id, req.user);
  if (!out) return sendError(res, 404, 'not_found', 'Job not found');
  if (out.forbidden) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  res.json({ job: jobs.publicJob(out.job) });
}));

const ADVISE_BODY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    researchCaseId: { type: 'string', maxLength: 80 },
    groupId: { type: 'string', enum: ['A', 'B', 'C', 'D', 'RAG_off'] },
    replicate: { type: 'integer', minimum: 1, maximum: 3 },
    lang: { type: 'string', enum: ['zh', 'en'] },
    wantModel: { type: 'boolean' },
    scope: { type: 'string', enum: ['result', 'job'] },
  },
};

router.post('/jobs/:id/advise', requirePermission('research:evaluation'), validateBody(ADVISE_BODY), handle(async (req, res) => {
  const body = req.body || {};
  const out = body.scope === 'job' || !body.researchCaseId
    ? await jobs.adviseOnJob(req.params.id, body, req.user)
    : await jobs.adviseOnResult(req.params.id, body, req.user);
  if (!out) return sendError(res, 404, 'not_found', 'Job or result not found');
  if (out.forbidden) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  if (out.missing) return sendError(res, 404, 'not_found', 'Result not found');
  res.json({ job: jobs.publicJob(out.job), result: out.result || null, advisor: out.advisor });
}));

router.get('/jobs/:id/export', requirePermission('research:evaluation'), handle(async (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return sendError(res, 404, 'not_found', 'Job not found');
  if (!jobs.canSee(job, req.user)) return sendError(res, 403, 'forbidden', 'This job belongs to another researcher');
  const out = jobs.exportJob(job, req.query.format === 'csv' ? 'csv' : 'json');
  res.setHeader('Content-Type', out.type);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.body);
}));

router.put('/limits', requirePermission('ai:runtime_configure'), validateBody(LIMITS_BODY), handle(async (req, res) => {
  res.json({ limits: jobs.saveLimits(req.body, req.user) });
}));

router.get('/export', requirePermission('research:evaluation'), handle(async (req, res) => {
  return sendError(res, 400, 'use_job_export', 'Export a finished job at /research/evaluation/jobs/:id/export');
}));

module.exports = router;
