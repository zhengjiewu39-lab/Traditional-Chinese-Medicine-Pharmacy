#!/usr/bin/env node
/**
 * Reproducibility check on the default synthetic scenario.
 *
 *   REPLICATES=10 npm run research:reproduce
 *     runs the five policies with common random numbers, saves one experiment per policy (one group),
 *     then re-runs every replicate and requires every metric to match exactly (canonical JSON).
 *   npm run research:reproduce -- --latest
 *     re-runs every replicate of the most recent stored experiment and requires an exact match of all
 *     metrics; fails if the engine version differs (that would be a configuration re-run, not a reproduction).
 * Exit code 0 only if every comparison matches.
 */
const { DEFAULT_SCENARIO, validateScenario } = require('../server/simulation/scenarioSchema');
const { runSimulation, ENGINE_VERSION } = require('../server/simulation/simulationEngine');
const { listPolicies } = require('../server/simulation/policyEngine');
const { aggregateReplicates, pairedPolicyComparison } = require('../server/simulation/metricsEngine');
const {
  saveExperiment, listExperiments, getExperiment, newExperimentId, newExperimentGroupId,
} = require('../server/simulation/experimentRepository');
const { getGitCommitHash, getCommitSource, getPackageLockHash } = require('../server/simulation/gitInfo');
const { hashScenario, canonicalJson } = require('../server/simulation/scenarioHash');
const { MAX_REPLICATES } = require('../server/simulation/requestValidation');

function runOne(scenario, policyId, seed) {
  return runSimulation({ scenario: { ...scenario, randomSeed: seed }, policyId, logLevel: 'summary' });
}

function compareAll(scenario, policyId, stored) {
  let mismatches = 0;
  for (const row of stored) {
    const again = runOne(scenario, policyId, row.seed).metrics;
    if (canonicalJson(again) !== canonicalJson(row.metrics)) {
      mismatches += 1;
      const diff = Object.keys(row.metrics).filter((k) => canonicalJson(again[k] ?? null) !== canonicalJson(row.metrics[k] ?? null));
      console.error(`  mismatch ${policyId} seed ${row.seed}: ${diff.join(', ')}`);
    }
  }
  return mismatches;
}

if (process.argv.includes('--latest')) {
  const list = listExperiments();
  if (!list.length) {
    console.error('No experiments to reproduce');
    process.exit(1);
  }
  const src = getExperiment(list[0].id);
  if (src.engineVersion !== ENGINE_VERSION) {
    console.error(`Latest experiment ${src.id} was produced by ${src.engineVersion}; current engine is ${ENGINE_VERSION}. Not an exact reproduction.`);
    process.exit(1);
  }
  const { valid, errors, scenario } = validateScenario(src.scenario);
  if (!valid) {
    console.error('Stored scenario no longer validates:', errors);
    process.exit(1);
  }
  if (hashScenario(scenario) !== src.scenarioHash) {
    console.error(`Scenario hash mismatch: stored ${src.scenarioHash}, recomputed ${hashScenario(scenario)}`);
    process.exit(1);
  }
  const rows = src.results?.length ? src.results : [{ seed: src.randomSeed, metrics: src.metrics }];
  const bad = compareAll(scenario, src.policyId, rows);
  console.log(`Re-ran ${rows.length} replicate(s) of ${src.id} (${src.policyId}): ${bad ? `${bad} MISMATCH` : 'all metrics identical'}`);
  process.exit(bad ? 1 : 0);
}

const replicates = Number(process.env.REPLICATES || 30);
if (!Number.isInteger(replicates) || replicates < 1 || replicates > MAX_REPLICATES) {
  console.error(`REPLICATES must be an integer in [1, ${MAX_REPLICATES}]`);
  process.exit(1);
}
const { scenario } = validateScenario(DEFAULT_SCENARIO);
const scenarioHash = hashScenario(scenario);
const seeds = Array.from({ length: replicates }, (_, i) => scenario.randomSeed + i);
const policyIds = listPolicies().map((p) => p.id);
const startedAt = new Date().toISOString();
const experimentGroupId = newExperimentGroupId();
const prov = {
  engineVersion: ENGINE_VERSION,
  gitCommitHash: getGitCommitHash(),
  gitCommitSource: getCommitSource(),
  packageLockHash: getPackageLockHash(),
  nodeVersion: process.version,
};

const byPolicy = {};
for (const policyId of policyIds) {
  byPolicy[policyId] = seeds.map((seed, i) => {
    const r = runOne(scenario, policyId, seed);
    if (!r.runLog.inventoryAudit.passed) throw new Error(`inventory audit failed: ${policyId} seed ${seed}`);
    return { replicateIndex: i, seed, metrics: r.metrics };
  });
}
const comparison = pairedPolicyComparison(byPolicy);
let mismatches = 0;
for (const policyId of policyIds) {
  const id = newExperimentId();
  saveExperiment({
    id,
    experimentGroupId,
    scenarioId: scenario.id,
    scenarioHash,
    scenarioVersion: scenario.schemaVersion,
    scenario,
    policyId,
    randomSeed: scenario.randomSeed,
    replicateSeeds: seeds,
    replicates,
    ...prov,
    startedAt,
    finishedAt: new Date().toISOString(),
    results: byPolicy[policyId],
    summary: aggregateReplicates(byPolicy[policyId].map((r) => r.metrics)),
    groupSummary: { pairedComparisons: comparison, commonRandomNumbers: true },
  });
  mismatches += compareAll(scenario, policyId, byPolicy[policyId]);
  const s = aggregateReplicates(byPolicy[policyId].map((r) => r.metrics));
  const f = (k, d = 4) => `${s[k].mean.toFixed(d)} ± ${s[k].std.toFixed(d)}`;
  console.log(`${policyId.padEnd(36)} worst-region essential fill ${f('worstRegionEssentialFillRate')}  unmet ${f('cumulativeUnmetDemand', 0)}  cost ${f('totalCost', 0)}  PoE ${(comparison.priceOfEquity[policyId] * 100).toFixed(2)}%`);
}
console.log(`\nGroup ${experimentGroupId}, scenario ${scenarioHash.slice(0, 12)}…, ${replicates} replicates, engine ${ENGINE_VERSION}`);
console.log(mismatches ? `REPRODUCTION FAILED: ${mismatches} mismatching replicate(s)` : 'Reproduction check: every metric of every replicate identical on re-run');
process.exit(mismatches ? 1 : 0);
