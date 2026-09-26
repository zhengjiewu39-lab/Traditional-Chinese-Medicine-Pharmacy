const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isEventActive, getEventEndDay, computeEventFactors } = require('../eventUtils');
const { computeServiceInequalityIndex } = require('../metricsEngine');
const { runSimulation } = require('../simulationEngine');
const { DEFAULT_SCENARIO, validateScenario } = require('../scenarioSchema');

describe('event boundaries', () => {
  const ev = { type: 'demandSurge', startDay: 10, durationDays: 5, magnitude: 2, targetRegions: ['urban'] };
  it('inactive before startDay', () => {
    assert.strictEqual(isEventActive(ev, 9), false);
  });
  it('active on startDay', () => {
    assert.strictEqual(isEventActive(ev, 10), true);
  });
  it('inactive on end day (exclusive)', () => {
    assert.strictEqual(getEventEndDay(ev), 15);
    assert.strictEqual(isEventActive(ev, 14), true);
    assert.strictEqual(isEventActive(ev, 15), false);
  });
});

describe('supplyDisruption effect', () => {
  it('changes shipped replenishment vs no disruption', () => {
    const base = {
      ...DEFAULT_SCENARIO,
      simulationDays: 20,
      pharmacyCount: 6,
      randomSeed: 77,
      events: [],
    };
    const disrupted = {
      ...base,
      events: [{
        type: 'supplyDisruption',
        startDay: 5,
        durationDays: 10,
        magnitude: 0.2,
        targetRegions: ['urban', 'suburban', 'rural'],
      }],
    };
    const r0 = runSimulation({ scenario: base, policyId: 'reorder-point' });
    const r1 = runSimulation({ scenario: disrupted, policyId: 'reorder-point' });
    const ship0 = r0.runLog.daily.reduce((s, d) => s + (d.shipments?.reduce((a, x) => a + x.qty, 0) ?? 0), 0);
    const ship1 = r1.runLog.daily.reduce((s, d) => s + (d.shipments?.reduce((a, x) => a + x.qty, 0) ?? 0), 0);
    assert.notStrictEqual(ship0, ship1);
    assert.ok(r1.runLog.daily.some((d) => d.supplyLog?.length > 0));
  });
});

describe('service inequality index', () => {
  it('is low when regional fill rates equal', () => {
    const idx = computeServiceInequalityIndex({
      stockoutGap: 0,
      waitGap: 0,
      giniCoverage: 0,
      maxRelevantWaitDays: 30,
    });
    assert.strictEqual(idx, 0);
  });
  it('increases when one region has lower fill rate (via stockout gap)', () => {
    const low = computeServiceInequalityIndex({ stockoutGap: 0, waitGap: 0, giniCoverage: 0 });
    const high = computeServiceInequalityIndex({ stockoutGap: 0.4, waitGap: 0, giniCoverage: 0.2 });
    assert.ok(high > low);
    assert.ok(high <= 1 && high >= 0);
  });
});

describe('policy behavior', () => {
  it('fixed-allocation only orders on review days', () => {
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 6, pharmacyCount: 4, randomSeed: 1 };
    const r = runSimulation({ scenario, policyId: 'fixed-allocation' });
    const decisionDays = r.runLog.daily.filter((d) => d.policyDecisions?.some((x) => x.requestQty > 0)).map((d) => d.day);
    assert.ok(decisionDays.every((d) => d % 3 === 0));
  });

  it('cost-first produces scored decisions', () => {
    const scenario = { ...DEFAULT_SCENARIO, simulationDays: 8, pharmacyCount: 6, randomSeed: 2 };
    const r = runSimulation({ scenario, policyId: 'cost-first' });
    const scored = r.runLog.daily.flatMap((d) => d.policyDecisions || []).filter((x) => x.score != null);
    assert.ok(scored.length > 0);
  });
});

describe('validateScenario structured', () => {
  it('rejects negative population', () => {
    const r = validateScenario({
      ...DEFAULT_SCENARIO,
      regions: { ...DEFAULT_SCENARIO.regions, urban: { ...DEFAULT_SCENARIO.regions.urban, population: -1 } },
    });
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some((e) => e.path || e.code || typeof e === 'object'));
  });
});
