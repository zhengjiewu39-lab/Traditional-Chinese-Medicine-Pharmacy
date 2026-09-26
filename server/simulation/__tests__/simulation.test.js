const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createRng } = require('../rng');
const { validateScenario, DEFAULT_SCENARIO } = require('../scenarioSchema');
const { listPolicies } = require('../policyEngine');
const { runSimulation } = require('../simulationEngine');
const { computeRunMetrics } = require('../metricsEngine');

describe('rng', () => {
  it('same seed produces same sequence', () => {
    const a = createRng(99);
    const b = createRng(99);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    assert.deepStrictEqual(seqA, seqB);
  });
});

describe('policies', () => {
  it('includes four baseline strategies', () => {
    const p = listPolicies();
    assert.strictEqual(p.length, 4);
    assert.ok(p.some((x) => x.id === 'equity-aware-v1'));
  });

  for (const policyId of [
    'fixed-allocation-v1',
    'reorder-point-v1',
    'cost-first-v1',
    'equity-aware-v1',
  ]) {
    it(`${policyId} completes a short synthetic run`, () => {
      const scenario = { ...DEFAULT_SCENARIO, simulationDays: 7, pharmacyCount: 6, randomSeed: 1 };
      const r = runSimulation({ scenario, policyId });
      assert.strictEqual(r.cancelled, false);
      assert.ok(r.metrics.fillRate <= 1);
    });
  }
});

describe('simulation determinism', () => {
  it('identical scenario and seed yield identical stockout rate', () => {
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 14, pharmacyCount: 6, randomSeed: 42 };
    const r1 = runSimulation({ scenario, policyId: 'reorder-point-v1' });
    const r2 = runSimulation({ scenario, policyId: 'reorder-point-v1' });
    assert.strictEqual(r1.metrics.stockoutRate, r2.metrics.stockoutRate);
    assert.strictEqual(r1.metrics.totalCost, r2.metrics.totalCost);
  });
});

describe('metricsEngine', () => {
  it('computes regional gaps on toy log', () => {
    const runLog = {
      totalCost: 100,
      daily: [{
        totalInventory: 500,
        pharmacyResults: [
          { regionType: 'urban', demand: 100, filled: 90, stockout: 10, waitDays: 0.1, stockoutByDrug: [] },
          { regionType: 'rural', demand: 50, filled: 30, stockout: 20, waitDays: 1.5, stockoutByDrug: [{ priority: 'essential', units: 20 }] },
        ],
        shipments: [{ transitDays: 2, qty: 10 }],
      }],
    };
    const instance = { scenario: DEFAULT_SCENARIO };
    const m = computeRunMetrics(runLog, instance, 'fixed-allocation-v1');
    assert.ok(m.stockoutRate > 0);
    assert.ok(m.equity.stockoutGap >= 0);
    assert.ok(m.penalties.compositeScore > m.totalCost);
  });
});

describe('scenarioSchema', () => {
  it('clamps out-of-range simulationDays', () => {
    const r = validateScenario({ ...DEFAULT_SCENARIO, simulationDays: 9999 });
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.scenario.simulationDays, 365);
    assert.ok(r.warnings?.length);
  });
});
