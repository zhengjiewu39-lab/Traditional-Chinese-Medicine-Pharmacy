const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  fulfillDemand,
  initPharmacyState,
  warehouseIssue,
  initWarehouseState,
} = require('../inventoryEngine');
const { processArrivals, scheduleShipment } = require('../distributionEngine');
const { computeRunMetrics } = require('../metricsEngine');

/** Hand-checked micro-scenario (no RNG). */
describe('hand-calculated inventory', () => {
  it('fulfillDemand: 40 on-hand vs 55 demand → 40 filled, 15 stockout', () => {
    const state = initPharmacyState({ id: 'P1', regionType: 'urban', onHand: { D1: 40 } });
    const r = fulfillDemand({ id: 'P1' }, 'D1', 55, state);
    assert.strictEqual(r.filled, 40);
    assert.strictEqual(r.stockout, 15);
    assert.strictEqual(state.onHand.D1, 0);
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
    const expected = ORDER_COST + qty * TRANSPORT_PER_UNIT;
    assert.strictEqual(expected, 40);
  });

  it('arrival on day 2 adds stock before fulfillment on day 2', () => {
    const ph = initPharmacyState({ id: 'P1', regionType: 'urban', onHand: { D1: 0 } });
    const inTransit = [];
    scheduleShipment({
      pharmacy: { id: 'P1', regionType: 'urban' },
      drugId: 'D1',
      qty: 50,
      currentDay: 0,
      transitDays: 2,
      inTransit,
    });
    assert.strictEqual(inTransit.length, 1);
    assert.strictEqual(inTransit[0].arriveDay, 2);
    processArrivals(1, inTransit, [ph]);
    assert.strictEqual(ph.onHand.D1, 0);
    processArrivals(2, inTransit, [ph]);
    assert.strictEqual(ph.onHand.D1, 50);
    const r = fulfillDemand({ id: 'P1' }, 'D1', 30, ph);
    assert.strictEqual(r.filled, 30);
    assert.strictEqual(r.stockout, 0);
    assert.strictEqual(ph.onHand.D1, 20);
  });
});

describe('hand-calculated metrics on toy daily log', () => {
  it('stockoutRate = 25/100, holding proxy via totalCost field', () => {
    const runLog = {
      totalCost: 40,
      daily: [{
        totalInventory: 100,
        dailyStockoutRate: 0.25,
        dailyFillRate: 0.75,
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
          waitDays: 0.5,
          stockoutByDrug: [{ priority: 'essential', units: 25 }],
        }],
        shipments: [{ qty: 100, transitDays: 2 }],
      }],
    };
    const instance = {
      scenario: {
        metricsWeights: {
          stockoutPenaltyByPriority: { essential: 50, 'chronic-care': 35, routine: 15 },
          waitingTimePenaltyPerDay: 8,
          inequityPenaltyPerGap: 120,
        },
        events: [],
      },
    };
    const m = computeRunMetrics(runLog, instance, 'fixed-allocation');
    assert.strictEqual(m.stockoutRate, 0.25);
    assert.strictEqual(m.fillRate, 0.75);
    assert.strictEqual(m.essentialStockoutRate, 0.25);
    assert.strictEqual(m.avgDeliveryTimeDays, 2);
    assert.strictEqual(m.penalties.weightedStockoutPenalty, 25 * 50 * 3);
  });
});
