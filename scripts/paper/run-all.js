#!/usr/bin/env node
/**
 * One command for all paper tables and figures (synthetic data only).
 *
 *   node scripts/paper/run-all.js            # full run → paper/results, paper/tables, paper/figures
 *   node scripts/paper/run-all.js --quick    # smoke run with few seeds → paper/results-quick
 *   node scripts/paper/run-all.js --stage main,ablation
 *
 * Stages: docs, calibrate, main, ablation, sensitivity, stress, ciStability, crossModel.
 * Reads only the frozen paper/config/scenario-matrix.json and paper/config/seeds.json.
 * The reorder-point baseline is tuned on calibration seeds; every reported number uses test
 * seeds (or the dedicated sensitivity seeds). ERRRA parameters are the a-priori defaults.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const L = require('./lib');
const svg = require('./svg');
const { createRng } = require(path.join(L.ROOT, 'server/simulation/rng'));
const { crossCheck } = require(path.join(L.ROOT, 'server/simulation/validation/exhaustiveStage1'));
const { ERRRA_DEFAULTS } = require(path.join(L.ROOT, 'server/simulation/policyEngine'));

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const stageArg = args.find((a) => a.startsWith('--stage'));
const STAGES = stageArg
  ? (stageArg.includes('=') ? stageArg.split('=')[1] : args[args.indexOf(stageArg) + 1]).split(',')
  : ['docs', 'calibrate', 'main', 'ablation', 'sensitivity', 'stress', 'ciStability', 'crossModel'];

const OUT = path.join(L.ROOT, QUICK ? 'paper/results-quick' : 'paper/results');
const TABLES = path.join(OUT, '..', QUICK ? 'tables-quick' : 'tables');
const FIGS = path.join(OUT, '..', QUICK ? 'figures-quick' : 'figures');

const matrix = L.loadMatrix();
const seedsCfg = L.loadSeeds();
const pick = (arr, n) => (QUICK ? arr.slice(0, n) : arr);
const SEEDS = {
  calibration: pick(seedsCfg.calibration, 4),
  test: pick(seedsCfg.test, 10),
  sensitivity: pick(seedsCfg.sensitivity, 2),
};
const SCEN = Object.fromEntries(matrix.scenarios.map((s) => [s.key, s]));
const CF = 'cost-first';
const ERRRA = 'equity-constrained-rolling-horizon';
const timings = {};

function stage(name, fn) {
  if (!STAGES.includes(name)) return;
  const t0 = Date.now();
  console.log(`\n=== ${name} ===`);
  fn();
  timings[name] = (Date.now() - t0) / 1000;
  console.log(`${name} done in ${timings[name].toFixed(1)}s`);
}

// ---------------------------------------------------------------- calibration
// Wide enough to reach the plateau where larger (s, Q) no longer lowers the objective under
// disruption (pharmacy orders become capacity-capped); see docs/model-validation.md.
const CALIB_GRID = { z: [0.84, 1.28, 1.65, 2.05, 2.58, 3, 4, 5, 6, 8], qScale: [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24] };
const CALIB_MAX_EXTENSIONS = 6;
const calibPath = path.join(OUT, 'calibration/reorder-point.json');

function calibrate() {
  const rows = [];
  const best = {};
  let k = 0;
  const total = matrix.scenarios.length * CALIB_GRID.z.length * CALIB_GRID.qScale.length;
  for (const sc of matrix.scenarios) {
    let bestRow = null;
    const evaluated = new Set();
    const evalPoint = (z, qScale) => {
      const id = `${z}|${qScale}`;
      if (evaluated.has(id)) return;
      evaluated.add(id);
      const recs = SEEDS.calibration.map((seed) => L.runRecord({
        scenario: sc.scenario, scenarioKey: sc.key, policyId: 'reorder-point', seed, policyParams: { z, qScale },
      }));
      const objective = recs.reduce((s, r) => s + r.totalCost + r.weightedStockoutPenalty, 0) / recs.length;
      const row = {
        scenario: sc.key, z, qScale, objective,
        meanCost: recs.reduce((s, r) => s + r.totalCost, 0) / recs.length,
        meanWorstEF: recs.reduce((s, r) => s + r.worstRegionEssentialFillRate, 0) / recs.length,
      };
      rows.push(row);
      if (!bestRow || row.objective < bestRow.objective) bestRow = row;
    };
    const zs = [...CALIB_GRID.z];
    const qs = [...CALIB_GRID.qScale];
    for (const z of zs) {
      for (const qScale of qs) {
        k += 1;
        L.progress('calibrate', k, total);
        evalPoint(z, qScale);
      }
    }
    // Extend the grid by ×1.5 along any axis whose upper edge holds the optimum, until it moves inside.
    let extensions = 0;
    while (extensions < CALIB_MAX_EXTENSIONS && (bestRow.z === zs.at(-1) || bestRow.qScale === qs.at(-1))) {
      if (bestRow.z === zs.at(-1)) zs.push(+(zs.at(-1) * 1.5).toFixed(2));
      if (bestRow.qScale === qs.at(-1)) qs.push(+(qs.at(-1) * 1.5).toFixed(2));
      for (const z of zs) for (const qScale of qs) evalPoint(z, qScale);
      extensions += 1;
    }
    const atGridBoundary = bestRow.z === zs.at(-1) || bestRow.qScale === qs.at(-1);
    if (atGridBoundary) console.warn(`\n[calibrate] ${sc.key}: optimum still at the upper grid boundary after ${extensions} extensions (z ${bestRow.z}, qScale ${bestRow.qScale})`);
    best[sc.key] = {
      z: bestRow.z, qScale: bestRow.qScale, objective: bestRow.objective, atGridBoundary,
      extensions, zMax: zs.at(-1), qScaleMax: qs.at(-1), pointsEvaluated: evaluated.size,
    };
  }
  L.writeCsv(path.join(OUT, 'calibration/grid.csv'), rows);
  L.writeJson(calibPath, {
    objective: 'mean over calibration seeds of (total operating cost + weighted stockout penalty)',
    grid: CALIB_GRID,
    calibrationSeeds: SEEDS.calibration,
    perScenario: best,
  });
  L.writeText(path.join(TABLES, 'calibration.md'), `# Reorder-point (s,Q) calibration\n\nTuned per scenario on calibration seeds ${SEEDS.calibration[0]}–${SEEDS.calibration.at(-1)} (disjoint from test seeds). Objective: mean total cost + weighted stockout penalty. Base grid z ∈ {${CALIB_GRID.z.join(', ')}}, qScale ∈ {${CALIB_GRID.qScale.join(', ')}}; when the optimum lies on an upper edge the grid is extended by ×1.5 on that axis (at most ${CALIB_MAX_EXTENSIONS} times) until it moves inside. Large z means the tuned baseline stockpiles ahead of disruptions.\n\n${L.mdTable(['Scenario', 'z', 'qScale', 'Objective', 'Grid extensions', 'Still at edge'], Object.entries(best).map(([s, b]) => [s, b.z, b.qScale, L.fmt(b.objective, 0), b.extensions, b.atGridBoundary ? 'yes' : 'no']))}\n`);
}

function rpParams(key) {
  if (!fs.existsSync(calibPath)) throw new Error('Run the calibrate stage first');
  return JSON.parse(fs.readFileSync(calibPath, 'utf8')).perScenario[key];
}

function paramsFor(policyId, key) {
  return policyId === 'reorder-point' ? rpParams(key) : undefined;
}

// ---------------------------------------------------------------- main
const DAILY_SCENARIOS = ['S01-baseline', 'S04-surge-high', 'S09-surge-supply', 'S10-surge-supply-road', 'S14-extreme'];

function isDominatedBy(a, b) {
  const geq = b.cost <= a.cost && b.worst >= a.worst && b.unmet <= a.unmet;
  const strict = b.cost < a.cost || b.worst > a.worst || b.unmet < a.unmet;
  return geq && strict;
}

function runMain() {
  const records = [];
  const daily = {};
  let k = 0;
  const total = matrix.scenarios.length * matrix.policies.length;
  for (const sc of matrix.scenarios) {
    for (const policyId of matrix.policies) {
      k += 1;
      L.progress('main', k, total);
      const keepDaily = DAILY_SCENARIOS.includes(sc.key);
      const recs = SEEDS.test.map((seed) => L.runRecord({
        scenario: sc.scenario, scenarioKey: sc.key, policyId, seed, policyParams: paramsFor(policyId, sc.key), keepDaily,
      }));
      if (keepDaily) {
        const n = recs[0].dailyEssentialFill.length;
        daily[`${sc.key}|${policyId}`] = Array.from({ length: n }, (_, d) => recs.reduce((s, r) => s + r.dailyEssentialFill[d], 0) / recs.length);
        for (const r of recs) delete r.dailyEssentialFill;
      }
      records.push(...recs);
    }
  }
  L.writeCsv(path.join(OUT, 'main/records.csv'), records);
  L.writeJson(path.join(OUT, 'main/daily-essential-fill.json'), daily);

  const recsOf = (s, p) => records.filter((r) => r.scenario === s && r.policy === p);
  const summaryRows = [];
  const pairedRows = [];
  const poeRows = [];
  const paretoRows = [];
  const panels = [];

  for (const sc of matrix.scenarios) {
    const cf = recsOf(sc.key, CF);
    const points = [];
    for (const p of matrix.policies) {
      const recs = recsOf(sc.key, p);
      const row = { scenario: sc.key, policy: p, n: recs.length };
      for (const m of L.METRICS) {
        const s = L.summarize(recs, m.key);
        row[`${m.key}_mean`] = s?.mean;
        row[`${m.key}_ci95Low`] = s?.ci95Low;
        row[`${m.key}_ci95High`] = s?.ci95High;
      }
      const rec95 = recs.filter((r) => r.recovered95 != null);
      row.recovered95Share = rec95.length ? rec95.reduce((s, r) => s + r.recovered95, 0) / rec95.length : null;
      summaryRows.push(row);
      points.push({ policy: p, cost: row.totalCost_mean, worst: row.worstRegionEssentialFillRate_mean, unmet: row.cumulativeUnmetEssentialDemand_mean });

      if (p !== CF) {
        for (const m of L.METRICS) {
          const d = L.pairedDiff(recs, cf, m.key);
          if (d) pairedRows.push({ scenario: sc.key, policy: p, metric: m.key, better: m.better, meanDiff: d.mean, ci95Low: d.ci95Low, ci95High: d.ci95High, higherCount: d.wins, lowerCount: d.losses, n: d.n });
        }
        const dCost = L.pairedDiff(recs, cf, 'totalCost');
        const dGap = L.pairedDiff(recs, cf, 'essentialServiceGap');
        const cfGap = L.summarize(cf, 'essentialServiceGap').mean;
        const cfCost = L.summarize(cf, 'totalCost').mean;
        const gapReductionPP = -dGap.mean * 100;
        let status = 'ok';
        let costPerPP = null;
        let poeRel = null;
        if (gapReductionPP <= 1e-6) status = 'no_gap_reduction';
        else if (dCost.mean <= 0) status = 'dominant_lower_cost_and_gap';
        else {
          costPerPP = dCost.mean / gapReductionPP;
          poeRel = cfGap > 0 ? (dCost.mean / cfCost) / (gapReductionPP / 100 / cfGap) : null;
        }
        poeRows.push({ scenario: sc.key, policy: p, deltaCost: dCost.mean, deltaCostCI: `[${dCost.ci95Low.toFixed(0)}, ${dCost.ci95High.toFixed(0)}]`, gapReductionPP, costPerGapPoint: costPerPP, priceOfEquityRelative: poeRel, status });
      }
    }
    const zs = points.map((q) => q.unmet);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    for (const q of points) {
      q.efficient = !points.some((o) => o !== q && isDominatedBy(q, o));
      paretoRows.push({ scenario: sc.key, policy: q.policy, meanCost: q.cost, meanWorstRegionEssentialFill: q.worst, meanUnmetEssential: q.unmet, paretoEfficient: q.efficient });
    }
    panels.push({
      title: sc.key,
      points: points.map((q) => ({ policy: q.policy, x: q.cost, y: q.worst, z: q.unmet, efficient: q.efficient, sizeNorm: zMax > zMin ? (q.unmet - zMin) / (zMax - zMin) : 0 })),
    });
  }

  L.writeCsv(path.join(OUT, 'main/summary.csv'), summaryRows);
  L.writeCsv(path.join(OUT, 'main/paired-vs-cost-first.csv'), pairedRows);
  L.writeCsv(path.join(OUT, 'main/price-of-equity.csv'), poeRows);
  L.writeCsv(path.join(OUT, 'main/pareto.csv'), paretoRows);

  const labels = Object.fromEntries(matrix.policies.map((p) => [p, L.POLICY_LABEL[p]]));
  L.writeText(path.join(FIGS, 'pareto.svg'), svg.paretoPanels({ panels, labels, title: 'Cost vs worst-region essential fill (Pareto frontier per scenario)' }));
  for (const key of DAILY_SCENARIOS) {
    const series = matrix.policies.filter((p) => daily[`${key}|${p}`]).map((p) => ({ label: L.POLICY_LABEL[p], color: svg.COLORS[p], values: daily[`${key}|${p}`] }));
    if (series.length) {
      L.writeText(path.join(FIGS, `daily-essential-fill-${key}.svg`), svg.lineChart({
        series, title: `Daily essential fill rate, ${key} (mean of ${SEEDS.test.length} test seeds)`, xLabel: 'Day', yLabel: 'Essential fill rate', shade: matrix.phases?.disruption,
      }));
    }
  }

  const mainCols = [
    ['totalCost', 0], ['worstRegionEssentialFillRate', 3], ['essentialServiceGap', 3], ['cumulativeUnmetEssentialDemand', 0],
    ['serviceLossAUC', 2], ['timeToRecovery95', 1], ['fillRate', 3],
  ];
  const cell = (r, k, d) => (r[`${k}_mean`] == null ? 'n/a' : `${L.fmt(r[`${k}_mean`], d)} ± ${L.fmt((r[`${k}_ci95High`] - r[`${k}_ci95Low`]) / 2, d)}`);
  const mdRows = summaryRows.map((r) => [r.scenario, L.POLICY_LABEL[r.policy], ...mainCols.map(([k, d]) => cell(r, k, d)), r.recovered95Share == null ? 'n/a' : L.fmt(r.recovered95Share, 2)]);
  const headDiff = ['worstRegionEssentialFillRate', 'cumulativeUnmetEssentialDemand', 'essentialServiceGap', 'totalCost'];
  const diffRows = matrix.scenarios.map((sc) => [sc.key, ...headDiff.map((m) => {
    const d = pairedRows.find((x) => x.scenario === sc.key && x.policy === ERRRA && x.metric === m);
    const dg = m === 'totalCost' ? 0 : 3;
    return d ? `${L.fmt(d.meanDiff, dg)} [${L.fmt(d.ci95Low, dg)}, ${L.fmt(d.ci95High, dg)}] (${d.higherCount}↑/${d.lowerCount}↓)` : '—';
  })]);
  const poeMd = poeRows.filter((r) => r.policy === ERRRA || r.policy === 'equity-aware').map((r) => [
    r.scenario, L.POLICY_LABEL[r.policy], L.fmt(r.deltaCost, 0), L.fmt(r.gapReductionPP, 2),
    r.status === 'ok' ? L.fmt(r.costPerGapPoint, 1) : r.status, r.priceOfEquityRelative == null ? '—' : L.fmt(r.priceOfEquityRelative, 3),
  ]);
  const paretoMd = matrix.scenarios.map((sc) => [sc.key, paretoRows.filter((r) => r.scenario === sc.key && r.paretoEfficient).map((r) => L.POLICY_LABEL[r.policy]).join(', ')]);

  L.writeText(path.join(TABLES, 'main.md'), [
    '# Main results (synthetic; frozen matrix; test seeds)',
    '',
    `Each cell: mean ± 95% CI half-width over ${SEEDS.test.length} common-random-number test seeds. Recovery times are right-censored at the horizon (censored runs count as the maximum observable delay) and are n/a for the no-disruption baseline; "Rec95" is the share of runs that reached 95% of the pre-disruption baseline. "Unmet ess." counts essential units not filled from stock at the time of demand (they are backordered and may be served later). Results hold only 在预定义仿真场景中 and cannot be read as real-world policy effects.`,
    '',
    L.mdTable(['Scenario', 'Policy', 'Cost', 'Worst-region ess. fill', 'Ess. gap', 'Unmet ess.', 'AUC', 'T95', 'Fill', 'Rec95'], mdRows),
    '',
    '## ERRRA − cost-first (paired over seeds)',
    '',
    'Mean difference [95% CI] (number of seeds where ERRRA is higher ↑ / lower ↓). Positive is better for worst-region fill; negative is better for unmet, gap and cost.',
    '',
    L.mdTable(['Scenario', 'Δ worst-region ess. fill', 'Δ unmet ess.', 'Δ ess. gap', 'Δ cost'], diffRows),
    '',
    '## Price of Equity vs cost-first',
    '',
    'costPerGapPoint = (C_policy − C_costFirst) / (gap reduction in percentage points). priceOfEquityRelative = (ΔC / C_costFirst) / (Δgap / gap_costFirst). "dominant" = lower cost and lower gap; "no_gap_reduction" = the policy did not reduce the gap.',
    '',
    L.mdTable(['Scenario', 'Policy', 'Δ cost', 'Gap reduction (pp)', 'Cost per pp', 'PoE (relative)'], poeMd),
    '',
    '## Pareto-efficient policies (cost ↓, worst-region essential fill ↑, unmet essential ↓)',
    '',
    L.mdTable(['Scenario', 'Efficient policies'], paretoMd),
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- ablation
function runAblation() {
  const records = [];
  const scen = matrix.ablationScenarios;
  let k = 0;
  for (const key of scen) {
    for (const p of matrix.ablationPolicies) {
      k += 1;
      L.progress('ablation', k, scen.length * matrix.ablationPolicies.length);
      records.push(...SEEDS.test.map((seed) => L.runRecord({ scenario: SCEN[key].scenario, scenarioKey: key, policyId: p, seed })));
    }
  }
  L.writeCsv(path.join(OUT, 'ablation/records.csv'), records);
  const metrics = ['worstRegionEssentialFillRate', 'cumulativeUnmetEssentialDemand', 'essentialServiceGap', 'serviceLossAUC', 'totalCost'];
  const rows = [];
  for (const key of scen) {
    const full = records.filter((r) => r.scenario === key && r.policy === ERRRA);
    for (const p of matrix.ablationPolicies.filter((x) => x !== ERRRA)) {
      const recs = records.filter((r) => r.scenario === key && r.policy === p);
      const row = { scenario: key, ablation: p };
      for (const m of metrics) {
        const d = L.pairedDiff(recs, full, m);
        row[`${m}_diff`] = d.mean;
        row[`${m}_ci95Low`] = d.ci95Low;
        row[`${m}_ci95High`] = d.ci95High;
      }
      rows.push(row);
    }
  }
  L.writeCsv(path.join(OUT, 'ablation/paired-vs-full-errra.csv'), rows);
  const md = rows.map((r) => [r.scenario, L.POLICY_LABEL[r.ablation], ...metrics.map((m) => {
    const d = m === 'totalCost' || m === 'cumulativeUnmetEssentialDemand' ? 0 : 3;
    return `${L.fmt(r[`${m}_diff`], d)} [${L.fmt(r[`${m}_ci95Low`], d)}, ${L.fmt(r[`${m}_ci95High`], d)}]`;
  })]);
  L.writeText(path.join(TABLES, 'ablation.md'), `# Ablation (ablated − full ERRRA, paired over ${SEEDS.test.length} test seeds)\n\nNegative Δ worst-region fill or positive Δ unmet means the removed component was helping in that scenario.\n\n${L.mdTable(['Scenario', 'Variant', 'Δ worst-region ess. fill', 'Δ unmet ess.', 'Δ ess. gap', 'Δ AUC', 'Δ cost'], md)}\n`);
}

// ---------------------------------------------------------------- sensitivity (LHS)
const FACTORS = [
  { key: 'surge', label: 'Demand surge magnitude', lo: 1.0, hi: 2.2 },
  { key: 'supply', label: 'Supply factor during disruption', lo: 0.2, hi: 1.0 },
  { key: 'road', label: 'Rural road delay factor', lo: 1.0, hi: 2.5 },
  { key: 'lead', label: 'Lead-time extension (rural, suburban)', lo: 1.0, hi: 2.5 },
  { key: 'duration', label: 'Disruption duration (days)', lo: 10, hi: 45 },
  { key: 'capacity', label: 'Dispatch/truck capacity multiplier', lo: 0.6, hi: 1.4 },
  { key: 'inbound', label: 'Upstream inbound coverage', lo: 1.0, hi: 1.4 },
  { key: 'whStock', label: 'Warehouse initial stock (days)', lo: 5, hi: 30 },
  { key: 'ruralVuln', label: 'Rural vulnerability weight', lo: 1.0, hi: 2.0 },
  { key: 'volatility', label: 'Demand volatility scale', lo: 0.5, hi: 1.5 },
];

function lhs(n, rng) {
  const cols = FACTORS.map(() => {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return perm.map((s) => (s + rng.next()) / n);
  });
  return Array.from({ length: n }, (_, i) => Object.fromEntries(FACTORS.map((f, c) => [f.key, f.lo + cols[c][i] * (f.hi - f.lo)])));
}

function scenarioFromSample(base, x) {
  const s = JSON.parse(JSON.stringify(base));
  const start = 30;
  const all = ['urban', 'suburban', 'rural'];
  const D = Math.round(x.duration);
  s.events = [
    { type: 'demandSurge', startDay: start, durationDays: D, magnitude: x.surge, targetRegions: all },
    { type: 'supplyDisruption', startDay: start, durationDays: D, magnitude: x.supply, targetRegions: all },
    { type: 'roadDisruption', startDay: start, durationDays: D, magnitude: x.road, targetRegions: ['rural'] },
    { type: 'leadTimeExtension', startDay: start, durationDays: D, magnitude: x.lead, targetRegions: ['rural', 'suburban'] },
  ];
  s.logistics = { ...s.logistics, capacityMultiplier: x.capacity, upstreamInboundCoverage: x.inbound, warehouseInitialStockDays: x.whStock };
  s.regions = JSON.parse(JSON.stringify(s.regions));
  s.regions.rural.vulnerabilityWeight = x.ruralVuln;
  for (const r of all) s.regions[r].demandVolatility = base.regions[r].demandVolatility * x.volatility;
  return s;
}

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

function spearman(a, b) {
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Best single-threshold split separating samples where ERRRA is worse (depth-1 tree, Gini). */
function bestStump(samples, isBad) {
  const n = samples.length;
  const gini = (arr) => {
    if (!arr.length) return 0;
    const p = arr.filter(isBad).length / arr.length;
    return 2 * p * (1 - p);
  };
  let best = null;
  for (const f of FACTORS) {
    const sorted = [...samples].sort((a, b) => a.x[f.key] - b.x[f.key]);
    for (let i = 5; i < n - 5; i += 1) {
      const left = sorted.slice(0, i);
      const right = sorted.slice(i);
      const g = (left.length * gini(left) + right.length * gini(right)) / n;
      if (!best || g < best.g) {
        best = {
          g,
          factor: f.key,
          label: f.label,
          threshold: (sorted[i - 1].x[f.key] + sorted[i].x[f.key]) / 2,
          badRateBelow: left.filter(isBad).length / left.length,
          badRateAbove: right.filter(isBad).length / right.length,
          nBelow: left.length,
          nAbove: right.length,
        };
      }
    }
  }
  return best;
}

function runSensitivity() {
  const N = QUICK ? 24 : 256;
  const rng = createRng(20260926);
  const base = SCEN[matrix.sensitivityBaseScenario].scenario;
  const X = lhs(N, rng);
  const pols = [ERRRA, CF, 'equity-aware'];
  const samples = [];
  X.forEach((x, i) => {
    L.progress('sensitivity', i + 1, N);
    const scenario = scenarioFromSample(base, x);
    const res = {};
    for (const p of pols) {
      const recs = SEEDS.sensitivity.map((seed) => L.runRecord({ scenario, scenarioKey: `LHS${i}`, policyId: p, seed }));
      res[p] = Object.fromEntries(['worstRegionEssentialFillRate', 'cumulativeUnmetEssentialDemand', 'totalCost', 'essentialServiceGap'].map((m) => [m, recs.reduce((s, r) => s + r[m], 0) / recs.length]));
    }
    samples.push({
      i,
      x,
      errraWorst: res[ERRRA].worstRegionEssentialFillRate,
      cfWorst: res[CF].worstRegionEssentialFillRate,
      eqWorst: res['equity-aware'].worstRegionEssentialFillRate,
      dWorst: res[ERRRA].worstRegionEssentialFillRate - res[CF].worstRegionEssentialFillRate,
      dUnmet: res[ERRRA].cumulativeUnmetEssentialDemand - res[CF].cumulativeUnmetEssentialDemand,
      dCost: res[ERRRA].totalCost - res[CF].totalCost,
      dGap: res[ERRRA].essentialServiceGap - res[CF].essentialServiceGap,
      dWorstVsEq: res[ERRRA].worstRegionEssentialFillRate - res['equity-aware'].worstRegionEssentialFillRate,
    });
  });
  L.writeCsv(path.join(OUT, 'sensitivity/lhs-samples.csv'), samples.map((s) => ({ i: s.i, ...s.x, errraWorst: s.errraWorst, cfWorst: s.cfWorst, eqWorst: s.eqWorst, dWorst: s.dWorst, dUnmet: s.dUnmet, dCost: s.dCost, dGap: s.dGap, dWorstVsEq: s.dWorstVsEq })));

  const outcomes = [
    ['dWorst', 'Δ worst-region ess. fill (ERRRA − CF)'],
    ['dUnmet', 'Δ unmet essential (ERRRA − CF)'],
    ['dCost', 'Δ cost (ERRRA − CF)'],
    ['errraWorst', 'ERRRA worst-region ess. fill'],
  ];
  const importance = FACTORS.map((f) => {
    const row = { factor: f.key, label: f.label, lo: f.lo, hi: f.hi };
    for (const [o] of outcomes) row[`rho_${o}`] = spearman(samples.map((s) => s.x[f.key]), samples.map((s) => s[o]));
    return row;
  });
  L.writeCsv(path.join(OUT, 'sensitivity/importance.csv'), importance);

  const TOL = 0.01;
  const better = samples.filter((s) => s.dWorst > TOL);
  const worse = samples.filter((s) => s.dWorst < -TOL);
  const failAbs = samples.filter((s) => s.errraWorst < 0.5);
  const worseUnmet = samples.filter((s) => s.dUnmet > 0);
  const stumpIf = (list, pred) => (list.length ? bestStump(samples, pred) : null);
  const worseStump = stumpIf(worse, (s) => s.dWorst < -TOL);
  const worseUnmetStump = stumpIf(worseUnmet, (s) => s.dUnmet > 0);
  const failStump = stumpIf(failAbs, (s) => s.errraWorst < 0.5);
  const quint = FACTORS.map((f) => {
    const sorted = [...samples].sort((a, b) => a.x[f.key] - b.x[f.key]);
    const q = 5;
    const cells = [];
    for (let k = 0; k < q; k += 1) {
      const part = sorted.slice(Math.floor((k * N) / q), Math.floor(((k + 1) * N) / q));
      cells.push(part.reduce((s, p) => s + p.dWorst, 0) / part.length);
    }
    return { factor: f.key, label: f.label, cells };
  });
  L.writeJson(path.join(OUT, 'sensitivity/regions.json'), {
    tolerance: TOL,
    nSamples: N,
    seeds: SEEDS.sensitivity,
    betterCount: better.length,
    worseCount: worse.length,
    tieCount: N - better.length - worse.length,
    errraAbsoluteFailureCount: failAbs.length,
    worseOnUnmetEssentialCount: worseUnmet.length,
    factors: FACTORS,
    worseSplit: worseStump,
    worseOnUnmetSplit: worseUnmetStump,
    absoluteFailureSplit: failStump,
    quintileMeanDWorst: quint,
  });

  const sorted = [...importance].sort((a, b) => Math.abs(b.rho_dWorst) - Math.abs(a.rho_dWorst));
  L.writeText(path.join(FIGS, 'tornado-dworst.svg'), svg.tornado({
    rows: sorted.map((r) => ({ label: r.label, value: r.rho_dWorst })),
    title: 'Sensitivity of Δ worst-region essential fill (ERRRA − cost-first)',
    xLabel: `Spearman rank correlation (LHS, N = ${N}, ${SEEDS.sensitivity.length} seeds per sample)`,
  }));
  const sortedCost = [...importance].sort((a, b) => Math.abs(b.rho_dCost) - Math.abs(a.rho_dCost));
  L.writeText(path.join(FIGS, 'tornado-dcost.svg'), svg.tornado({
    rows: sortedCost.map((r) => ({ label: r.label, value: r.rho_dCost })),
    title: 'Sensitivity of Δ cost (ERRRA − cost-first)',
    xLabel: `Spearman rank correlation (LHS, N = ${N})`,
  }));

  const stumpTxt = (s, what) => (s ? `Best single split for "${what}": **${s.label} ≤ ${s.threshold.toFixed(2)}** → rate ${L.fmt(s.badRateBelow * 100, 0)}% (n=${s.nBelow}); above → ${L.fmt(s.badRateAbove * 100, 0)}% (n=${s.nAbove}).` : `No LHS sample met "${what}".`);
  L.writeText(path.join(TABLES, 'sensitivity.md'), [
    `# Global sensitivity (Latin hypercube, N = ${N}, base ${matrix.sensitivityBaseScenario}, sensitivity seeds ${SEEDS.sensitivity.join(', ')})`,
    '',
    'Importance = Spearman rank correlation between each factor and the outcome across LHS samples (|ρ| ranks importance; sign gives direction).',
    '',
    L.mdTable(['Factor', 'Range', 'ρ Δworst', 'ρ Δunmet', 'ρ Δcost', 'ρ ERRRA worst'], sorted.map((r) => [r.label, `${r.lo}–${r.hi}`, L.fmt(r.rho_dWorst, 2), L.fmt(r.rho_dUnmet, 2), L.fmt(r.rho_dCost, 2), L.fmt(r.rho_errraWorst, 2)])),
    '',
    '## Where ERRRA does better or worse than cost-first (worst-region essential fill, tolerance ±0.01)',
    '',
    `Better: ${better.length}/${N}; worse: ${worse.length}/${N}; tie: ${N - better.length - worse.length}/${N}. ERRRA absolute failure (worst-region essential fill < 0.5): ${failAbs.length}/${N}.`,
    '',
    stumpTxt(worseStump, 'ERRRA worse than cost-first on worst-region essential fill'),
    '',
    `ERRRA has more unmet essential demand than cost-first in ${worseUnmet.length}/${N} samples. ${stumpTxt(worseUnmetStump, 'ERRRA more unmet essential demand than cost-first')}`,
    '',
    stumpTxt(failStump, 'ERRRA worst-region fill < 0.5'),
    '',
    '### Mean Δ worst-region essential fill by factor quintile (Q1 = lowest values)',
    '',
    L.mdTable(['Factor', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'], quint.map((q) => [q.label, ...q.cells.map((c) => L.fmt(c, 3))])),
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- stress grid
function runStress() {
  const base = SCEN['S10-surge-supply-road'].scenario;
  const surges = [1.0, 1.5, 2.0, 2.5, 3.0];
  const supplies = [1.0, 0.7, 0.5, 0.3, 0.1];
  const seeds = SEEDS.test.slice(0, QUICK ? 3 : 20);
  const rows = [];
  let k = 0;
  for (const sp of supplies) {
    for (const su of surges) {
      k += 1;
      L.progress('stress', k, surges.length * supplies.length);
      const s = JSON.parse(JSON.stringify(base));
      s.events = s.events.map((e) => (e.type === 'demandSurge' ? { ...e, magnitude: su } : e.type === 'supplyDisruption' ? { ...e, magnitude: sp } : e));
      for (const p of matrix.policies) {
        const recs = seeds.map((seed) => L.runRecord({ scenario: s, scenarioKey: `surge${su}-supply${sp}`, policyId: p, seed, policyParams: p === 'reorder-point' ? rpParams('S10-surge-supply-road') : undefined }));
        rows.push({
          surge: su, supply: sp, policy: p,
          worstRegionEssentialFillRate: recs.reduce((a, r) => a + r.worstRegionEssentialFillRate, 0) / recs.length,
          cumulativeUnmetEssentialDemand: recs.reduce((a, r) => a + r.cumulativeUnmetEssentialDemand, 0) / recs.length,
          totalCost: recs.reduce((a, r) => a + r.totalCost, 0) / recs.length,
        });
      }
    }
  }
  L.writeCsv(path.join(OUT, 'stress/grid.csv'), rows);
  const get = (su, sp, p, m) => rows.find((r) => r.surge === su && r.supply === sp && r.policy === p)?.[m];
  const values = supplies.map((sp) => surges.map((su) => get(su, sp, ERRRA, 'worstRegionEssentialFillRate') - get(su, sp, CF, 'worstRegionEssentialFillRate')));
  L.writeText(path.join(FIGS, 'stress-dworst-heatmap.svg'), svg.heatmap({
    xs: surges.map((x) => `×${x}`), ys: supplies.map((x) => `${x}`), values,
    title: 'Δ worst-region essential fill, ERRRA − cost-first (S10 structure)', xLabel: 'Demand surge magnitude', yLabel: 'Supply factor',
    fmtCell: (v) => (v >= 0 ? '+' : '') + v.toFixed(3),
  }));
  const bestPolicy = supplies.map((sp) => surges.map((su) => {
    const cand = matrix.policies.map((p) => [p, get(su, sp, p, 'worstRegionEssentialFillRate')]).sort((a, b) => b[1] - a[1]);
    return `${L.POLICY_LABEL[cand[0][0]]} (${cand[0][1].toFixed(2)})`;
  }));
  const allFail = [];
  for (const sp of supplies) for (const su of surges) if (matrix.policies.every((p) => get(su, sp, p, 'worstRegionEssentialFillRate') < 0.5)) allFail.push(`surge ×${su}, supply ${sp}`);
  L.writeText(path.join(TABLES, 'stress.md'), [
    `# Stress grid (S10 structure: surge × supply, rural road ×2; ${seeds.length} test seeds per cell)`,
    '',
    '## Δ worst-region essential fill (ERRRA − cost-first)',
    '',
    L.mdTable(['Supply \\ Surge', ...surges.map((x) => `×${x}`)], supplies.map((sp, j) => [sp, ...values[j].map((v) => L.fmt(v, 3))])),
    '',
    '## Best policy by worst-region essential fill',
    '',
    L.mdTable(['Supply \\ Surge', ...surges.map((x) => `×${x}`)], supplies.map((sp, j) => [sp, ...bestPolicy[j]])),
    '',
    `## Cells where every policy has worst-region essential fill < 0.5 (failure region)\n\n${allFail.length ? allFail.map((c) => `- ${c}`).join('\n') : 'None.'}`,
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- CI stability
function runCiStability() {
  const file = path.join(OUT, 'main/records.csv');
  if (!fs.existsSync(file)) throw new Error('Run the main stage first');
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = head.split(',');
  const recs = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], Number.isNaN(Number(v)) || v === '' ? v : Number(v)])));
  const ns = [10, 20, 30, 50, 75, 100].filter((n) => n <= SEEDS.test.length);
  const rows = [];
  for (const key of ['S04-surge-high', 'S09-surge-supply', 'S10-surge-supply-road', 'S14-extreme']) {
    for (const metric of ['worstRegionEssentialFillRate', 'totalCost']) {
      const a = recs.filter((r) => r.scenario === key && r.policy === ERRRA);
      const b = recs.filter((r) => r.scenario === key && r.policy === CF);
      for (const n of ns) {
        const seeds = new Set(SEEDS.test.slice(0, n));
        const d = L.pairedDiff(a.filter((r) => seeds.has(r.seed)), b.filter((r) => seeds.has(r.seed)), metric);
        rows.push({ scenario: key, metric, n, meanDiff: d.mean, halfWidth: (d.ci95High - d.ci95Low) / 2, excludesZero: d.ci95Low > 0 || d.ci95High < 0 });
      }
    }
  }
  L.writeCsv(path.join(OUT, 'ci-stability/paired-ci-by-n.csv'), rows);
  L.writeText(path.join(TABLES, 'ci-stability.md'), `# CI stability of the ERRRA − cost-first paired difference\n\nFirst n test seeds (in the frozen order). A stable conclusion keeps its sign and CI-excludes-zero status as n grows.\n\n${L.mdTable(['Scenario', 'Metric', 'n', 'Mean Δ', '95% CI half-width', 'CI excludes 0'], rows.map((r) => [r.scenario, r.metric, r.n, L.fmt(r.meanDiff, r.metric === 'totalCost' ? 0 : 4), L.fmt(r.halfWidth, r.metric === 'totalCost' ? 0 : 4), r.excludesZero ? 'yes' : 'no']))}\n`);
}

// ---------------------------------------------------------------- cross-model check
function runCrossModel() {
  const configs = [
    { warehouses: 1, floor: 1 }, { warehouses: 1, floor: 0.8 },
    { warehouses: 2, floor: 1 }, { warehouses: 2, floor: 0.8 },
  ];
  const n = QUICK ? 50 : 500;
  const rows = configs.map((c, i) => {
    const r = crossCheck({ n, seed: 1000 + i, ...c });
    return { warehouses: c.warehouses, floor: c.floor, n: r.n, exactMatches: r.exactMatches, exactShare: r.exactMatches / r.n, meanGap: r.meanGap, maxGap: r.maxGap };
  });
  L.writeCsv(path.join(OUT, 'cross-model/stage1-vs-exhaustive.csv'), rows);
  L.writeText(path.join(TABLES, 'cross-model.md'), `# ERRRA stage 1 vs exhaustive enumeration (small integer instances)\n\nObjective: max over integer allocations of min_r min(φ, SR_r). Random instances: 3 regions, 1–2 lines per region, needs 2–8, capacity 1–12 per warehouse, unit batch, β = 0.\n\n${L.mdTable(['Warehouses', 'Floor φ', 'Instances', 'Exactly optimal', 'Mean gap', 'Max gap'], rows.map((r) => [r.warehouses, r.floor, r.n, `${r.exactMatches} (${L.fmt(r.exactShare * 100, 1)}%)`, L.fmt(r.meanGap, 4), L.fmt(r.maxGap, 4)]))}\n`);
}

// ---------------------------------------------------------------- scenario and parameter tables
function runDocs() {
  const { POLICIES } = require(path.join(L.ROOT, 'server/simulation/policyEngine'));
  const evText = (e) => {
    const where = e.targetRegions.length === 3 ? 'all regions' : e.targetRegions.join('+');
    return `${e.type} ×${e.magnitude} (${where}, day ${e.startDay}–${e.startDay + e.durationDays - 1})`;
  };
  const scenRows = matrix.scenarios.map((s) => {
    const lg = s.scenario.logistics;
    return [s.key, s.label, s.scenario.events.length ? s.scenario.events.map(evText).join('; ') : 'none',
      lg.capacityMultiplier ?? 1, lg.upstreamInboundCoverage, lg.warehouseInitialStockDays, lg.pharmacyInitialStockDays];
  });
  const base = matrix.scenarios[0].scenario;
  const regionRows = Object.entries(base.regions).map(([rt, r]) => [rt, base.regionPharmacyCounts[rt], r.population, r.baseDemand, r.demandVolatility, r.distanceKm, r.roadAccessibility, r.transitDays, r.vulnerabilityWeight]);
  const drugRows = base.drugs.map((d) => [d.id, d.priority, d.unitProcurementCost, d.holdingCostPerUnitDay, d.stockoutPenalty, d.leadTimeDays]);
  const lg = base.logistics;
  const logRows = Object.entries(lg).map(([k, v]) => [k, v]);
  const polRows = Object.values(POLICIES).map((p) => [p.id, p.version, `\`${JSON.stringify(p.params)}\``, p.rationing || 'rank']);
  L.writeText(path.join(TABLES, 'scenarios.md'), `# Frozen scenario matrix v${matrix.matrixVersion}\n\nHorizon ${matrix.horizonDays} days: warm-up [0,30), disruption [30,60), recovery [60,120). ${matrix.scenarios.length} scenarios; ${seedsCfg.test.length} common-random-number test seeds each. All values synthetic.\n\n${L.mdTable(['Key', 'Label', 'Events', 'Capacity ×', 'Inbound coverage', 'WH stock (days)', 'Pharmacy stock (days)'], scenRows)}\n\nMatrix revisions: ${(matrix.revisions || []).map((r) => `v${r.version}: ${r.change}${r.reason ? ` — ${r.reason}` : ''}`).join(' ')}\n`);
  L.writeText(path.join(TABLES, 'parameters.md'), [
    '# Model parameters (synthetic, illustrative)',
    '',
    `Network: ${base.warehouseCount} warehouses, ${base.pharmacyCount} pharmacies, ${base.drugs.length} SKUs, ${base.simulationDays} days.`,
    '',
    '## Regions',
    '',
    L.mdTable(['Region', 'Pharmacies', 'Population', 'Base demand /1000', 'Volatility (CV)', 'Distance km', 'Road accessibility', 'Base transit days', 'Vulnerability v_r'], regionRows),
    '',
    '## SKUs (priority demand scale: essential 1.2, chronic-care 1.0, routine 0.75)',
    '',
    L.mdTable(['SKU', 'Priority', 'Procurement c', 'Holding h /unit·day', 'Stockout penalty p', 'Lead time days'], drugRows),
    '',
    '## Logistics (base network)',
    '',
    L.mdTable(['Parameter', 'Value'], logRows),
    '',
    '## Policies (defaults; reorder-point z and qScale are replaced by per-scenario calibration)',
    '',
    L.mdTable(['Policy', 'Version', 'Parameters', 'Shortage rationing'], polRows),
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- run
const t0 = Date.now();
if (!stageArg || STAGES.includes('docs')) stage('docs', runDocs);
stage('calibrate', calibrate);
stage('main', runMain);
stage('ablation', runAblation);
stage('sensitivity', runSensitivity);
stage('stress', runStress);
stage('ciStability', runCiStability);
stage('crossModel', runCrossModel);

let commit = null;
try { commit = execSync('git rev-parse HEAD', { cwd: L.ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
const manifestPath = path.join(OUT, 'manifest.json');
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
L.writeJson(manifestPath, {
  synthetic: true,
  disclaimer: 'All data are synthetic. Conclusions hold only 在预定义仿真场景中 and must not be read as real-world policy effects.',
  engineVersion: L.ENGINE_VERSION,
  matrixVersion: matrix.matrixVersion,
  matrixSha256: L.sha256File(L.MATRIX_PATH),
  seedsSha256: L.sha256File(L.SEEDS_PATH),
  gitCommit: commit,
  node: process.version,
  quick: QUICK,
  seedsUsed: { calibration: SEEDS.calibration.length, test: SEEDS.test.length, sensitivity: SEEDS.sensitivity.length },
  errraParams: ERRRA_DEFAULTS,
  stageSeconds: { ...(prev.stageSeconds || {}), ...timings },
  generatedAt: new Date().toISOString(),
});
console.log(`\nAll requested stages finished in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(L.ROOT, OUT)}`);
