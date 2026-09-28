const express = require('express');
const {
  DEFAULT_SCENARIO,
  validateScenario,
  FIELD_HELP,
  LIMITS,
  SCENARIO_PRESETS,
  buildPreset,
} = require('../simulation/scenarioSchema');
const { hashScenario } = require('../simulation/scenarioHash');
const { listPolicies, listAblations, getPolicy, resolvePolicyId, resolveParams } = require('../simulation/policyEngine');
const { getGitCommitHash, getCommitSource, getPackageLockHash } = require('../simulation/gitInfo');
const { ENGINE_VERSION } = require('../simulation/simulationEngine');
const {
  aggregateReplicates,
  aggregateDailyTimeSeries,
  aggregateRegionalReplicates,
  pairedPolicyComparison,
  PRIMARY_METRICS,
} = require('../simulation/metricsEngine');
const {
  saveExperiment,
  listExperiments,
  getExperiment,
  newExperimentId,
  newExperimentGroupId,
} = require('../simulation/experimentRepository');
const { metricsToCsv, experimentSummaryMarkdown, pickExportMetrics } = require('../simulation/exportService');
const {
  MAX_REPLICATES,
  parseReplicates,
  parsePolicyId,
  parsePolicyIds,
  rejectUnknownKeys,
  isExperimentId,
  isGroupId,
  isJobId,
} = require('../simulation/requestValidation');
const { JobQueue } = require('../simulation/jobQueue');

const router = express.Router();
const queue = new JobQueue({ concurrency: Number(process.env.SIMULATION_WORKERS) || 1 });

function bad(res, message, errors = []) {
  return res.status(400).json({ message, errors });
}

function seedList(randomSeed, n) {
  return Array.from({ length: n }, (_, i) => randomSeed + i);
}

function provenance() {
  return {
    engineVersion: ENGINE_VERSION,
    gitCommitHash: getGitCommitHash(),
    gitCommitSource: getCommitSource(),
    packageLockHash: getPackageLockHash(),
    nodeVersion: process.version,
  };
}

function experimentPayload({ id, scenario, scenarioHash, policyId, results, startedAt, prov, extra = {} }) {
  const base = {
    id,
    scenarioId: scenario.id,
    scenarioHash,
    scenarioVersion: scenario.schemaVersion,
    scenario,
    policyId,
    policyVersion: getPolicy(policyId).version,
    policyParams: resolveParams(policyId, scenario),
    randomSeed: scenario.randomSeed,
    replicateSeeds: results.map((r) => r.seed),
    replicates: results.length,
    ...prov,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...extra,
  };
  if (results.length === 1) {
    return { ...base, metrics: results[0].metrics, runLog: results[0].runLog, summary: results[0].metrics };
  }
  return {
    ...base,
    results,
    summary: aggregateReplicates(results.map((r) => r.metrics)),
    regionalAggregate: aggregateRegionalReplicates(results),
    dailyAggregate: aggregateDailyTimeSeries(results.filter((r) => r.runLog)),
  };
}

router.param('id', (req, res, next, id) => (isExperimentId(id) ? next() : bad(res, 'Invalid experiment id')));
router.param('jobId', (req, res, next, id) => (isJobId(id) ? next() : bad(res, 'Invalid job id')));
router.param('groupId', (req, res, next, id) => (isGroupId(id) ? next() : bad(res, 'Invalid experiment group id')));

router.get('/meta', (_req, res) => {
  res.json({
    platform: 'Community Pharmacy Access and Supply Resilience Simulator',
    platformZh: '社区药房药品可及性与供应韧性仿真平台',
    dataClassification: 'synthetic-simulation-only',
    engineVersion: ENGINE_VERSION,
    simulationRouteVersion: 3,
    maxReplicates: MAX_REPLICATES,
    primaryMetrics: PRIMARY_METRICS,
    gitCommitHash: getGitCommitHash(),
    disclaimer: 'Synthetic simulation research platform. No real patient, prescription, pharmacy transaction, or clinical outcome data. Results cannot be read as effects of real policies.',
  });
});

router.get('/scenario/default', (_req, res) => {
  res.json({ scenario: DEFAULT_SCENARIO, help: FIELD_HELP, limits: LIMITS });
});

router.get('/scenario/presets', (_req, res) => {
  res.json({
    presets: Object.entries(SCENARIO_PRESETS).map(([key, p]) => ({ key, id: p.id, name: p.name })),
  });
});

router.get('/scenario/presets/:key', (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(SCENARIO_PRESETS, req.params.key)) {
    return res.status(404).json({ message: 'Unknown preset' });
  }
  res.json({ scenario: buildPreset(req.params.key) });
});

router.post('/scenario/validate', (req, res) => {
  const result = validateScenario(req.body);
  res.status(200).json({ ...result, scenarioHash: result.valid ? hashScenario(result.scenario) : null });
});

router.get('/policies', (_req, res) => {
  res.json({ policies: listPolicies(), ablations: listAblations() });
});

router.get('/experiments', (_req, res) => {
  res.json({ experiments: listExperiments() });
});

router.get('/experiments/:id', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Experiment not found' });
  res.json(exp);
});

router.post('/run', (req, res) => {
  const unknown = rejectUnknownKeys(req.body, ['scenario', 'policyId', 'replicates']);
  if (unknown.length) return bad(res, 'Invalid request', unknown);
  const { scenario: rawScenario, policyId, replicates: rawReplicates } = req.body || {};
  const { valid, errors, scenario } = validateScenario(rawScenario || DEFAULT_SCENARIO);
  if (!valid) return bad(res, 'Invalid scenario configuration', errors);
  const pol = parsePolicyId(policyId);
  if (pol.error) return bad(res, pol.error, [pol.error]);
  const reps = parseReplicates(rawReplicates, { defaultValue: 1 });
  if (reps.error) return bad(res, reps.error, [reps.error]);

  const jobId = newExperimentId();
  const scenarioHash = hashScenario(scenario);
  const startedAt = new Date().toISOString();
  const prov = provenance();
  const status = queue.submit(jobId, { policyIds: [pol.value], scenario, seeds: seedList(scenario.randomSeed, reps.value) }, (byPolicy) => {
    saveExperiment(experimentPayload({
      id: jobId, scenario, scenarioHash, policyId: pol.value, results: byPolicy[pol.value], startedAt, prov,
    }));
    return { experimentId: jobId };
  }, { kind: 'run', policyId: pol.value, scenarioHash });
  res.status(202).json({ jobId, ...status, message: 'Simulation queued. Poll GET /api/simulation/jobs/:jobId' });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = queue.status(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(job);
});

router.post('/jobs/:jobId/cancel', (req, res) => {
  const job = queue.cancel(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(job);
});

router.get('/experiments/:id/export.csv', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Not found' });
  const m = pickExportMetrics(exp);
  if (!m) return res.status(400).json({ message: 'No exportable metrics on experiment' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${exp.id}.csv"`);
  res.send(metricsToCsv(m, true, {
    experimentGroupId: exp.experimentGroupId,
    scenarioHash: exp.scenarioHash,
    policyId: exp.policyId,
    engineVersion: exp.engineVersion,
    replicates: exp.replicates,
  }));
});

router.get('/experiments/:id/export.json', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${exp.id}.json"`);
  res.send(JSON.stringify(exp, null, 2));
});

router.post('/experiments/:id/rerun-exact', (req, res) => {
  const source = getExperiment(req.params.id);
  if (!source) return res.status(404).json({ message: 'Experiment not found' });
  if (!source.scenario || !source.policyId) return bad(res, 'Stored experiment missing scenario or policyId');
  const canonical = resolvePolicyId(source.policyId);
  if (!canonical) return bad(res, 'Unknown stored policyId', [source.policyId]);
  const { valid, errors, scenario } = validateScenario(source.scenario);
  if (!valid) return bad(res, 'Stored scenario does not validate under the current schema', errors);
  const n = source.replicateSeeds?.length || source.replicates || 1;
  const seeds = source.replicateSeeds?.length ? source.replicateSeeds : seedList(source.randomSeed, n);
  const scenarioHash = hashScenario(scenario);
  const engineMismatch = source.engineVersion && source.engineVersion !== ENGINE_VERSION;
  const jobId = newExperimentId();
  const startedAt = new Date().toISOString();
  const prov = provenance();
  const status = queue.submit(jobId, { policyIds: [canonical], scenario, seeds }, (byPolicy) => {
    saveExperiment(experimentPayload({
      id: jobId, scenario, scenarioHash, policyId: canonical, results: byPolicy[canonical], startedAt, prov,
      extra: { rerunOf: source.id, sourceScenarioHash: source.scenarioHash },
    }));
    return { experimentId: jobId };
  }, { kind: 'rerun-exact', policyId: canonical, scenarioHash, sourceExperimentId: source.id });
  res.status(202).json({
    jobId,
    ...status,
    sourceExperimentId: source.id,
    engineVersion: ENGINE_VERSION,
    sourceEngineVersion: source.engineVersion,
    scenarioHashMatches: scenarioHash === source.scenarioHash,
    reproductionNote: engineMismatch
      ? 'Configuration re-run, not bitwise reproduction because engine version differs.'
      : 'Exact re-run with frozen scenario and replicate seeds.',
  });
});

router.post('/run-group', (req, res) => {
  const unknown = rejectUnknownKeys(req.body, ['scenario', 'policyIds', 'replicates']);
  if (unknown.length) return bad(res, 'Invalid request', unknown);
  const { scenario: rawScenario, policyIds: rawPolicyIds, replicates: rawReplicates } = req.body || {};
  const { valid, errors, scenario } = validateScenario(rawScenario || DEFAULT_SCENARIO);
  if (!valid) return bad(res, 'Invalid scenario', errors);
  const pols = parsePolicyIds(rawPolicyIds);
  if (pols.errors) return bad(res, 'Invalid policyIds', pols.errors);
  const reps = parseReplicates(rawReplicates, { defaultValue: 30 });
  if (reps.error) return bad(res, reps.error, [reps.error]);

  const experimentGroupId = newExperimentGroupId();
  const scenarioHash = hashScenario(scenario);
  const startedAt = new Date().toISOString();
  const prov = provenance();
  const status = queue.submit(experimentGroupId, {
    policyIds: pols.value, scenario, seeds: seedList(scenario.randomSeed, reps.value),
  }, (byPolicy) => {
    const groupSummary = {
      policies: {},
      pairedComparisons: pairedPolicyComparison(byPolicy),
      commonRandomNumbers: true,
    };
    const payloads = pols.value.map((pid) => experimentPayload({
      id: newExperimentId(), scenario, scenarioHash, policyId: pid, results: byPolicy[pid], startedAt, prov,
      extra: { experimentGroupId },
    }));
    for (const p of payloads) groupSummary.policies[p.policyId] = p.summary;
    const experimentIds = payloads.map((p) => saveExperiment({ ...p, groupSummary }).id);
    return { experimentGroupId, experimentIds, groupSummary };
  }, { kind: 'run-group', experimentGroupId, policyIds: pols.value, scenarioHash });
  res.status(202).json({
    jobId: experimentGroupId,
    ...status,
    experimentGroupId,
    policyIds: pols.value,
    scenarioHash,
    message: 'Experiment group queued (common random numbers across policies).',
  });
});

router.get('/experiment-groups/:groupId', (req, res) => {
  const list = listExperiments().filter((e) => e.experimentGroupId === req.params.groupId);
  res.json({ experimentGroupId: req.params.groupId, experiments: list });
});

router.get('/experiment-groups/:groupId/analysis', (req, res) => {
  const ids = listExperiments().filter((e) => e.experimentGroupId === req.params.groupId).map((e) => e.id);
  const full = ids.map((id) => getExperiment(id)).filter(Boolean);
  const first = full[0];
  res.json({
    experimentGroupId: req.params.groupId,
    scenarioHash: first?.scenarioHash,
    groupSummary: first?.groupSummary,
    experiments: full.map((e) => ({
      id: e.id,
      policyId: e.policyId,
      summary: e.summary,
      regionalAggregate: e.regionalAggregate,
      dailyAggregate: e.dailyAggregate,
    })),
  });
});

router.get('/experiments/:id/report.md', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'text/markdown');
  res.send(experimentSummaryMarkdown(exp));
});

module.exports = router;
module.exports.queue = queue;
