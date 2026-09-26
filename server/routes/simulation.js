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
const { listPolicies, getPolicy, resolvePolicyId } = require('../simulation/policyEngine');
const { getGitCommitHash, getPackageLockHash } = require('../simulation/gitInfo');
const { runSimulation, runReplicates, ENGINE_VERSION } = require('../simulation/simulationEngine');
const {
  aggregateReplicates,
  aggregateDailyTimeSeries,
  aggregateRegionalReplicates,
  pairedPolicyComparison,
} = require('../simulation/metricsEngine');
const {
  saveExperiment,
  listExperiments,
  getExperiment,
  newExperimentId,
  newExperimentGroupId,
} = require('../simulation/experimentRepository');
const { metricsToCsv, experimentSummaryMarkdown, pickExportMetrics } = require('../simulation/exportService');

const router = express.Router();
const activeJobs = new Map();

router.get('/meta', (_req, res) => {
  res.json({
    platform: 'Community Pharmacy Access and Supply Resilience Simulator',
    platformZh: '社区药房药品可及性与供应韧性仿真平台',
    dataClassification: 'synthetic-simulation-only',
    engineVersion: ENGINE_VERSION,
    gitCommitHash: getGitCommitHash(),
    disclaimer: 'Synthetic simulation research platform. No real patient, prescription, pharmacy transaction, or clinical outcome data.',
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
  const scenario = buildPreset(req.params.key);
  if (!scenario) return res.status(404).json({ message: 'Unknown preset' });
  res.json({ scenario });
});

router.post('/scenario/validate', (req, res) => {
  const result = validateScenario(req.body);
  res.status(200).json(result);
});

router.get('/policies', (_req, res) => {
  res.json({ policies: listPolicies() });
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
  const { scenario: rawScenario, policyId, replicates = 1 } = req.body || {};
  const { valid, errors, scenario } = validateScenario(rawScenario || DEFAULT_SCENARIO);
  if (!valid) {
    return res.status(400).json({
      message: 'Invalid scenario configuration',
      errors,
      scenario,
    });
  }
  if (!policyId) {
    return res.status(400).json({ message: 'Missing policyId', errors: ['policyId is required'] });
  }
  const canonicalPolicyId = resolvePolicyId(policyId);
  if (!canonicalPolicyId) {
    return res.status(400).json({ message: 'Unknown policyId', errors: [`Unknown policy: ${policyId}`] });
  }

  const jobId = newExperimentId();
  const gitCommitHash = getGitCommitHash();
  const packageLockHash = getPackageLockHash();
  const startedAt = new Date().toISOString();
  activeJobs.set(jobId, { cancel: false, status: 'running' });

  res.json({
    jobId,
    status: 'accepted',
    message: 'Simulation started. Poll GET /api/simulation/jobs/:jobId',
  });

  setImmediate(() => {
    try {
      const shouldCancel = () => activeJobs.get(jobId)?.cancel;
      const onProgress = (p) => {
        const j = activeJobs.get(jobId);
        if (j) activeJobs.set(jobId, { ...j, progress: p });
      };

      let payload;
      if (replicates > 1) {
        const rep = runReplicates({
          scenario,
          policyId: canonicalPolicyId,
          replicates: Math.min(replicates, 100),
          onProgress,
          shouldCancel,
        });
        if (rep.cancelled) {
          activeJobs.set(jobId, { status: 'cancelled', progress: activeJobs.get(jobId)?.progress });
          return;
        }
        const metricsList = rep.results.map((r) => r.metrics);
        const seeds = rep.results.map((r) => r.seed);
        payload = {
          id: jobId,
          scenarioId: scenario.id,
          scenarioHash: hashScenario(scenario),
          scenarioVersion: scenario.schemaVersion,
          scenario,
          policyId: canonicalPolicyId,
          policyVersion: getPolicy(canonicalPolicyId).version,
          policyParams: getPolicy(canonicalPolicyId).params,
          randomSeed: scenario.randomSeed,
          replicateSeeds: seeds,
          replicates: rep.results.length,
          engineVersion: ENGINE_VERSION,
          gitCommitHash,
          packageLockHash,
          nodeVersion: process.version,
          startedAt,
          finishedAt: new Date().toISOString(),
          results: rep.results,
          summary: aggregateReplicates(metricsList),
          regionalAggregate: aggregateRegionalReplicates(rep.results),
          dailyAggregate: aggregateDailyTimeSeries(rep.results),
        };
      } else {
        const single = runSimulation({ scenario, policyId: canonicalPolicyId, onProgress, shouldCancel });
        if (single.cancelled) {
          activeJobs.set(jobId, { status: 'cancelled', progress: activeJobs.get(jobId)?.progress });
          return;
        }
        payload = {
          id: jobId,
          scenarioId: scenario.id,
          scenarioHash: hashScenario(scenario),
          scenarioVersion: scenario.schemaVersion,
          scenario,
          policyId: canonicalPolicyId,
          policyVersion: getPolicy(canonicalPolicyId).version,
          policyParams: getPolicy(canonicalPolicyId).params,
          randomSeed: scenario.randomSeed,
          replicateSeeds: [scenario.randomSeed],
          replicates: 1,
          engineVersion: ENGINE_VERSION,
          gitCommitHash,
          packageLockHash,
          nodeVersion: process.version,
          startedAt,
          finishedAt: new Date().toISOString(),
          metrics: single.metrics,
          runLog: single.runLog,
          summary: single.metrics,
        };
      }
      saveExperiment(payload);
      activeJobs.set(jobId, { status: 'completed', experimentId: jobId, progress: { pct: 100 } });
    } catch (e) {
      activeJobs.set(jobId, { status: 'failed', error: e.message });
    }
  });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(job);
});

router.post('/jobs/:jobId/cancel', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  activeJobs.set(req.params.jobId, { ...job, cancel: true });
  res.json({ status: 'cancelling' });
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
  const { scenario, policyId, replicates = 1 } = source;
  if (!scenario || !policyId) {
    return res.status(400).json({ message: 'Stored experiment missing scenario or policyId' });
  }
  const canonicalPolicyId = resolvePolicyId(policyId);
  if (!canonicalPolicyId) {
    return res.status(400).json({ message: 'Unknown stored policyId', policyId });
  }
  const jobId = newExperimentId();
  const startedAt = new Date().toISOString();
  const gitCommitHash = getGitCommitHash();
  const packageLockHash = getPackageLockHash();
  const scenarioHash = hashScenario(scenario);
  activeJobs.set(jobId, { cancel: false, status: 'running' });
  const engineMismatch = source.engineVersion && source.engineVersion !== ENGINE_VERSION;
  res.json({
    jobId,
    status: 'accepted',
    sourceExperimentId: source.id,
    engineVersion: ENGINE_VERSION,
    sourceEngineVersion: source.engineVersion,
    reproductionNote: engineMismatch
      ? 'Configuration re-run, not bitwise reproduction because engine version differs.'
      : 'Exact re-run with frozen scenario and replicate seeds.',
  });

  setImmediate(() => {
    try {
      const repCount = Math.max(1, replicates);
      let payload;
      if (repCount > 1) {
        const n = source.results?.length || repCount;
        const seeds = source.replicateSeeds?.length === n
          ? source.replicateSeeds
          : Array.from({ length: n }, (_, i) => source.randomSeed + i);
        const results = [];
        for (let i = 0; i < n; i += 1) {
          const seed = seeds[i];
          const scen = { ...scenario, randomSeed: seed };
          const r = runSimulation({ scenario: scen, policyId: canonicalPolicyId });
          results.push({ replicateIndex: i, seed, metrics: r.metrics, runLog: r.runLog });
        }
        payload = {
          scenarioId: source.scenarioId,
          scenarioHash,
          scenarioVersion: source.scenarioVersion || scenario.schemaVersion,
          scenario,
          policyId: canonicalPolicyId,
          policyVersion: getPolicy(canonicalPolicyId).version,
          policyParams: getPolicy(canonicalPolicyId).params,
          randomSeed: source.randomSeed,
          replicateSeeds: seeds,
          replicates: n,
          engineVersion: ENGINE_VERSION,
          nodeVersion: process.version,
          dataClassification: 'synthetic-simulation',
          id: jobId,
          rerunOf: source.id,
          startedAt,
          finishedAt: new Date().toISOString(),
          gitCommitHash,
          packageLockHash,
          results,
          summary: aggregateReplicates(results.map((x) => x.metrics)),
          regionalAggregate: aggregateRegionalReplicates(results),
          dailyAggregate: aggregateDailyTimeSeries(results),
        };
      } else {
        const seed = source.replicateSeeds?.[0] ?? source.randomSeed;
        const scen = { ...scenario, randomSeed: seed };
        const single = runSimulation({ scenario: scen, policyId: canonicalPolicyId });
        payload = {
          scenarioId: source.scenarioId,
          scenarioHash,
          scenarioVersion: source.scenarioVersion || scenario.schemaVersion,
          scenario,
          policyId: canonicalPolicyId,
          policyVersion: getPolicy(canonicalPolicyId).version,
          policyParams: getPolicy(canonicalPolicyId).params,
          randomSeed: seed,
          replicateSeeds: [seed],
          replicates: 1,
          engineVersion: ENGINE_VERSION,
          nodeVersion: process.version,
          dataClassification: 'synthetic-simulation',
          id: jobId,
          rerunOf: source.id,
          startedAt,
          finishedAt: new Date().toISOString(),
          gitCommitHash,
          packageLockHash,
          metrics: single.metrics,
          runLog: single.runLog,
          summary: single.metrics,
        };
      }
      saveExperiment(payload);
      activeJobs.set(jobId, { status: 'completed', experimentId: jobId, progress: { pct: 100 } });
    } catch (e) {
      activeJobs.set(jobId, { status: 'failed', error: e.message });
    }
  });
});

router.post('/run-group', (req, res) => {
  const { scenario: rawScenario, policyIds = [], replicates = 30 } = req.body || {};
  const { valid, errors, scenario } = validateScenario(rawScenario || DEFAULT_SCENARIO);
  if (!valid) return res.status(400).json({ message: 'Invalid scenario', errors });
  if (!policyIds.length) return res.status(400).json({ message: 'policyIds required' });

  const experimentGroupId = newExperimentGroupId();
  const frozenScenario = JSON.parse(JSON.stringify(scenario));
  const scenarioHash = hashScenario(frozenScenario);
  const gitCommitHash = getGitCommitHash();
  const packageLockHash = getPackageLockHash();
  const startedAt = new Date().toISOString();
  const jobId = newExperimentGroupId();
  activeJobs.set(jobId, { status: 'running', experimentGroupId });

  res.json({
    jobId,
    experimentGroupId,
    status: 'accepted',
    policyIds,
    scenarioHash,
    message: 'Experiment group started (common random numbers across policies).',
  });

  setImmediate(() => {
    try {
      const experimentIds = [];
      const groupSummary = { policies: {}, pairedComparisons: null };
      const resultsByPolicy = {};

      const pendingPayloads = [];
      for (const pid of policyIds) {
        const canonical = resolvePolicyId(pid);
        if (!canonical) continue;
        const rep = runReplicates({
          scenario: frozenScenario,
          policyId: canonical,
          replicates: Math.min(replicates, 100),
        });
        const expId = newExperimentId();
        const payload = {
          id: expId,
          experimentGroupId,
          scenarioId: frozenScenario.id,
          scenarioHash,
          scenarioVersion: frozenScenario.schemaVersion,
          scenario: frozenScenario,
          policyId: canonical,
          policyVersion: getPolicy(canonical).version,
          randomSeed: frozenScenario.randomSeed,
          replicateSeeds: rep.results.map((r) => r.seed),
          replicates: rep.results.length,
          engineVersion: ENGINE_VERSION,
          gitCommitHash,
          packageLockHash,
          nodeVersion: process.version,
          startedAt,
          finishedAt: new Date().toISOString(),
          results: rep.results,
          summary: aggregateReplicates(rep.results.map((r) => r.metrics)),
          regionalAggregate: aggregateRegionalReplicates(rep.results),
          dailyAggregate: aggregateDailyTimeSeries(rep.results),
        };
        pendingPayloads.push(payload);
        experimentIds.push(expId);
        groupSummary.policies[canonical] = payload.summary;
        resultsByPolicy[canonical] = rep.results;
      }
      groupSummary.pairedComparisons = pairedPolicyComparison(resultsByPolicy);
      for (const payload of pendingPayloads) {
        saveExperiment({ ...payload, groupSummary });
      }
      activeJobs.set(jobId, {
        status: 'completed',
        experimentGroupId,
        experimentIds,
        groupSummary,
      });
    } catch (e) {
      activeJobs.set(jobId, { status: 'failed', error: e.message });
    }
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
