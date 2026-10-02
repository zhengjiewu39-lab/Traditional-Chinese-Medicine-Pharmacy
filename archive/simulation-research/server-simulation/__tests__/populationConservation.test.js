const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SCENARIO, REGION_TYPES } = require('../scenarioSchema');
const { generateScenarioInstance } = require('../scenarioGenerator');
const { runSimulation } = require('../simulationEngine');

describe('population conservation and seeds', () => {
  it('sums pharmacy populations to each region total exactly', () => {
    const inst = generateScenarioInstance({ ...DEFAULT_SCENARIO, randomSeed: 1001, networkSeed: 555 });
    const sums = {};
    for (const ph of inst.pharmacies) {
      sums[ph.regionType] = (sums[ph.regionType] || 0) + ph.population;
    }
    for (const rt of REGION_TYPES) {
      assert.equal(sums[rt], DEFAULT_SCENARIO.regions[rt].population);
    }
  });

  it('fixes the network under networkSeed while randomSeed changes demand draws only', () => {
    const a = generateScenarioInstance({ ...DEFAULT_SCENARIO, randomSeed: 1, networkSeed: 9001, simulationDays: 5 });
    const b = generateScenarioInstance({ ...DEFAULT_SCENARIO, randomSeed: 2, networkSeed: 9001, simulationDays: 5 });
    assert.deepEqual(
      a.pharmacies.map((p) => [p.id, p.regionType, p.population, p.warehouseId]),
      b.pharmacies.map((p) => [p.id, p.regionType, p.population, p.warehouseId]),
    );
    const demandA = a.dailyPlans[0].pharmacyDemand.map((d) => d.drugDemand);
    const demandB = b.dailyPlans[0].pharmacyDemand.map((d) => d.drugDemand);
    assert.notDeepEqual(demandA, demandB);
  });

  it('yields identical realized demand plans for the same randomSeed (policy-independent)', () => {
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 14, randomSeed: 4242, networkSeed: 7777 };
    const demandTotal = (inst) => inst.dailyPlans.reduce(
      (s, day) => s + day.pharmacyDemand.reduce(
        (t, row) => t + Object.values(row.drugDemand).reduce((a, b) => a + b, 0),
        0,
      ),
      0,
    );
    const a = generateScenarioInstance(scenario);
    const b = generateScenarioInstance(scenario);
    assert.equal(demandTotal(a), demandTotal(b));
    runSimulation({ scenario, policyId: 'cost-first', logLevel: 'summary' });
    runSimulation({ scenario, policyId: 'equity-constrained-rolling-horizon', logLevel: 'summary' });
  });
});
