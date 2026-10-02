/**
 * Bridge from operations proposals to the supply-resilience digital twin.
 * ERRRA and the simulation engine are called unchanged; the bridge only builds a scenario variant
 * that represents the proposal and compares it with the baseline under common random numbers.
 * All results are synthetic-scenario outputs, not forecasts of the real pharmacy.
 */
const { runSimulation } = require('../simulation/simulationEngine');
const { DEFAULT_SCENARIO } = require('../simulation/scenarioSchema');
const { hashScenario } = require('../simulation/scenarioHash');

const TWIN_POLICY = 'equity-constrained-rolling-horizon';
const DEFAULT_REPLICATES = 5;
const METRICS = ['overallFillRate', 'essentialMedicineFillRate', 'worstRegionEssentialFillRate', 'p95WaitingTime', 'recoveryTime95', 'totalCost'];

/** Documented, fixed mapping from action → scenario lever (not tuned per result). */
function applyProposal(scenario, proposal) {
  const s = structuredClone(scenario);
  switch (proposal.action) {
    case 'purchase':
      s.logistics.initialStockMultiplier = (s.logistics.initialStockMultiplier ?? 1) * 1.25;
      break;
    case 'transfer':
      s.logistics.lateralTransfers = { ...s.logistics.lateralTransfers, enabled: true, capacityCoverage: Math.min(1, (s.logistics.lateralTransfers?.capacityCoverage ?? 0.25) + 0.15) };
      break;
    case 'expedite':
      s.supplyNetwork.primary.replenishmentLeadTime = Math.max(1, s.supplyNetwork.primary.replenishmentLeadTime - 1);
      s.supplyNetwork.backup.replenishmentLeadTime = Math.max(1, s.supplyNetwork.backup.replenishmentLeadTime - 2);
      break;
    case 'hold':
      break;
    default:
      throw new Error(`unknown action ${proposal.action}`);
  }
  s.id = `${scenario.id}-proposal-${proposal.action}`;
  return s;
}

function mean(xs) {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function runArm(scenario, seeds) {
  const runs = seeds.map((seed) => runSimulation({ scenario: { ...scenario, randomSeed: seed }, policyId: TWIN_POLICY, logLevel: 'none' }).metrics);
  return Object.fromEntries(METRICS.map((m) => [m, mean(runs.map((r) => r[m]))]));
}

function evaluateProposal(proposal, { replicates = DEFAULT_REPLICATES, baseScenario = DEFAULT_SCENARIO } = {}) {
  const seeds = Array.from({ length: replicates }, (_, i) => baseScenario.randomSeed + i);
  const variant = applyProposal(baseScenario, proposal);
  const baselineMetrics = runArm(baseScenario, seeds);
  const proposalMetrics = runArm(variant, seeds);
  const difference = Object.fromEntries(METRICS.map((m) => [m, baselineMetrics[m] == null || proposalMetrics[m] == null ? null : proposalMetrics[m] - baselineMetrics[m]]));
  return {
    scenarioHash: hashScenario(variant),
    baselineScenarioHash: hashScenario(baseScenario),
    policy: TWIN_POLICY,
    replicates,
    seeds,
    baselineMetrics,
    proposalMetrics,
    difference,
    label: '合成情景数字孪生评估（synthetic）；不代表真实药房的预测结果',
  };
}

module.exports = { evaluateProposal, applyProposal, TWIN_POLICY, METRICS };
