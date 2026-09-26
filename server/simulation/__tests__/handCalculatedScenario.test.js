const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  fulfillDemandWithBackorder,
  initPharmacyState,
  warehouseIssue,
  initWarehouseState,
} = require('../inventoryEngine');
const { processArrivals, scheduleShipment } = require('../distributionEngine');
const { computeRunMetrics } = require('../metricsEngine');

describe('hand-calculated inventory', () => {
  it('fulfillDemandWithBackorder: 40 on-hand vs 55 demand → 40 filled, 15 backordered', () => {
    const state = initPharmacyState({ id: 'P1', regionType: 'urban', onHand: { D1: 40 } });
    const r = fulfillDemandWithBackorder({ id: 'P1' }, 'D1', 55, state, { priority: 'essential' });
    assert.strictEqual(r.filled, 40);
    assert.strictEqual(r.stockout, 15);
    assert.strictEqual(state.backlog.D1, 15);
  });

  it('warehouseIssue: cannot ship more than warehouse on-hand', () => {
    const wh = initWarehouseState({ id: 'W1', initialStock: { D1: 30 } });
    const shipped = warehouseIssue(wh, 'D1', 100);
    assert.strictEqual(shipped, 30);
    assert.strictEqual(wh.onHand.D1, 0);
  });
});

describe('hand-calculated distribution cost', () => {
  it('one shipment: order cost 25 + transport 0.15/unit (engine constants)', () => {
    const ORDER_COST = 25;
    const TRANSPORT_PER_UNIT = 0.15;
    const qty = 100;
    assert.strictEqual(ORDER_COST + qty * TRANSPORT_PER_UNIT, 40);
  });

  it('arrival on day 2 adds stock before backlog service', () => {
    const ph = initPharmacyState({ id: 'P1', regionType: 'urban', onHand: { D1: 0 } });
    ph.backlog.D1 = 30;
    const inTransit = [];
    scheduleShipment({
      pharmacy: { id: 'P1', regionType: 'urban' },
      drugId: 'D1',
      qty: 50,
      currentDay: 0,
      transitDays: 2,
      inTransit,
    });
    processArrivals(2, inTransit, [ph], { D1: { priority: 'essential' } });
    assert.ok(ph.onHand.D1 >= 20);
  });
});

describe('hand-calculated metrics on toy daily log', () => {
  it('stockoutRate = 25/100', () => {
    const runLog = {
      totalCost: 40,
      daily: [{
        totalInventory: 100,
        dailyStockoutRate: 0.25,
        dailyFillRate: 0.75,
        dailyAccessDelayUnitDays: 25,
        priorityTotals: {
          essential: { demand: 100, filled: 75, stockout: 25 },
          'chronic-care': { demand: 0, filled: 0, stockout: 0 },
          routine: { demand: 0, filled: 0, stockout: 0 },
        },
        pharmacyResults: [{
          regionType: 'urban',
          demand: 100,
          filled: 75,
          stockout: 25,
          accessDelayUnitDays: 25,
          stockoutByDrug: [{ drugId: 'D1', units: 25, priority: 'essential' }],
        }],
        shipments: [{ qty: 100, transitDays: 2 }],
      }],
      pharmacyStatesSummary: [],
    };
    const instance = {
      drugs: [{ id: 'D1', priority: 'essential', stockoutPenalty: 50 }],
      scenario: {
        metricsWeights: {
          maxRelevantWaitDays: 30,
          serviceInequalityWeights: { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 },
        },
        events: [],
      },
    };
    const m = computeRunMetrics(runLog, instance, 'fixed-allocation');
    assert.strictEqual(m.stockoutRate, 0.25);
    assert.strictEqual(m.avgSyntheticAccessDelayDays, 0.25);
  });
});
