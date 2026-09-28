#!/usr/bin/env node
/**
 * Quick synthetic demo: default 120-day compound scenario × the five policies, one replicate each.
 * Synthetic data only; the numbers illustrate the mechanics and are not policy evidence.
 */
const { DEFAULT_SCENARIO } = require('../server/simulation/scenarioSchema');
const { runSimulation } = require('../server/simulation/simulationEngine');
const { listPolicies } = require('../server/simulation/policyEngine');

const scenario = { ...DEFAULT_SCENARIO };
const pct = (x) => `${(x * 100).toFixed(2)}%`;

console.log('Community Pharmacy Access and Supply Resilience Simulator — synthetic demo');
console.log(`${scenario.name}; seed ${scenario.randomSeed}\n`);
for (const p of listPolicies()) {
  const r = runSimulation({ scenario, policyId: p.id, logLevel: 'summary' });
  const m = r.metrics;
  console.log(
    `${(p.shortName || p.id).padEnd(16)} fill ${pct(m.overallFillRate)}  essential ${pct(m.essentialMedicineFillRate)}  `
    + `worst-region essential ${pct(m.worstRegionEssentialFillRate)}  gap ${m.regionalServiceGap.toFixed(3)}  `
    + `unmet ${m.cumulativeUnmetDemand}  end-unmet ${pct(m.horizonEndUnmetRate)}  p95 wait ${m.p95WaitingTime}d  `
    + `cost ${m.totalCost.toFixed(0)}  audit ${r.runLog.inventoryAudit.passed ? 'ok' : 'FAILED'}`,
  );
}
