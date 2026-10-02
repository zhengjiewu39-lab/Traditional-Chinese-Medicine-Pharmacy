const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createRng } = require('../seededRandom');
const { resolvePolicyId, getPolicy } = require('../policyEngine');
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
  it('includes four baseline strategies plus ERRRA', () => {
    const ids = listPolicies().map((x) => x.id);
    for (const id of ['fixed-allocation', 'reorder-point', 'cost-first', 'equity-aware']) assert.ok(ids.includes(id));
    assert.ok(ids.includes('equity-constrained-rolling-horizon'));
    assert.strictEqual(ids.length, 5);
  });

  it('resolves legacy -v1 policy aliases', () => {
    assert.strictEqual(resolvePolicyId('equity-aware-v1'), 'equity-aware');
    assert.ok(getPolicy('fixed-allocation-v1'));
  });

  for (const policyId of [
    'fixed-allocation',
    'reorder-point',
    'cost-first',
    'equity-aware',
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
    const r1 = runSimulation({ scenario, policyId: 'reorder-point' });
    const r2 = runSimulation({ scenario, policyId: 'reorder-point' });
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
    const instance = { scenario: DEFAULT_SCENARIO, drugs: [] };
    const m = computeRunMetrics(runLog, instance, 'fixed-allocation');
    assert.ok(m.stockoutRate > 0);
    assert.ok(m.equity.stockoutGap >= 0);
    assert.ok(m.penalties.compositeScore > m.totalCost);
    assert.ok(m.serviceInequalityIndex >= 0);
  });

  it('essential stockout rate bounded 0-1', () => {
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 5, pharmacyCount: 4, randomSeed: 3 };
    const r = runSimulation({ scenario, policyId: 'cost-first' });
    assert.ok(r.metrics.essentialStockoutRate >= 0 && r.metrics.essentialStockoutRate <= 1);
  });
});

describe('experiment reproducibility', () => {
  it('same seeds in replicates produce identical metrics', () => {
    const { runReplicates } = require('../simulationEngine');
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 10, pharmacyCount: 6, randomSeed: 100 };
    const a = runReplicates({ scenario, policyId: 'fixed-allocation', replicates: 3 });
    const b = runReplicates({ scenario, policyId: 'fixed-allocation', replicates: 3 });
    assert.strictEqual(a.results[1].metrics.stockoutRate, b.results[1].metrics.stockoutRate);
  });
});

describe('scenarioSchema', () => {
  it('rejects out-of-range simulationDays instead of clamping', () => {
    const r = validateScenario({ ...DEFAULT_SCENARIO, simulationDays: 9999 });
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some((e) => e.path === 'simulationDays' && e.code === 'out_of_range'));
  });

  it('includes schemaVersion on normalized scenario', () => {
    const r = validateScenario({});
    assert.ok(r.scenario.schemaVersion);
  });
});

describe('exportService', () => {
  it('flattens aggregate summary for CSV', () => {
    const { pickExportMetrics, metricsToCsv } = require('../exportService');
    const exp = {
      summary: {
        stockoutRate: { mean: 0.12, std: 0.01 },
        totalCost: { mean: 1000 },
      },
      results: [{ metrics: { regional: { urban: { fillRate: 0.9, stockoutRate: 0.1, avgAccessTimeDays: 0.2 } } } }],
    };
    const m = pickExportMetrics(exp);
    assert.strictEqual(m.stockoutRate, 0.12);
    const csv = metricsToCsv(m);
    assert.ok(csv.includes('stockoutRate,0.12'));
  });
});
