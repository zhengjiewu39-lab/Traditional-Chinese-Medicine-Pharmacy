const { describe, it } = require('node:test');
const assert = require('node:assert');
const { decideReplenishment, lineEconomics, buildLines } = require('../policyEngine');
const { markShipped } = require('../inventoryEngine');
const { applyWarehouseSupplyCaps } = require('../dispatchEngine');
const { allocateTruckCapacityByWarehouse, proportionalShares } = require('../distributionEngine');
const { computeRegionalDeficits, computeRegionalNeed } = require('../equitySignals');
const { waterFillStage1 } = require('../errra');
const { runSimulation, checkConservation, ConservationError } = require('../simulationEngine');
const { generateScenarioInstance } = require('../scenarioGenerator');
const { DEFAULT_SCENARIO } = require('../scenarioSchema');
const { ALL_POLICIES, ABLATIONS, smallScenario, makeCtx, orderQty, matrixScenario } = require('./testHelpers');

const PH = 'PH1';
const DRUG = 'D1';

function setLine(ctx, { onHand = 0, onOrder = 0, backlog = 0 }) {
  const st = ctx.pharmacyStates.find((p) => p.id === PH);
  st.onHand[DRUG] = onHand;
  st.onOrder[DRUG] = onOrder;
  st.backlog[DRUG] = backlog;
}

function qtyFor(policyId, line) {
  const ctx = makeCtx({ scenario: smallScenario(), policyId, mutate: (c) => setLine(c, line) });
  return orderQty(decideReplenishment(ctx), PH, DRUG);
}

describe('inventory position uses onHand + onOrder − backlog', () => {
  for (const policyId of ALL_POLICIES) {
    it(`${policyId}: higher backlog never reduces the order`, () => {
      const base = qtyFor(policyId, { onHand: 0, backlog: 0 });
      const withBacklog = qtyFor(policyId, { onHand: 0, backlog: 40 });
      assert.ok(base > 0, 'line must trigger an order');
      assert.ok(withBacklog >= base, `backlog 40 → ${withBacklog} < ${base}`);
      if (policyId !== 'reorder-point') assert.ok(withBacklog > base, 'lower IP must raise the order-up-to quantity');
    });

    it(`${policyId}: higher onOrder reduces the order`, () => {
      const base = qtyFor(policyId, { onHand: 0 });
      const half = qtyFor(policyId, { onHand: 0, onOrder: Math.floor(base / 2) });
      const covered = qtyFor(policyId, { onHand: 0, onOrder: base });
      assert.ok(half <= base);
      assert.ok(covered < base, `onOrder ${base} should cut the order below ${base}, got ${covered}`);
      assert.strictEqual(covered, 0);
    });

    it(`${policyId}: no duplicate order while the first shipment is still in transit`, () => {
      const R = policyId === 'fixed-allocation' ? 3 : 1;
      const ample = smallScenario({ logistics: { dispatchCapacityCoverage: 1000, truckCapacityCoverage: 1000, warehouseInitialStockDays: 1000 } });
      const ctx = makeCtx({ scenario: ample, policyId, mutate: (c) => setLine(c, { onHand: 0 }) });
      const first = decideReplenishment(ctx);
      assert.ok(orderQty(first, PH, DRUG) > 0);
      for (const o of first.orders) {
        markShipped(ctx.pharmacyStates.find((p) => p.id === o.pharmacyId), o.drugId, o.qty);
      }
      const second = decideReplenishment({ ...ctx, day: ctx.day + R });
      const reordered = first.orders.filter((o) => orderQty(second, o.pharmacyId, o.drugId) > 0);
      assert.deepStrictEqual(reordered.map((o) => `${o.pharmacyId}|${o.drugId}`), []);
    });
  }

  it('all emitted quantities are non-negative integers', () => {
    for (const policyId of ALL_POLICIES) {
      const ctx = makeCtx({ scenario: smallScenario(), policyId });
      for (const o of decideReplenishment(ctx).orders) {
        assert.ok(Number.isInteger(o.qty) && o.qty > 0, `${policyId} ${o.qty}`);
      }
    }
  });
});

describe('policy ranking is preserved through supply and truck caps', () => {
  const warehouses = [{ id: 'W1', dailyDispatchCapacity: 150, truckCapacityUnits: 120 }];
  const mk = (rank, drugId, qty, pharmacyId = 'P1') => ({ pharmacyId, warehouseId: 'W1', drugId, qty, policyRank: rank });

  it('dispatch cap serves orders in policyRank order, not list order', () => {
    const orders = [mk(2, 'D1', 100), mk(0, 'D1', 100, 'P2'), mk(1, 'D1', 100)];
    const { accepted, deferred } = applyWarehouseSupplyCaps(orders, warehouses, [{ id: 'W1', onHand: { D1: 1000 } }]);
    assert.deepStrictEqual(accepted.map((o) => [o.policyRank, o.qty]), [[0, 100], [1, 50]]);
    assert.deepStrictEqual(deferred.map((o) => [o.policyRank, o.qty, o.reason]), [[1, 50, 'dispatch_cap'], [2, 100, 'dispatch_cap']]);
  });

  it('units the warehouse cannot issue do not consume dispatch capacity', () => {
    const orders = [mk(0, 'D2', 100), mk(1, 'D1', 100)];
    const { accepted, deferred } = applyWarehouseSupplyCaps(orders, warehouses, [{ id: 'W1', onHand: { D1: 1000, D2: 0 } }]);
    assert.deepStrictEqual(accepted.map((o) => [o.policyRank, o.qty]), [[1, 100]]);
    assert.deepStrictEqual(deferred.map((o) => o.reason), ['warehouse_stock']);
  });

  it('truck cap keeps rank order and records postTruckRank', () => {
    const orders = [mk(1, 'D1', 80), mk(0, 'D1', 80, 'P2')];
    const { accepted, deferred } = allocateTruckCapacityByWarehouse(orders, warehouses);
    assert.deepStrictEqual(accepted.map((o) => [o.policyRank, o.qty, o.postTruckRank]), [[0, 80, 0], [1, 40, 1]]);
    assert.deepStrictEqual(deferred.map((o) => [o.policyRank, o.qty, o.reason]), [[1, 40, 'truck_capacity']]);
  });

  it('proportional rationing splits shortages pro rata with integer largest remainders', () => {
    assert.deepStrictEqual(proportionalShares([100, 300], 200), [50, 150]);
    assert.deepStrictEqual(proportionalShares([1, 1, 1], 2), [1, 1, 0]);
    assert.deepStrictEqual(proportionalShares([5, 7], 100), [5, 7]);
    const orders = [mk(0, 'D1', 100), mk(1, 'D1', 300)].map((o) => ({ ...o, rationing: 'proportional' }));
    const wh = [{ id: 'W1', dailyDispatchCapacity: 200, truckCapacityUnits: 1000 }];
    const { accepted } = applyWarehouseSupplyCaps(orders, wh, [{ id: 'W1', onHand: { D1: 1000 } }]);
    assert.deepStrictEqual(accepted.map((o) => o.qty), [50, 150]);
  });

  it('ERRRA plans within dispatch capacity, so its orders are never cut by the dispatch cap', () => {
    const r = runSimulation({ scenario: matrixScenario('M8-tight-transport', 3, 70), policyId: 'equity-constrained-rolling-horizon' });
    const cut = r.runLog.daily.flatMap((d) => d.orderLog).filter((o) => o.unshippedReasons.some((u) => u.reason === 'dispatch_cap'));
    assert.strictEqual(cut.length, 0);
  });

  for (const policyId of ['cost-first', 'equity-aware']) {
    it(`${policyId}: in a stressed run, once an order is cut by the dispatch cap, every lower-ranked order in that warehouse gets no capacity`, () => {
      const scenario = matrixScenario('M8-tight-transport', 3, 70);
      const whOf = Object.fromEntries(generateScenarioInstance(scenario).pharmacies.map((p) => [p.id, p.warehouseId]));
      const r = runSimulation({ scenario, policyId });
      let checkedDays = 0;
      for (const day of r.runLog.daily) {
        const byWh = {};
        for (const o of day.orderLog) (byWh[whOf[o.pharmacyId]] ||= []).push(o);
        for (const list of Object.values(byWh)) {
          list.sort((a, b) => a.requestRank - b.requestRank);
          const cut = list.findIndex((o) => o.unshippedReasons.some((u) => u.reason === 'dispatch_cap'));
          if (cut < 0) continue;
          checkedDays += 1;
          for (const o of list.slice(cut + 1)) assert.strictEqual(o.afterSupplyQty, 0, `day ${day.day} rank ${o.requestRank}`);
          const shippedRanks = list.filter((o) => o.postSupplyRank != null).map((o) => o.postSupplyRank);
          assert.deepStrictEqual(shippedRanks, [...shippedRanks].sort((a, b) => a - b));
        }
      }
      assert.ok(checkedDays > 0, 'scenario must bind the dispatch cap');
    });
  }
});

describe('equity signal direction (deficit ≥ 0)', () => {
  const row = (ef, br = 0, ad = 0) => ({ essentialFillRate: ef, backlogRate: br, accessDelayDays: ad });

  it('rural worse → only rural has a deficit and is flagged worst', () => {
    const d = computeRegionalDeficits({ urban: row(0.98), suburban: row(0.96), rural: row(0.7, 0.2, 3) });
    assert.ok(d.rural.deficit > 0);
    assert.strictEqual(d.urban.deficit, 0);
    assert.ok(d.rural.isWorstRegion && !d.urban.isWorstRegion);
  });

  it('urban worse → urban has the deficit, rural gets none', () => {
    const d = computeRegionalDeficits({ urban: row(0.6, 0.3, 4), suburban: row(0.95), rural: row(0.97) });
    assert.ok(d.urban.deficit > 0);
    assert.strictEqual(d.rural.deficit, 0);
  });

  it('equal regions → no deficit anywhere', () => {
    const d = computeRegionalDeficits({ urban: row(0.9, 0.1, 1), suburban: row(0.9, 0.1, 1), rural: row(0.9, 0.1, 1) });
    for (const r of Object.values(d)) assert.strictEqual(r.deficit, 0);
  });

  function equityRun(stats) {
    const ctx = makeCtx({
      scenario: smallScenario(),
      policyId: 'equity-aware',
      regionalStats: stats,
      mutate: (c) => { for (const p of c.pharmacyStates) for (const k of Object.keys(p.onHand)) p.onHand[k] = 0; },
    });
    const res = decideReplenishment(ctx);
    const ranks = (rt) => res.orders.filter((o) => o.regionType === rt).map((o) => o.policyRank);
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    return { res, ruralMeanRank: mean(ranks('rural')), urbanMeanRank: mean(ranks('urban')) };
  }

  it('equity-aware: rural worse moves rural orders up; urban worse does not; full service gives no bonus', () => {
    const full = equityRun({ urban: row(1), suburban: row(1), rural: row(1) });
    const ruralWorse = equityRun({ urban: row(1), suburban: row(1), rural: row(0.6, 0.2, 3) });
    const urbanWorse = equityRun({ urban: row(0.6, 0.2, 3), suburban: row(1), rural: row(1) });
    assert.ok(full.res.decisions.every((d) => !d.equityBonus));
    assert.ok(ruralWorse.ruralMeanRank < full.ruralMeanRank);
    assert.ok(urbanWorse.ruralMeanRank >= full.ruralMeanRank);
    assert.ok(urbanWorse.urbanMeanRank < full.urbanMeanRank);
    assert.ok(ruralWorse.res.decisions.filter((d) => d.regionType === 'urban').every((d) => !d.equityBonus));
    assert.ok(urbanWorse.res.decisions.filter((d) => d.regionType === 'rural').every((d) => !d.equityBonus));
  });

  it('needScore is monotone: more unmet essential demand, higher vulnerability or larger backlog never lowers priority', () => {
    const v = { urban: 1, suburban: 1.2, rural: 1.6 };
    const grid = [0, 0.1, 0.3, 0.6, 1];
    for (const rt of ['urban', 'suburban', 'rural']) {
      for (const br of grid) {
        let prev = -Infinity;
        for (const gap of grid) {
          const n = computeRegionalNeed({ [rt]: row(1 - gap, br) }, v)[rt].needScore;
          assert.ok(n >= prev - 1e-12, `${rt} gap ${gap} br ${br}`);
          prev = n;
        }
        prev = -Infinity;
        for (const b of grid) {
          const n = computeRegionalNeed({ [rt]: row(0.7, b) }, v)[rt].needScore;
          assert.ok(n >= prev - 1e-12);
          prev = n;
        }
      }
    }
    for (const vr of [0.5, 1, 1.6, 3]) {
      const lo = computeRegionalNeed({ urban: row(0.7, 0.2), rural: row(0.7, 0.2) }, { urban: 1, rural: vr });
      const hi = computeRegionalNeed({ urban: row(0.7, 0.2), rural: row(0.7, 0.2) }, { urban: 1, rural: vr * 1.5 });
      assert.ok(hi.rural.needScore >= lo.rural.needScore - 1e-12);
    }
    const two = computeRegionalNeed({ urban: row(0.9, 0.1), rural: row(0.6, 0.3) }, v);
    assert.ok(two.rural.needScore > two.urban.needScore);
  });

  it('equity-aware: holding the line fixed, a more severe or more vulnerable region never gets a lower priorityScore', () => {
    const scoresFor = (stats, ruralV = 1.6) => {
      const scenario = smallScenario({ regions: { rural: { vulnerabilityWeight: ruralV } } });
      const ctx = makeCtx({
        scenario,
        policyId: 'equity-aware',
        regionalStats: stats,
        mutate: (c) => { for (const p of c.pharmacyStates) for (const k of Object.keys(p.onHand)) p.onHand[k] = 0; },
      });
      return new Map(decideReplenishment(ctx).decisions
        .filter((d) => d.regionType === 'rural')
        .map((d) => [`${d.pharmacyId}|${d.drugId}`, d.priorityScore]));
    };
    const others = { urban: row(0.95, 0.05), suburban: row(0.9, 0.05) };
    const mild = scoresFor({ ...others, rural: row(0.9, 0.05) });
    const severe = scoresFor({ ...others, rural: row(0.6, 0.3) });
    const vulnerable = scoresFor({ ...others, rural: row(0.9, 0.05) }, 3.2);
    assert.ok(mild.size > 0);
    for (const [k, s] of mild) {
      assert.ok(severe.get(k) >= s - 1e-9, `severity lowered ${k}`);
      assert.ok(vulnerable.get(k) >= s - 1e-9, `vulnerability lowered ${k}`);
    }
    assert.ok([...mild].some(([k, s]) => severe.get(k) > s));
  });

  const line = (key, regionType, avail, need) => ({ key, regionType, warehouseId: 'W1', drugId: 'D1', v: 1, avail, need, pharmacyIndex: Number(key.slice(1)) });

  it('ERRRA stage 1 serves the region with the lowest projected service first', () => {
    const run = (ruralAvail, urbanAvail) => waterFillStage1(
      [line('L0', 'urban', urbanAvail, 10), line('L1', 'suburban', 8, 10), line('L2', 'rural', ruralAvail, 10)],
      { W1: 1 }, { W1: { D1: 100 } }, { serviceFloor: 1, beta: 0, batchFraction: 0 },
    ).order[0];
    assert.strictEqual(run(2, 8), 'L2');
    assert.strictEqual(run(8, 2), 'L0');
  });

  it('ERRRA stage 1 with equal regions (β = 0) equalizes service', () => {
    const s1 = waterFillStage1(
      [line('L0', 'urban', 4, 10), line('L1', 'suburban', 4, 10), line('L2', 'rural', 4, 10)],
      { W1: 9 }, { W1: { D1: 100 } }, { serviceFloor: 1, beta: 0, batchFraction: 0 },
    );
    const srs = Object.values(s1.regionalSR);
    assert.ok(Math.max(...srs) - Math.min(...srs) < 1e-9);
  });
});

describe('cost-first net-benefit selection', () => {
  it('rejects lines whose expected net benefit ≤ 0 and logs the reason', () => {
    const scenario = smallScenario({ logistics: { orderCost: 1e6 } });
    const ctx = makeCtx({ scenario, policyId: 'cost-first', mutate: (c) => setLine(c, { onHand: 0 }) });
    const res = decideReplenishment(ctx);
    assert.strictEqual(res.orders.length, 0);
    const rejected = res.decisions.filter((d) => !d.selected);
    assert.ok(rejected.length > 0);
    assert.ok(rejected.every((d) => d.notSelectedReason === 'no_expected_benefit' && d.netBenefit <= 0));
  });

  it('selected lines have positive net benefit', () => {
    const ctx = makeCtx({ scenario: smallScenario(), policyId: 'cost-first' });
    const res = decideReplenishment(ctx);
    assert.ok(res.orders.length > 0);
    for (const d of res.decisions.filter((x) => x.selected)) assert.ok(d.netBenefit > 0);
  });

  it('stockout penalty enters only the benefit side', () => {
    const ctx = makeCtx({ scenario: smallScenario(), policyId: 'cost-first', mutate: (c) => setLine(c, { onHand: 0 }) });
    const l = buildLines(ctx).find((x) => x.pharmacyId === PH && x.drugId === DRUG);
    const a = lineEconomics(l, 50);
    const b = lineEconomics({ ...l, penalty: l.penalty * 3 }, 50);
    assert.strictEqual(a.cost, b.cost);
    assert.ok(b.benefit > a.benefit);
    assert.ok(Math.abs(a.cost - (a.variable + a.fixed + a.holding)) < 1e-9);
  });

  it('ERRRA stage 2 also logs negative-net lines as not selected', () => {
    const scenario = smallScenario({ logistics: { orderCost: 1e6 } });
    const ctx = makeCtx({ scenario, policyId: 'errra-no-floor', mutate: (c) => setLine(c, { onHand: 0 }) });
    const res = decideReplenishment(ctx);
    assert.strictEqual(res.orders.length, 0);
    assert.ok(res.decisions.some((d) => d.notSelectedReason === 'negative_net_benefit'));
  });
});

describe('extreme-condition tests (all policies and ablations, conservation checked daily)', () => {
  const everyPolicy = [...ALL_POLICIES, ...ABLATIONS];
  const run = (scenario, policyId) => runSimulation({ scenario, policyId, logLevel: 'summary', checkConservation: true });
  const sum = (daily, f) => daily.reduce((s, d) => s + f(d), 0);

  it('zero demand → no stockouts and no backlog', () => {
    const scenario = smallScenario({ demandMultiplier: 0 });
    for (const p of everyPolicy) {
      const r = run(scenario, p);
      assert.strictEqual(sum(r.runLog.daily, (d) => d.totalBacklog), 0, p);
      assert.strictEqual(sum(r.runLog.daily, (d) => Object.values(d.regionDaily).reduce((s, x) => s + x.stockout, 0)), 0, p);
    }
  });

  it('unlimited stock and capacity → every policy fills ≥ 99.9%', () => {
    const scenario = smallScenario({
      logistics: { pharmacyInitialStockDays: 200, warehouseInitialStockDays: 10000, dispatchCapacityCoverage: 1000, truckCapacityCoverage: 1000 },
    });
    for (const p of everyPolicy) assert.ok(run(scenario, p).metrics.fillRate >= 0.999, p);
  });

  it('zero dispatch and truck capacity → nothing ships and no shipment costs accrue', () => {
    const scenario = smallScenario({ logistics: { dispatchCapacityCoverage: 0, truckCapacityCoverage: 0 } });
    for (const p of everyPolicy) {
      const r = run(scenario, p);
      assert.strictEqual(sum(r.runLog.daily, (d) => d.shippedUnits), 0, p);
      assert.strictEqual(r.runLog.costs.procurement + r.runLog.costs.transport + r.runLog.costs.orderFixed, 0, p);
    }
  });

  it('complete supply cut → no upstream supply, and pharmacies receive at most the initial warehouse stock', () => {
    const cut = [{ type: 'supplyDisruption', startDay: 0, durationDays: 40, magnitude: 0, supplierTier: 'all' }];
    const scenario = smallScenario({ events: cut });
    for (const p of everyPolicy) {
      const r = run(scenario, p);
      assert.strictEqual(sum(r.runLog.daily, (d) => d.upstreamShipped + d.upstreamReceived), 0, p);
      const initialWh = r.runLog.inventoryAudit.rows.reduce((s, x) => s + x.warehouses.initialStock, 0);
      assert.ok(sum(r.runLog.daily, (d) => d.shippedUnits) <= initialWh, p);
    }
    const empty = smallScenario({ events: cut, logistics: { warehouseInitialStockDays: 0 } });
    for (const p of everyPolicy) {
      const r = run(empty, p);
      assert.strictEqual(sum(r.runLog.daily, (d) => d.shippedUnits), 0, p);
      assert.ok(r.metrics.fillRate < 0.5, `${p} fill ${r.metrics.fillRate}`);
    }
  });
});

describe('conservation', () => {
  it('stock, pipeline and backlog identities hold every day in compound and extreme scenarios', () => {
    for (const key of ['M5-compound', 'M7-tight-warehouse', 'M9-extreme']) {
      for (const p of [...ALL_POLICIES, ...ABLATIONS]) {
        assert.doesNotThrow(() => runSimulation({ scenario: matrixScenario(key, 5), policyId: p, logLevel: 'summary', checkConservation: true }), `${key} ${p}`);
      }
    }
  });

  it('checkConservation detects a lost unit', () => {
    const drugs = [{ id: 'D1' }];
    const pharmacyStates = [{ onHand: { D1: 10 }, onOrder: { D1: 5 }, backlog: { D1: 0 }, backlogServed: { D1: 0 } }];
    const warehouseStates = [{ onHand: { D1: 20 } }];
    const inTransit = [{ drugId: 'D1', qty: 5 }];
    const ledger = { initial: { D1: 36 }, inbound: { D1: 0 }, dispensed: { D1: 0 }, backordered: { D1: 0 } };
    assert.throws(() => checkConservation({ day: 0, drugs, pharmacyStates, warehouseStates, inTransit, ledger }), ConservationError);
    ledger.initial.D1 = 35;
    assert.doesNotThrow(() => checkConservation({ day: 0, drugs, pharmacyStates, warehouseStates, inTransit, ledger }));
  });
});

describe('acceptance: cost-first and equity-aware differ on the default scenario', () => {
  it('different total cost or different decisions', () => {
    const scenario = { ...DEFAULT_SCENARIO, randomSeed: 42 };
    const a = runSimulation({ scenario, policyId: 'cost-first', logLevel: 'summary' });
    const b = runSimulation({ scenario, policyId: 'equity-aware', logLevel: 'summary' });
    assert.notStrictEqual(a.runLog.totalCost, b.runLog.totalCost);
  });
});
