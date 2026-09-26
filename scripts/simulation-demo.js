#!/usr/bin/env node
/**
 * Quick synthetic demo: default public-health scenario × four policies (7-day, 1 replicate each).
 */
const { DEFAULT_SCENARIO } = require('../server/simulation/scenarioSchema');
const { runSimulation } = require('../server/simulation/simulationEngine');
const { listPolicies } = require('../server/simulation/policyEngine');

const scenario = { ...DEFAULT_SCENARIO, simulationDays: 14, pharmacyCount: 12, randomSeed: DEFAULT_SCENARIO.randomSeed };

console.log('Community Pharmacy Access and Supply Resilience Simulator — synthetic demo\n');
for (const p of listPolicies()) {
  const r = runSimulation({ scenario, policyId: p.id });
  const m = r.metrics;
  console.log(
    `${p.id}: cost=${m.totalCost.toFixed(0)} stockout=${(m.stockoutRate * 100).toFixed(2)}% `
    + `essential=${(m.essentialStockoutRate * 100).toFixed(2)}% inequality=${m.serviceInequalityIndex.toFixed(4)}`,
  );
}
