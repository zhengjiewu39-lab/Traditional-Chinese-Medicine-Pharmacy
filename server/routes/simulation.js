const express = require('express');
const {
  DEFAULT_SCENARIO,
  validateScenario,
  FIELD_HELP,
  LIMITS,
} = require('../simulation/scenarioSchema');
const { listPolicies, getPolicy } = require('../simulation/policyEngine');
const { runSimulation, runReplicates, ENGINE_VERSION } = require('../simulation/simulationEngine');
const { aggregateReplicates } = require('../simulation/metricsEngine');
const {
  saveExperiment,
  listExperiments,
  getExperiment,
  newExperimentId,
} = require('../simulation/experimentRepository');
const { metricsToCsv, experimentSummaryMarkdown } = require('../simulation/exportService');

const router = express.Router();
const activeJobs = new Map();

router.get('/meta', (_req, res) => {
  res.json({
    platform: 'Community pharmacy supply resilience simulation',
    dataClassification: 'synthetic-simulation-only',
    engineVersion: ENGINE_VERSION,
    disclaimer: 'Simulation research only. No real patient or pharmacy transaction data.',
  });
});

router.get('/scenario/default', (_req, res) => {
  res.json({ scenario: DEFAULT_SCENARIO, help: FIELD_HELP, limits: LIMITS });
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
  if (!getPolicy(policyId)) {
    return res.status(400).json({ message: 'Unknown policyId', errors: [`Unknown policy: ${policyId}`] });
  }

  const jobId = newExperimentId();
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
          policyId,
          replicates: Math.min(replicates, 100),
          onProgress,
          shouldCancel,
        });
        if (rep.cancelled) {
          activeJobs.set(jobId, { status: 'cancelled', progress: activeJobs.get(jobId)?.progress });
          return;
        }
        const metricsList = rep.results.map((r) => r.metrics);
        payload = {
          id: jobId,
          scenarioId: scenario.id,
          scenario,
          policyId,
          policyVersion: getPolicy(policyId).version,
          randomSeed: scenario.randomSeed,
          replicates: rep.results.length,
          engineVersion: ENGINE_VERSION,
          nodeVersion: process.version,
          startedAt,
          finishedAt: new Date().toISOString(),
          results: rep.results,
          summary: aggregateReplicates(metricsList),
        };
      } else {
        const single = runSimulation({ scenario, policyId, onProgress, shouldCancel });
        if (single.cancelled) {
          activeJobs.set(jobId, { status: 'cancelled', progress: activeJobs.get(jobId)?.progress });
          return;
        }
        payload = {
          id: jobId,
          scenarioId: scenario.id,
          scenario,
          policyId,
          policyVersion: getPolicy(policyId).version,
          randomSeed: scenario.randomSeed,
          replicates: 1,
          engineVersion: ENGINE_VERSION,
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
  const m = exp.metrics || exp.summary;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${exp.id}.csv"`);
  res.send(metricsToCsv(m));
});

router.get('/experiments/:id/export.json', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${exp.id}.json"`);
  res.send(JSON.stringify(exp, null, 2));
});

router.get('/experiments/:id/report.md', (req, res) => {
  const exp = getExperiment(req.params.id);
  if (!exp) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'text/markdown');
  res.send(experimentSummaryMarkdown(exp));
});

module.exports = router;
