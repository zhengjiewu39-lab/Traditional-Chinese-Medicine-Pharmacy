const { describe, it } = require('node:test');
const assert = require('node:assert');
const { canonicalJson, hashScenario } = require('../scenarioHash');
const { getGitCommitHash, getCommitSource } = require('../gitInfo');
const { runSimulation, runReplicates, inventoryAudit } = require('../simulationEngine');
const { decideReplenishment } = require('../policyEngine');
const { waterFillStage1 } = require('../errra');
const { pairedBootstrap, pairedPolicyComparison, priceOfEquity, stats } = require('../metricsEngine');
const { DEFAULT_SCENARIO, validateScenario } = require('../scenarioSchema');
const { lateralConfig } = require('../lateralTransfers');
const {
  parseReplicates, parsePolicyIds, isExperimentId, isJobId,
} = require('../requestValidation');
const { tieBreak } = require('../distributionEngine');
const {
  ALL_POLICIES, ABLATIONS, smallScenario, makeCtx, matrixScenario,
} = require('./testHelpers');

const sum = (xs, f = (x) => x) => xs.reduce((s, x) => s + f(x), 0);

describe('canonical scenario hash', () => {
  const a = { b: 1, a: { y: [1, { q: 2, p: 1 }], x: 'z' }, c: null, d: true };
  const reordered = { d: true, c: null, a: { x: 'z', y: [1, { p: 1, q: 2 }] }, b: 1 };

  it('same object with different key order at every level gives the same hash', () => {
    assert.strictEqual(canonicalJson(a), canonicalJson(reordered));
    assert.strictEqual(hashScenario(a), hashScenario(reordered));
  });

  it('any nested field change changes the hash', () => {
    const h = hashScenario(a);
    assert.notStrictEqual(hashScenario({ ...a, a: { ...a.a, y: [1, { q: 3, p: 1 }] } }), h);
    assert.notStrictEqual(hashScenario({ ...a, a: { ...a.a, x: 'Z' } }), h);
    assert.notStrictEqual(hashScenario({ ...a, d: false }), h);
    assert.notStrictEqual(hashScenario({ ...a, c: 0 }), h);
    const nested = JSON.parse(JSON.stringify(DEFAULT_SCENARIO));
    nested.regions.rural.vulnerabilityWeight += 0.01;
    assert.notStrictEqual(hashScenario(nested), hashScenario(DEFAULT_SCENARIO));
    const ev = JSON.parse(JSON.stringify(DEFAULT_SCENARIO));
    ev.events[1].magnitude = 0.51;
    assert.notStrictEqual(hashScenario(ev), hashScenario(DEFAULT_SCENARIO));
  });

  it('array order is significant', () => {
    assert.notStrictEqual(hashScenario({ x: [1, 2] }), hashScenario({ x: [2, 1] }));
    const swapped = { ...DEFAULT_SCENARIO, events: [...DEFAULT_SCENARIO.events].reverse() };
    assert.notStrictEqual(hashScenario(swapped), hashScenario(DEFAULT_SCENARIO));
  });

  it('is stable across repeated calls and deep copies', () => {
    const h = hashScenario(DEFAULT_SCENARIO);
    for (let i = 0; i < 5; i += 1) assert.strictEqual(hashScenario(JSON.parse(JSON.stringify(DEFAULT_SCENARIO))), h);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('serializes primitives explicitly and rejects non-JSON values', () => {
    assert.strictEqual(canonicalJson({ n: null, t: true, f: false, s: 'a"b', i: 3, r: 0.1, z: -0 }), '{"f":false,"i":3,"n":null,"r":0.1,"s":"a\\"b","t":true,"z":0}');
    for (const bad of [{ x: undefined }, { x: NaN }, { x: Infinity }, { x: -Infinity }, { x: () => 1 }, { x: new Date(0) }, { x: 1n }]) {
      assert.throws(() => canonicalJson(bad), TypeError);
    }
    const cyc = {};
    cyc.self = cyc;
    assert.throws(() => canonicalJson(cyc), TypeError);
  });

  it('SOURCE_COMMIT is used when set (for builds without .git)', () => {
    const prev = process.env.SOURCE_COMMIT;
    try {
      process.env.SOURCE_COMMIT = 'ABCDEF1234567';
      assert.strictEqual(getGitCommitHash(), 'abcdef1234567');
      assert.strictEqual(getCommitSource(), 'env:SOURCE_COMMIT');
      process.env.SOURCE_COMMIT = 'not a sha; rm -rf';
      assert.strictEqual(getGitCommitHash(), 'invalid-SOURCE_COMMIT');
    } finally {
      if (prev === undefined) delete process.env.SOURCE_COMMIT; else process.env.SOURCE_COMMIT = prev;
    }
  });
});

describe('reproducibility', () => {
  it('same seed reproduces every metric exactly, for every policy', () => {
    const scenario = matrixScenario('M5-compound', 7, 80);
    for (const p of [...ALL_POLICIES, ...ABLATIONS]) {
      const x = runSimulation({ scenario, policyId: p, logLevel: 'summary' });
      const y = runSimulation({ scenario, policyId: p, logLevel: 'summary' });
      assert.deepStrictEqual(x.metrics, y.metrics, p);
      assert.deepStrictEqual(x.runLog.daily, y.runLog.daily, p);
    }
  });

  it('different seeds give different demand', () => {
    const a = runSimulation({ scenario: matrixScenario('M5-compound', 1, 40), policyId: 'cost-first', logLevel: 'summary' });
    const b = runSimulation({ scenario: matrixScenario('M5-compound', 2, 40), policyId: 'cost-first', logLevel: 'summary' });
    assert.notDeepStrictEqual(a.metrics.sameDayUnfilledUnits + a.runLog.daily[3].totalInventory, b.metrics.sameDayUnfilledUnits + b.runLog.daily[3].totalInventory);
  });
});

describe('inventory audit (mandatory, end of every run)', () => {
  it('passes at pharmacy, warehouse and network level for every policy and matrix scenario', () => {
    for (const key of ['M1-normal', 'M3-supply-disruption', 'M5-compound', 'M8-tight-transport', 'M9-extreme']) {
      for (const p of [...ALL_POLICIES, ...ABLATIONS]) {
        const r = runSimulation({ scenario: matrixScenario(key, 3), policyId: p, logLevel: 'summary', checkConservation: true });
        const { inventoryAudit: audit } = r.runLog;
        assert.ok(audit.passed, `${key} ${p}`);
        for (const row of audit.rows) {
          const ph = row.pharmacies;
          assert.strictEqual(ph.initialStock + ph.receivedSupply + ph.inboundTransfers - ph.fulfilledDemand - ph.outboundTransfers - ph.expiredOrLost, ph.endingStock);
          assert.strictEqual(row.network.residual, 0);
        }
      }
    }
  });

  it('a one-unit discrepancy fails the audit', () => {
    const drugs = [{ id: 'D1' }];
    const pharmacyStates = [{ onHand: { D1: 10 } }];
    const warehouseStates = [{ onHand: { D1: 5 } }];
    const ledger = {
      initial: { D1: 15 }, initialPharmacy: { D1: 10 }, initialWarehouse: { D1: 5 }, inbound: { D1: 0 }, dispensed: { D1: 0 },
      issued: { D1: 0 }, arrivedFromWarehouse: { D1: 0 }, transfersIn: { D1: 0 }, transfersOut: { D1: 0 },
    };
    assert.strictEqual(inventoryAudit({ drugs, pharmacyStates, warehouseStates, inTransit: [], ledger }).passed, true);
    pharmacyStates[0].onHand.D1 = 11;
    assert.strictEqual(inventoryAudit({ drugs, pharmacyStates, warehouseStates, inTransit: [], ledger }).passed, false);
  });

  it('unmet-demand concepts are distinct and consistent: same-day unfilled = late-filled + horizon-end unmet', () => {
    for (const p of ALL_POLICIES) {
      const m = runSimulation({ scenario: matrixScenario('M7-tight-warehouse', 4), policyId: p, logLevel: 'summary' }).metrics;
      assert.strictEqual(m.sameDayUnfilledUnits, m.lateFilledUnits + m.horizonEndUnmetUnits, p);
      assert.ok(m.horizonEndUnmetRate <= m.sameDayUnfilledRate + 1e-12);
      assert.ok(m.p95WaitingTime >= 0 && m.meanWaitingTime >= 0);
      assert.ok(m.stockoutIncidentRate >= 0 && m.stockoutIncidentRate <= 1);
    }
  });
});

describe('supplier network', () => {
  it('a disruption on one warehouse\'s primary supplier does not reduce upstream supply or dispatch at the other warehouse', () => {
    const base = smallScenario({ simulationDays: 60, logistics: { warehouseInitialStockDays: 5, warehouseTargetStockDays: 5 } });
    const hit = { ...base, events: [{ type: 'supplyDisruption', startDay: 5, durationDays: 40, magnitude: 0, targetWarehouses: ['WH1'] }] };
    const shipped = (r, wh) => r.runLog.suppliers.filter((s) => s.warehouseId === wh).reduce((s, x) => s + x.shippedUnits, 0);
    const a = runSimulation({ scenario: base, policyId: 'cost-first', logLevel: 'summary' });
    const b = runSimulation({ scenario: hit, policyId: 'cost-first', logLevel: 'summary' });
    assert.ok(shipped(b, 'WH1') < shipped(a, 'WH1'));
    const primary = (r, wh) => r.runLog.suppliers.find((s) => s.id === `SUP-${wh}-P`);
    assert.strictEqual(primary(b, 'WH2').daysByState.down, 0);
    assert.ok(primary(b, 'WH1').daysByState.down === 40);
    assert.ok(validateScenario({ events: hit.events }).valid);
    assert.ok(!validateScenario({ events: [{ type: 'supplyDisruption', startDay: 1, durationDays: 3, magnitude: 0.5, targetRegions: ['rural'] }] }).valid);
  });

  it('backup suppliers ship only when redundancy is enabled', () => {
    const s = matrixScenario('M3-supply-disruption', 2);
    const on = runSimulation({ scenario: s, policyId: 'equity-constrained-rolling-horizon', logLevel: 'summary' });
    const off = runSimulation({ scenario: s, policyId: 'errra-no-supplier-redundancy', logLevel: 'summary' });
    assert.ok(on.metrics.backupSupplierUnits > 0);
    assert.strictEqual(off.metrics.backupSupplierUnits, 0);
    assert.ok(off.metrics.cumulativeUnmetDemand > on.metrics.cumulativeUnmetDemand);
  });

  it('warehouse capacityInStandardUnits is enforced (on hand never exceeds it)', () => {
    const cap = 400;
    const s = smallScenario({ warehouses: [{ capacityInStandardUnits: cap }, { capacityInStandardUnits: cap }], logistics: { warehouseInitialStockDays: 0, warehouseTargetStockDays: 1000 } });
    const r = runSimulation({ scenario: s, policyId: 'cost-first', logLevel: 'summary' });
    for (const d of r.runLog.daily) assert.ok(d.warehouseInventory <= 2 * cap, `day ${d.day} ${d.warehouseInventory}`);
    assert.ok(r.runLog.daily.some((d) => d.upstreamShipped > 0));
  });
});

describe('lateral emergency transfers', () => {
  const scenario = matrixScenario('M5-compound', 5);
  const r = runSimulation({ scenario, policyId: 'cost-first', logLevel: 'full' });
  const transfers = r.runLog.daily.flatMap((d) => d.transfers);
  const cfg = lateralConfig(scenario);

  it('happen under stress, are essential-only, same-region and cost-recorded', () => {
    assert.ok(transfers.length > 0);
    const essential = new Set(scenario.drugs.filter((d) => d.priority === 'essential').map((d) => d.id));
    const regionOf = Object.fromEntries(r.runLog.pharmacyStatesSummary.map((p) => [p.id, p.regionType]));
    for (const t of transfers) {
      assert.ok(essential.has(t.drugId));
      assert.strictEqual(regionOf[t.fromPharmacyId], regionOf[t.toPharmacyId]);
      assert.ok(t.expectedUnmetReduction > 0);
      assert.ok(t.cost > 0 && Math.abs(t.cost - (cfg.costPerUnit * t.qty + cfg.fixedCost)) < 1e-9);
    }
    assert.ok(Math.abs(sum(transfers, (t) => t.cost) - r.runLog.costs.lateralTransfer) < 1e-6);
  });

  it('are not circular within the cooldown window and respect the regional daily capacity', () => {
    for (const t of transfers) {
      const back = transfers.find((u) => u.drugId === t.drugId && u.fromPharmacyId === t.toPharmacyId
        && u.toPharmacyId === t.fromPharmacyId && Math.abs(u.day - t.day) <= cfg.cooldownDays);
      assert.ok(!back, `cycle ${t.fromPharmacyId}↔${t.toPharmacyId} ${t.drugId}`);
    }
    const byDayRegion = {};
    for (const t of transfers) byDayRegion[`${t.day}|${t.regionType}`] = (byDayRegion[`${t.day}|${t.regionType}`] || 0) + t.qty;
    const inst = require('../scenarioGenerator').generateScenarioInstance(scenario);
    const { baselineDailyDemand } = require('../scenarioGenerator');
    for (const [k, q] of Object.entries(byDayRegion)) {
      const rt = k.split('|')[1];
      const cap = Math.floor(cfg.capacityCoverage * sum(inst.pharmacies.filter((p) => p.regionType === rt), (p) => sum(inst.drugs.filter((d) => d.priority === 'essential'), (d) => baselineDailyDemand(p, d, scenario))));
      assert.ok(q <= cap, `${k} ${q} > ${cap}`);
    }
  });

  it('are disabled by the ablation and by scenario config', () => {
    const off = runSimulation({ scenario, policyId: 'errra-no-transfers', logLevel: 'summary' });
    assert.strictEqual(off.metrics.lateralTransferUnits, 0);
    const cfgOff = { ...scenario, logistics: { ...scenario.logistics, lateralTransfers: { ...scenario.logistics.lateralTransfers, enabled: false } } };
    assert.strictEqual(runSimulation({ scenario: cfgOff, policyId: 'cost-first', logLevel: 'summary' }).metrics.lateralTransferUnits, 0);
  });
});

describe('selection gate and ranking', () => {
  it('a line whose serving warehouse holds no stock is not selected, with the reason logged', () => {
    const ctx = makeCtx({
      scenario: smallScenario(),
      policyId: 'reorder-point',
      mutate: (c) => {
        for (const p of c.pharmacyStates) for (const k of Object.keys(p.onHand)) p.onHand[k] = 0;
        for (const w of c.warehouseStates) w.onHand.D1 = 0;
      },
    });
    const res = decideReplenishment(ctx);
    assert.ok(res.orders.every((o) => o.drugId !== 'D1'));
    assert.ok(res.decisions.some((d) => d.drugId === 'D1' && d.notSelectedReason === 'warehouse_out_of_stock'));
  });

  it('every selected order has qty > 0, expected benefit > 0, a finite score and a reason; ranks follow the score', () => {
    for (const p of [...ALL_POLICIES, ...ABLATIONS]) {
      const ctx = makeCtx({ scenario: smallScenario(), policyId: p, mutate: (c) => { for (const s of c.pharmacyStates) s.onHand.D1 = 0; } });
      const res = decideReplenishment(ctx);
      const sel = res.decisions.filter((d) => d.selected).sort((a, b) => a.policyRank - b.policyRank);
      assert.ok(sel.length > 0, p);
      for (const d of sel) {
        assert.ok(d.qty > 0 && d.expectedBenefit > 0 && Number.isFinite(d.priorityScore) && d.priorityReason, p);
      }
      for (let i = 1; i < sel.length; i += 1) {
        const a = sel[i - 1];
        const b = sel[i];
        assert.ok(a.priorityScore > b.priorityScore || (a.priorityScore === b.priorityScore && tieBreak(a, b) < 0), `${p} rank ${i}`);
      }
    }
  });

  it('tie-break on exactly equal scores is region, then pharmacy, then SKU', () => {
    const xs = [
      { regionType: 'urban', pharmacyId: 'PH2', drugId: 'D1' },
      { regionType: 'rural', pharmacyId: 'PH10', drugId: 'D2' },
      { regionType: 'rural', pharmacyId: 'PH10', drugId: 'D10' },
      { regionType: 'rural', pharmacyId: 'PH9', drugId: 'D1' },
    ].sort(tieBreak);
    assert.deepStrictEqual(xs.map((x) => `${x.regionType}|${x.pharmacyId}|${x.drugId}`), [
      'rural|PH9|D1', 'rural|PH10|D2', 'rural|PH10|D10', 'urban|PH2|D1',
    ]);
  });

  it('single-region high vulnerability: with equal projected service, the more vulnerable region is served first', () => {
    const line = (key, rt, v) => ({ key, regionType: rt, warehouseId: 'W1', drugId: 'D1', v, avail: 5, need: 10, pharmacyIndex: Number(key.slice(1)) });
    const s1 = waterFillStage1([line('L0', 'urban', 1), line('L1', 'suburban', 1), line('L2', 'rural', 3)], { W1: 1 }, { W1: { D1: 10 } }, { serviceFloor: 1, beta: 0.05, batchFraction: 0 });
    assert.deepStrictEqual(s1.order, ['L2']);
  });
});

describe('policy differentiation under stress', () => {
  const seeds = [11, 12, 13, 14, 15];
  const runs = (p) => seeds.map((seed) => ({ seed, metrics: runSimulation({ scenario: matrixScenario('M5-compound', seed), policyId: p, logLevel: 'summary' }).metrics }));
  const byPolicy = Object.fromEntries(['cost-first', 'equity-aware', 'equity-constrained-rolling-horizon'].map((p) => [p, runs(p)]));

  it('cost-only and equity-aware / ERRRA are not identical', () => {
    for (const other of ['equity-aware', 'equity-constrained-rolling-horizon']) {
      const differs = seeds.some((_, i) => byPolicy['cost-first'][i].metrics.totalCost !== byPolicy[other][i].metrics.totalCost);
      assert.ok(differs, other);
    }
  });

  it('ERRRA raises worst-region essential fill over cost-only on the compound scenario; Price of Equity is computable', () => {
    const cmp = pairedPolicyComparison(byPolicy);
    const pair = cmp.pairs.find((x) => x.policyA === 'cost-first' && x.policyB === 'equity-constrained-rolling-horizon');
    assert.ok(pair.metrics.worstRegionEssentialFillRate.ci95High < 0, 'cost-only − ERRRA worst-region fill should be < 0');
    assert.ok(Number.isFinite(cmp.priceOfEquity['equity-constrained-rolling-horizon']));
    assert.strictEqual(cmp.priceOfEquity['cost-first'], 0);
  });
});

describe('statistics', () => {
  it('paired bootstrap is deterministic with a fixed seed and brackets the mean', () => {
    const d = [0.1, -0.05, 0.2, 0.03, 0.07, 0.12, -0.01, 0.09];
    const a = pairedBootstrap(d);
    const b = pairedBootstrap(d);
    assert.deepStrictEqual(a, b);
    assert.ok(a.ci95Low <= a.meanDiff && a.meanDiff <= a.ci95High);
    const c = pairedBootstrap([2, 2, 2]);
    assert.strictEqual(c.ci95Low, 2);
    assert.strictEqual(c.ci95High, 2);
  });

  it('priceOfEquity = relative extra cost, null for a non-positive reference', () => {
    assert.strictEqual(priceOfEquity(110, 100), 0.1);
    assert.strictEqual(priceOfEquity(90, 100), -0.1);
    assert.strictEqual(priceOfEquity(5, 0), null);
  });

  it('mean converges and the CI narrows as replicates increase', () => {
    const scenario = matrixScenario('M5-compound', 1000, 90);
    const rep = runReplicates({ scenario, policyId: 'cost-first', replicates: 40, logLevel: 'summary' });
    const vals = rep.results.map((r) => r.metrics.essentialMedicineFillRate);
    const s10 = stats(vals.slice(0, 10));
    const s40 = stats(vals);
    const hw = (s) => (s.ci95High - s.ci95Low) / 2;
    assert.ok(hw(s40) < hw(s10));
    assert.ok(Math.abs(s40.mean - stats(vals.slice(0, 20)).mean) < 2 * hw(s10));
    assert.ok(s40.ci95Low <= s40.mean && s40.mean <= s40.ci95High);
  });
});

describe('request validation', () => {
  it('replicates must be a bounded positive integer', () => {
    for (const bad of [0, -1, 1.5, 501, '10', null, NaN]) assert.ok(parseReplicates(bad).error, String(bad));
    assert.strictEqual(parseReplicates(100).value, 100);
    assert.strictEqual(parseReplicates(undefined, { defaultValue: 30 }).value, 30);
  });

  it('policyIds must exist and be unique (aliases count as the same policy)', () => {
    assert.ok(parsePolicyIds(['cost-first', 'nope']).errors);
    assert.ok(parsePolicyIds(['cost-first', 'cost-only']).errors);
    assert.ok(parsePolicyIds([]).errors);
    assert.deepStrictEqual(parsePolicyIds(['tuned-sQ', 'ERRRA']).value, ['reorder-point', 'equity-constrained-rolling-horizon']);
  });

  it('experiment and job ids are whitelisted', () => {
    assert.ok(isExperimentId('exp_1700000000000_0123abcd'));
    for (const bad of ['../etc/passwd', 'exp_1_0123abcd', 'exp_1700000000000_0123abcd.json', 'grp_1700000000000_0123abcd']) {
      assert.ok(!isExperimentId(bad), bad);
    }
    assert.ok(isJobId('grp_1700000000000_0123abcd'));
    assert.ok(!isJobId('grp_1700000000000_0123abcd/../../x'));
  });

  it('scenario validation rejects wrong types and out-of-range event magnitudes', () => {
    assert.ok(!validateScenario({ randomSeed: 'x' }).valid);
    assert.ok(!validateScenario({ events: [{ type: 'demandSurge', startDay: 0, durationDays: 5, magnitude: -1 }] }).valid);
    assert.ok(!validateScenario({ events: [{ type: 'supplyDisruption', startDay: 0, durationDays: 5, magnitude: 1.5 }] }).valid);
    assert.ok(!validateScenario({ regions: { rural: { demandVolatility: 2 } } }).valid);
    assert.ok(!validateScenario([]).valid);
    assert.ok(validateScenario({}).valid);
  });
});
