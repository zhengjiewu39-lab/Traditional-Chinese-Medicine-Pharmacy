#!/usr/bin/env node
/**
 * Reproduce default scenario with 30 replicates (equity-aware) or re-run latest stored experiment bytes.
 */
const { DEFAULT_SCENARIO } = require('../server/simulation/scenarioSchema');
const { runReplicates } = require('../server/simulation/simulationEngine');
const { aggregateReplicates } = require('../server/simulation/metricsEngine');
const { saveExperiment, listExperiments, getExperiment, newExperimentId } = require('../server/simulation/experimentRepository');
const { getGitCommitHash } = require('../server/simulation/gitInfo');

const arg = process.argv[2];
const startedAt = new Date().toISOString();

if (arg === '--latest') {
  const list = listExperiments();
  if (!list.length) {
    console.error('No experiments to reproduce');
    process.exit(1);
  }
  const src = getExperiment(list[0].id);
  const policyId = src.policyId;
  const scenario = src.scenario;
  const replicates = src.replicates || 1;
  if (replicates > 1 && src.results?.length) {
    const { runSimulation } = require('../server/simulation/simulationEngine');
    const results = src.results.map((row, i) => {
      const seed = src.replicateSeeds?.[i] ?? src.randomSeed + i;
      const r = runSimulation({ scenario: { ...scenario, randomSeed: seed }, policyId });
      return { replicateIndex: i, seed, metrics: r.metrics };
    });
    const m1 = results[0].metrics.stockoutRate;
    const m2 = src.results[0].metrics.stockoutRate;
    console.log('Re-run stockout match:', m1 === m2, m1, m2);
    process.exit(m1 === m2 ? 0 : 1);
  }
  process.exit(0);
}

const replicates = Number(process.env.REPLICATES || 30);
const scenario = { ...DEFAULT_SCENARIO, randomSeed: DEFAULT_SCENARIO.randomSeed };
const policyId = 'equity-aware';
const rep = runReplicates({ scenario, policyId, replicates });
const id = newExperimentId();
const payload = {
  id,
  scenarioId: scenario.id,
  scenarioVersion: scenario.schemaVersion,
  scenario,
  policyId,
  randomSeed: scenario.randomSeed,
  replicateSeeds: rep.results.map((r) => r.seed),
  replicates: rep.results.length,
  engineVersion: rep.results[0]?.runLog?.engineVersion,
  gitCommitHash: getGitCommitHash(),
  startedAt,
  finishedAt: new Date().toISOString(),
  results: rep.results,
  summary: aggregateReplicates(rep.results.map((r) => r.metrics)),
};
saveExperiment(payload);
console.log('Saved experiment', id, 'replicates', replicates);
console.log('Stockout mean', payload.summary.stockoutRate.mean);
