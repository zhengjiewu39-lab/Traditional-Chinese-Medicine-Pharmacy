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
 * The (s,Q) baseline is tuned per SKU × region type on calibration seeds; every reported number
 * uses test seeds (or the dedicated sensitivity seeds). ERRRA parameters are the a-priori defaults.
 * Every run passes the engine's mandatory inventory audit (a failure aborts the pipeline).
 */

const path = require('path');
const fs = require('fs');
const L = require('./lib');
const svg = require('./svg');
const { createRng } = require(path.join(L.ROOT, 'server/simulation/rng'));
const { crossCheck } = require(path.join(L.ROOT, 'server/simulation/validation/exhaustiveStage1'));
const { ERRRA_DEFAULTS, POLICIES } = require(path.join(L.ROOT, 'server/simulation/policyEngine'));
const { cdf: normCdf } = require(path.join(L.ROOT, 'server/simulation/normalDist'));
const { getGitCommitHash, getCommitSource } = require(path.join(L.ROOT, 'server/simulation/gitInfo'));
const { BOOTSTRAP_SEED } = require(path.join(L.ROOT, 'server/simulation/metricsEngine'));

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
  calibration: pick(seedsCfg.calibration, 3),
  test: pick(seedsCfg.test, 8),
  sensitivity: pick(seedsCfg.sensitivity, 2),
};
const SCEN = Object.fromEntries(matrix.scenarios.map((s) => [s.key, s]));
const CF = 'cost-first';
const EQ = 'equity-aware';
const ERRRA = 'equity-constrained-rolling-horizon';
const DEFAULT_KEY = 'M5-compound';
const timings = {};
const auditByStage = {};
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

function stage(name, fn) {
  if (!STAGES.includes(name)) return;
  const t0 = process.hrtime.bigint();
  const a0 = L.auditCount();
  console.log(`\n=== ${name} ===`);
  fn();
  timings[name] = Number(process.hrtime.bigint() - t0) / 1e9;
  auditByStage[name] = L.auditCount() - a0;
  console.log(`${name} done in ${timings[name].toFixed(1)}s`);
}

// ---------------------------------------------------------------- calibration
const CALIB_GRID = { z: [0.5, 1, 1.65, 2.5, 3.5, 5, 7, 10], qScale: [0.5, 1, 2, 3, 5, 8, 12, 18] };
const CALIB_MAX_EXTENSIONS = 4;
const calibPath = path.join(OUT, 'calibration/reorder-point.json');
const groupCost = (g) => g.procurement + g.transport + g.orderFixed + g.pharmacyHolding + g.stockoutPenalty;

/**
 * Per scenario: evaluate a uniform (z, qScale) grid on calibration seeds, recording total objective
 * (total cost + weighted stockout penalty) and the separable cost attributed to every SKU × region
 * group. Each group takes the grid point that minimizes its own attributed cost; the resulting
 * per-line setting is kept only if it beats the best uniform point on the full objective, otherwise
 * the best uniform point is used (guard against interactions through shared capacity).
 */
function calibrate() {
  const rows = [];
  const best = {};
  let k = 0;
  const total = matrix.scenarios.length;
  for (const sc of matrix.scenarios) {
    k += 1;
    L.progress('calibrate', k, total);
    const points = new Map();
    const evalPoint = (z, qScale) => {
      const id = `${z}|${qScale}`;
      if (points.has(id)) return points.get(id);
      const recs = SEEDS.calibration.map((seed) => L.runRecord({
        scenario: sc.scenario, scenarioKey: sc.key, policyId: 'reorder-point', seed, policyParams: { z, qScale, perLine: null }, keepGroups: true,
      }));
      const groups = {};
      for (const r of recs) for (const [g, c] of Object.entries(r.groupCosts)) groups[g] = (groups[g] || 0) + groupCost(c) / recs.length;
      const p = { z, qScale, objective: mean(recs.map((r) => r.totalCost + r.weightedStockoutPenalty)), groups };
      points.set(id, p);
      rows.push({ scenario: sc.key, z, qScale, objective: p.objective });
      return p;
    };
    const zs = [...CALIB_GRID.z];
    const qs = [...CALIB_GRID.qScale];
    const bestUniform = () => [...points.values()].reduce((b, p) => (!b || p.objective < b.objective ? p : b), null);
    for (const z of zs) for (const q of qs) evalPoint(z, q);
    let extensions = 0;
    while (extensions < CALIB_MAX_EXTENSIONS && (bestUniform().z === zs.at(-1) || bestUniform().qScale === qs.at(-1))) {
      const b = bestUniform();
      if (b.z === zs.at(-1)) zs.push(+(zs.at(-1) * 1.5).toFixed(2));
      if (b.qScale === qs.at(-1)) qs.push(+(qs.at(-1) * 1.5).toFixed(2));
      for (const z of zs) for (const q of qs) evalPoint(z, q);
      extensions += 1;
    }
    const uni = bestUniform();
    const perLine = {};
    for (const g of Object.keys(uni.groups)) {
      let bp = null;
      for (const p of points.values()) if (!bp || p.groups[g] < bp.groups[g] - 1e-9) bp = p;
      perLine[g] = { z: bp.z, qScale: bp.qScale };
    }
    const perLineRecs = SEEDS.calibration.map((seed) => L.runRecord({
      scenario: sc.scenario, scenarioKey: sc.key, policyId: 'reorder-point', seed, policyParams: { z: uni.z, qScale: uni.qScale, perLine },
    }));
    const perLineObjective = mean(perLineRecs.map((r) => r.totalCost + r.weightedStockoutPenalty));
    const usePerLine = perLineObjective < uni.objective;
    best[sc.key] = {
      z: uni.z,
      qScale: uni.qScale,
      perLine: usePerLine ? perLine : null,
      uniformObjective: uni.objective,
      perLineObjective,
      chosen: usePerLine ? 'per SKU × region' : 'uniform (per-line did not improve)',
      atGridBoundary: uni.z === zs.at(-1) || uni.qScale === qs.at(-1),
      extensions,
      pointsEvaluated: points.size,
      perLineCandidate: perLine,
    };
  }
  L.writeCsv(path.join(OUT, 'calibration/grid.csv'), rows);
  L.writeJson(calibPath, {
    objective: 'mean over calibration seeds of (total operating cost + weighted stockout penalty)',
    method: 'uniform grid, per-group argmin of attributed cost, guarded by full-objective comparison',
    grid: CALIB_GRID,
    calibrationSeeds: SEEDS.calibration,
    perScenario: best,
  });
  const md = Object.entries(best).map(([s, b]) => {
    const pl = b.perLine ? Object.entries(b.perLine).map(([g, v]) => `${g}: ${v.z}/${v.qScale}`).join('; ') : '—';
    return [s, `${b.z} / ${b.qScale}`, L.fmt(b.uniformObjective, 0), L.fmt(b.perLineObjective, 0), b.chosen, `${b.extensions}${b.atGridBoundary ? ' (still at edge)' : ''}`, pl];
  });
  L.writeText(path.join(TABLES, 'calibration.md'), `# (s,Q) baseline calibration (per SKU × region type)\n\nTuned per scenario on calibration seeds ${SEEDS.calibration[0]}–${SEEDS.calibration.at(-1)} only (disjoint from test and sensitivity seeds). Objective: mean total cost + weighted stockout penalty. Uniform grid z ∈ {${CALIB_GRID.z.join(', ')}}, qScale ∈ {${CALIB_GRID.qScale.join(', ')}}, extended ×1.5 on an axis whose upper edge holds the optimum (at most ${CALIB_MAX_EXTENSIONS} times). Each SKU × region group then takes the grid point minimizing its own attributed cost (procurement, transport, fixed order, pharmacy holding, stockout penalty); that per-line setting is used only if it lowers the full objective below the best uniform point.\n\n${L.mdTable(['Scenario', 'Best uniform z / qScale', 'Uniform objective', 'Per-line objective', 'Chosen', 'Grid extensions', 'Per-line z/qScale'], md)}\n`);
}

function rpParams(key) {
  if (!fs.existsSync(calibPath)) throw new Error('Run the calibrate stage first');
  const b = JSON.parse(fs.readFileSync(calibPath, 'utf8')).perScenario[key];
  return { z: b.z, qScale: b.qScale, perLine: b.perLine };
}

function paramsFor(policyId, key) {
  return policyId === 'reorder-point' ? rpParams(key) : undefined;
}

// ---------------------------------------------------------------- main
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
      const recs = SEEDS.test.map((seed) => L.runRecord({
        scenario: sc.scenario, scenarioKey: sc.key, policyId, seed, policyParams: paramsFor(policyId, sc.key), keepDaily: true,
      }));
      const n = recs[0].dailyEssentialFill.length;
      daily[`${sc.key}|${policyId}`] = Array.from({ length: n }, (_, d) => mean(recs.map((r) => r.dailyEssentialFill[d])));
      for (const r of recs) delete r.dailyEssentialFill;
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
        row[`${m.key}_sd`] = s?.std;
        row[`${m.key}_ci95Low`] = s?.ci95Low;
        row[`${m.key}_ci95High`] = s?.ci95High;
      }
      const rec90 = recs.filter((r) => r.recovered90 != null);
      const rec95 = recs.filter((r) => r.recovered95 != null);
      const rec99 = recs.filter((r) => r.recovered99 != null);
      row.recovered90Share = rec90.length ? mean(rec90.map((r) => r.recovered90)) : null;
      row.recovered95Share = rec95.length ? mean(rec95.map((r) => r.recovered95)) : null;
      row.recovered99Share = rec99.length ? mean(rec99.map((r) => r.recovered99)) : null;
      row.kaplanMeierMedianRecovery95 = rec95.length ? L.kaplanMeierMedianRecovery(recs) : null;
      row.restrictedMeanRecovery95 = rec95.length ? L.restrictedMeanRecovery(recs) : null;
      summaryRows.push(row);
      points.push({ policy: p, cost: row.totalCost_mean, worst: row.worstRegionEssentialFillRate_mean, unmet: row.cumulativeUnmetDemand_mean });

      const dRel = L.pairedDiff(recs, cf, 'totalCost', (a, b) => (a - b) / b);
      const dWorst = L.pairedDiff(recs, cf, 'worstRegionEssentialFillRate');
      const dCost = L.pairedDiff(recs, cf, 'totalCost');
      const pp = dWorst.mean * 100;
      const gain = dWorst.ci95Low > 0 && pp >= L.MID_WORST_REGION_FILL_PP;
      const gainExploratory = dWorst.ci95Low > 0 && pp < L.MID_WORST_REGION_FILL_PP;
      const extra = dCost.ci95Low > 0;
      let status = 'ok';
      if (p === CF) status = 'reference';
      else if (gainExploratory) status = 'gain_below_mid';
      else if (!gain) status = dWorst.ci95High < 0 ? 'worst_region_loss' : 'gain_not_significant';
      else if (!extra) status = dCost.ci95High < 0 ? 'gain_at_lower_cost' : 'extra_cost_not_significant';
      poeRows.push({
        scenario: sc.key,
        policy: p,
        priceOfEquity: dRel.mean,
        priceOfEquityCi95Low: dRel.ci95Low,
        priceOfEquityCi95High: dRel.ci95High,
        deltaCost: dCost.mean,
        deltaWorstRegionEssentialFillPP: pp,
        deltaWorstRegionEssentialFillPPCi95Low: dWorst.ci95Low * 100,
        deltaWorstRegionEssentialFillPPCi95High: dWorst.ci95High * 100,
        costPerWorstRegionPP: status === 'ok' ? dCost.mean / pp : null,
        status,
      });
    }
    for (let i = 0; i < matrix.policies.length; i += 1) {
      for (let j = i + 1; j < matrix.policies.length; j += 1) {
        const a = matrix.policies[i];
        const b = matrix.policies[j];
        for (const m of L.METRICS) {
          const d = L.pairedDiff(recsOf(sc.key, a), recsOf(sc.key, b), m.key);
          if (d) {
            const inference = L.isPrimaryComparison(sc.key, a, b, m.key) ? 'primary' : 'exploratory';
            pairedRows.push({
              scenario: sc.key, policyA: a, policyB: b, metric: m.key, better: m.better, inference,
              meanDiff: d.mean, sd: d.std, ci95Low: d.ci95Low, ci95High: d.ci95High, aHigher: d.wins, aLower: d.losses, ties: d.ties, n: d.n,
              pRaw: L.bootstrapPValue(d),
            });
          }
        }
      }
    }
    const zs = points.map((q) => q.unmet);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    for (const q of points) {
      q.efficient = !points.some((o) => o !== q && isDominatedBy(q, o));
      paretoRows.push({ scenario: sc.key, policy: q.policy, meanCost: q.cost, meanWorstRegionEssentialFill: q.worst, meanCumulativeUnmet: q.unmet, paretoEfficient: q.efficient });
    }
    panels.push({
      title: sc.key,
      points: points.map((q) => ({ policy: q.policy, x: q.cost, y: q.worst, z: q.unmet, efficient: q.efficient, sizeNorm: zMax > zMin ? (q.unmet - zMin) / (zMax - zMin) : 0 })),
    });
  }

  L.writeCsv(path.join(OUT, 'main/summary.csv'), summaryRows);
  const exploratory = pairedRows.filter((r) => r.inference === 'exploratory');
  const holm = L.holmAdjust(exploratory.map((r, i) => ({ id: i, pRaw: r.pRaw })));
  exploratory.forEach((r, i) => { r.pHolm = holm.get(i); });
  L.writeCsv(path.join(OUT, 'main/paired-all-pairs.csv'), pairedRows);
  L.writeCsv(path.join(OUT, 'main/price-of-equity.csv'), poeRows);
  L.writeCsv(path.join(OUT, 'main/pareto.csv'), paretoRows);

  const labels = Object.fromEntries(matrix.policies.map((p) => [p, L.POLICY_LABEL[p]]));
  L.writeText(path.join(FIGS, 'pareto.svg'), svg.paretoPanels({ panels, labels, title: 'Cost vs worst-region essential fill (Pareto frontier per scenario)' }));
  for (const sc of matrix.scenarios) {
    const series = matrix.policies.map((p) => ({ label: L.POLICY_LABEL[p], color: svg.COLORS[p], values: daily[`${sc.key}|${p}`] }));
    L.writeText(path.join(FIGS, `daily-essential-fill-${sc.key}.svg`), svg.lineChart({
      series, title: `Daily essential fill rate, ${sc.key} (mean of ${SEEDS.test.length} test seeds)`, xLabel: 'Day', yLabel: 'Essential fill rate', shade: matrix.phases?.disruption,
    }));
  }

  const summaryOf = (s, p) => summaryRows.find((r) => r.scenario === s && r.policy === p);
  const msc = (r, m) => (r[`${m.key}_mean`] == null ? 'n/a' : `${L.fmt(r[`${m.key}_mean`], m.digits)} (${L.fmt(r[`${m.key}_sd`], m.digits)}) [${L.fmt(r[`${m.key}_ci95Low`], m.digits)}, ${L.fmt(r[`${m.key}_ci95High`], m.digits)}]`);
  const defaultTable = L.METRICS.map((m) => [`${m.label} (${m.better} better; ${m.unit})`, ...matrix.policies.map((p) => msc(summaryOf(DEFAULT_KEY, p), m))]);
  const keyMetrics = ['worstRegionEssentialFillRate', 'regionalServiceGap', 'cumulativeUnmetDemand', 'p95WaitingTime', 'restrictedRecoveryTime95', 'totalCost'].map((k2) => L.METRICS.find((m) => m.key === k2));
  const cell = (r, m) => (r[`${m.key}_mean`] == null ? 'n/a' : `${L.fmt(r[`${m.key}_mean`], m.digits)} ± ${L.fmt((r[`${m.key}_ci95High`] - r[`${m.key}_ci95Low`]) / 2, m.digits)}`);
  const matrixRows = summaryRows.map((r) => [r.scenario, L.POLICY_LABEL[r.policy], ...keyMetrics.map((m) => cell(r, m))]);
  const pairText = (s, a, b, key) => {
    const d = pairedRows.find((x) => x.scenario === s && x.policyA === a && x.policyB === b && x.metric === key)
      || pairedRows.find((x) => x.scenario === s && x.policyA === b && x.policyB === a && x.metric === key);
    if (!d) return '—';
    const sign = d.policyA === a ? 1 : -1;
    const m = L.METRICS.find((x) => x.key === key);
    const lo = sign > 0 ? d.ci95Low : -d.ci95High;
    const hi = sign > 0 ? d.ci95High : -d.ci95Low;
    const excl = lo > 0 || hi < 0;
    let tag = '';
    if (d.inference === 'primary' && excl) tag = '*';
    else if (d.inference === 'exploratory' && d.pHolm != null && d.pHolm <= 0.05) tag = '†';
    return `${L.fmt(sign * d.meanDiff, m.digits)} [${L.fmt(lo, m.digits)}, ${L.fmt(hi, m.digits)}]${tag}`;
  };
  const cmpMetrics = ['worstRegionEssentialFillRate', 'regionalServiceGap', 'cumulativeUnmetDemand', 'p95WaitingTime', 'totalCost'];
  const cmpBlocks = [[ERRRA, CF], [ERRRA, EQ], [ERRRA, 'reorder-point'], [EQ, CF]].map(([a, b]) => [
    `### ${L.POLICY_LABEL[a]} − ${L.POLICY_LABEL[b]}`,
    '',
    L.mdTable(['Scenario', ...cmpMetrics.map((k2) => `Δ ${L.METRICS.find((m) => m.key === k2).label}`)], matrix.scenarios.map((sc) => [sc.key, ...cmpMetrics.map((k2) => pairText(sc.key, a, b, k2))])),
    '',
  ].join('\n'));
  const poeMd = poeRows.filter((r) => r.policy !== CF).map((r) => [
    r.scenario, L.POLICY_LABEL[r.policy],
    `${L.fmt(r.priceOfEquity * 100, 2)}% [${L.fmt(r.priceOfEquityCi95Low * 100, 2)}, ${L.fmt(r.priceOfEquityCi95High * 100, 2)}]`,
    `${L.fmt(r.deltaWorstRegionEssentialFillPP, 2)} [${L.fmt(r.deltaWorstRegionEssentialFillPPCi95Low, 2)}, ${L.fmt(r.deltaWorstRegionEssentialFillPPCi95High, 2)}]`,
    r.costPerWorstRegionPP == null ? r.status.replace(/_/g, ' ') : L.fmt(r.costPerWorstRegionPP, 0),
  ]);
  const paretoMd = matrix.scenarios.map((sc) => [sc.key, paretoRows.filter((r) => r.scenario === sc.key && r.paretoEfficient).map((r) => L.POLICY_LABEL[r.policy]).join(', ')]);

  L.writeText(path.join(TABLES, 'main.md'), [
    '# Main results (synthetic scenarios; frozen matrix; test seeds)',
    '',
    `All values from ${SEEDS.test.length} common-random-number test seeds per cell. Paired differences use a percentile bootstrap over seeds (${2000} resamples, fixed bootstrap seed ${BOOTSTRAP_SEED}). **Primary inference** (pre-registered): scenario ${L.PRIMARY_SCENARIO}, ${L.POLICY_LABEL[L.PRIMARY_COMPARISON.policyA]} vs ${L.POLICY_LABEL[L.PRIMARY_COMPARISON.policyB]}, outcome ${L.PRIMARY_OUTCOME}; * marks a 95% CI excluding 0. All other policy × scenario × metric cells are **exploratory**; † marks Holm-adjusted p ≤ 0.05 among exploratory pairs only. Minimum important difference for worst-region essential fill: ${L.MID_WORST_REGION_FILL_PP} pp. Recovery: sustained 7-day smoothed essential fill at p·baseline starting only after shock end; null if censored; restricted recovery time uses the horizon cap for censored runs (not “recovered on day 60”). Results describe synthetic scenario assumptions (合成场景假设) only.`,
    '',
    `## Default scenario ${DEFAULT_KEY}: mean (SD) [95% CI]`,
    '',
    L.mdTable(['Metric', ...matrix.policies.map((p) => L.POLICY_LABEL[p])], defaultTable),
    '',
    '## Scenario matrix (mean ± 95% CI half-width)',
    '',
    L.mdTable(['Scenario', 'Policy', ...keyMetrics.map((m) => m.label)], matrixRows),
    '',
    '## Paired differences (A − B, bootstrap 95% CI); all 10 policy pairs × 15 metrics are in results/main/paired-all-pairs.csv',
    '',
    ...cmpBlocks,
    '## Price of Equity relative to cost-only',
    '',
    'PoE = mean over seeds of (C_policy − C_cost-only) / C_cost-only, bootstrap 95% CI. "Cost per pp" = Δ total cost per percentage point of worst-region essential fill gained over cost-only, computed only when both the gain and the extra cost have 95% CIs above 0; otherwise the reason is shown.',
    '',
    L.mdTable(['Scenario', 'Policy', 'PoE [95% CI]', 'Δ worst-region ess. fill, pp [95% CI]', 'Cost per pp'], poeMd),
    '',
    '## Pareto-efficient policies (cost ↓, worst-region essential fill ↑, cumulative unmet ↓)',
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
  const metrics = ['worstRegionEssentialFillRate', 'regionalServiceGap', 'cumulativeUnmetDemand', 'p95WaitingTime', 'totalCost'];
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
    const d = L.METRICS.find((x) => x.key === m).digits;
    const excl = r[`${m}_ci95Low`] > 0 || r[`${m}_ci95High`] < 0 ? '*' : '';
    return `${L.fmt(r[`${m}_diff`], d)} [${L.fmt(r[`${m}_ci95Low`], d)}, ${L.fmt(r[`${m}_ci95High`], d)}]${excl}`;
  })]);
  L.writeText(path.join(TABLES, 'ablation.md'), `# Ablation (ablated − full ERRRA, paired bootstrap over ${SEEDS.test.length} test seeds)\n\nNegative Δ worst-region fill or positive Δ unmet means the removed component was helping in that scenario. * = 95% CI excludes 0. Lateral transfers and backup suppliers are network mechanisms available to every policy; their ablations switch them off for ERRRA only.\n\n${L.mdTable(['Scenario', 'Variant', 'Δ worst-region ess. fill', 'Δ regional gap', 'Δ cumulative unmet', 'Δ p95 wait', 'Δ cost'], md)}\n`);
}

// ---------------------------------------------------------------- sensitivity (LHS + PRCC)
const FACTORS = [
  { key: 'surge', label: 'Demand surge magnitude', lo: 1.0, hi: 2.2 },
  { key: 'duration', label: 'Disruption duration (days)', lo: 10, hi: 45 },
  { key: 'leadTime', label: 'Primary supplier lead time (days)', lo: 1, hi: 6 },
  { key: 'whStock', label: 'Warehouse initial stock (days)', lo: 4, hi: 20 },
  { key: 'transport', label: 'Transport capacity (× baseline demand)', lo: 1.0, hi: 2.0 },
  { key: 'floor', label: 'ERRRA minimum service floor φ', lo: 0.8, hi: 1.0 },
  { key: 'ruralVuln', label: 'Rural vulnerability weight', lo: 1.0, hi: 3.0 },
  { key: 'transferCost', label: 'Lateral transfer cost per unit', lo: 0, hi: 3 },
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
  const D = Math.round(x.duration);
  s.events = s.events.map((e) => ({ ...e, durationDays: D, ...(e.type === 'demandSurge' ? { magnitude: x.surge } : {}) }));
  const lead = Math.max(1, Math.round(x.leadTime));
  s.supplyNetwork = {
    ...s.supplyNetwork,
    primary: { ...s.supplyNetwork.primary, replenishmentLeadTime: lead },
    backup: { ...s.supplyNetwork.backup, replenishmentLeadTime: lead + 3 },
  };
  s.logistics = {
    ...s.logistics,
    warehouseInitialStockDays: x.whStock,
    warehouseTargetStockDays: x.whStock,
    dispatchCapacityCoverage: x.transport,
    truckCapacityCoverage: x.transport,
    lateralTransfers: { ...s.logistics.lateralTransfers, costPerUnit: x.transferCost },
  };
  s.regions = JSON.parse(JSON.stringify(s.regions));
  s.regions.rural.vulnerabilityWeight = x.ruralVuln;
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

/** Least-squares residuals of y on the columns of X (with intercept), via normal equations. */
function residuals(X, y) {
  const n = y.length;
  const A = X.map((row) => [1, ...row]);
  const p = A[0].length;
  const M = Array.from({ length: p }, (_, i) => Array.from({ length: p + 1 }, (_, j) => {
    let s = 0;
    for (let r = 0; r < n; r += 1) s += A[r][i] * (j < p ? A[r][j] : y[r]);
    return s;
  }));
  for (let c = 0; c < p; c += 1) {
    let piv = c;
    for (let r = c + 1; r < p; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r = 0; r < p; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= p; j += 1) M[r][j] -= f * M[c][j];
    }
  }
  const beta = M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[p] / row[i]));
  return y.map((v, r) => v - A[r].reduce((s, a, j) => s + a * beta[j], 0));
}

function corr(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/**
 * Partial rank correlation coefficient of each factor with outcome y (rank-transform, then correlate
 * the residuals of factor j and of y after linear regression on all other ranked factors).
 * p-value from t = r·√((n − 2 − q)/(1 − r²)), q = number of other factors, normal approximation.
 */
function prcc(samples, outcomeKey) {
  const n = samples.length;
  const R = FACTORS.map((f) => ranks(samples.map((s) => s.x[f.key])));
  const ry = ranks(samples.map((s) => s[outcomeKey]));
  return FACTORS.map((f, j) => {
    const others = Array.from({ length: n }, (_, r) => R.filter((_, c) => c !== j).map((col) => col[r]));
    const r = corr(residuals(others, R[j]), residuals(others, ry));
    const df = n - 2 - (FACTORS.length - 1);
    const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
    return { factor: f.key, prcc: r, p: 2 * (1 - normCdf(Math.abs(t))) };
  });
}

function runSensitivity() {
  const N = QUICK ? 24 : 256;
  const rng = createRng(20260926);
  const base = SCEN[matrix.sensitivityBaseScenario].scenario;
  const X = lhs(N, rng);
  const pols = [ERRRA, CF, EQ];
  const samples = [];
  X.forEach((x, i) => {
    L.progress('sensitivity', i + 1, N);
    const scenario = scenarioFromSample(base, x);
    const res = {};
    for (const p of pols) {
      const policyParams = p === ERRRA ? { serviceFloor: x.floor } : undefined;
      const recs = SEEDS.sensitivity.map((seed) => L.runRecord({ scenario, scenarioKey: `LHS${i}`, policyId: p, seed, policyParams }));
      res[p] = Object.fromEntries(['worstRegionEssentialFillRate', 'cumulativeUnmetDemand', 'totalCost', 'regionalServiceGap'].map((m) => [m, mean(recs.map((r) => r[m]))]));
    }
    samples.push({
      i,
      x,
      errraWorst: res[ERRRA].worstRegionEssentialFillRate,
      cfWorst: res[CF].worstRegionEssentialFillRate,
      eqWorst: res[EQ].worstRegionEssentialFillRate,
      dWorst: res[ERRRA].worstRegionEssentialFillRate - res[CF].worstRegionEssentialFillRate,
      dUnmet: res[ERRRA].cumulativeUnmetDemand - res[CF].cumulativeUnmetDemand,
      dCost: res[ERRRA].totalCost - res[CF].totalCost,
      dGap: res[ERRRA].regionalServiceGap - res[CF].regionalServiceGap,
    });
  });
  L.writeCsv(path.join(OUT, 'sensitivity/lhs-samples.csv'), samples.map((s) => ({ i: s.i, ...s.x, errraWorst: s.errraWorst, cfWorst: s.cfWorst, eqWorst: s.eqWorst, dWorst: s.dWorst, dUnmet: s.dUnmet, dCost: s.dCost, dGap: s.dGap })));

  const outcomes = [
    ['dWorst', 'Δ worst-region ess. fill (ERRRA − cost-only)'],
    ['dUnmet', 'Δ cumulative unmet (ERRRA − cost-only)'],
    ['dCost', 'Δ cost (ERRRA − cost-only)'],
    ['errraWorst', 'ERRRA worst-region ess. fill'],
  ];
  const byOutcome = Object.fromEntries(outcomes.map(([o]) => [o, prcc(samples, o)]));
  const importance = FACTORS.map((f, j) => {
    const row = { factor: f.key, label: f.label, lo: f.lo, hi: f.hi };
    for (const [o] of outcomes) {
      row[`prcc_${o}`] = byOutcome[o][j].prcc;
      row[`p_${o}`] = byOutcome[o][j].p;
    }
    return row;
  });
  L.writeCsv(path.join(OUT, 'sensitivity/prcc.csv'), importance);

  const TOL = 0.01;
  const better = samples.filter((s) => s.dWorst > TOL);
  const worse = samples.filter((s) => s.dWorst < -TOL);
  L.writeJson(path.join(OUT, 'sensitivity/summary.json'), {
    method: 'Latin hypercube sampling + partial rank correlation coefficients (PRCC)',
    nSamples: N,
    seeds: SEEDS.sensitivity,
    tolerance: TOL,
    betterCount: better.length,
    worseCount: worse.length,
    tieCount: N - better.length - worse.length,
    factors: FACTORS,
  });
  const sorted = [...importance].sort((a, b) => Math.abs(b.prcc_dWorst) - Math.abs(a.prcc_dWorst));
  L.writeText(path.join(FIGS, 'tornado-dworst.svg'), svg.tornado({
    rows: sorted.map((r) => ({ label: r.label, value: r.prcc_dWorst })),
    title: 'PRCC of Δ worst-region essential fill (ERRRA − cost-only)',
    xLabel: `Partial rank correlation (LHS, N = ${N}, ${SEEDS.sensitivity.length} seeds per sample)`,
  }));
  const sortedCost = [...importance].sort((a, b) => Math.abs(b.prcc_dCost) - Math.abs(a.prcc_dCost));
  L.writeText(path.join(FIGS, 'tornado-dcost.svg'), svg.tornado({
    rows: sortedCost.map((r) => ({ label: r.label, value: r.prcc_dCost })),
    title: 'PRCC of Δ cost (ERRRA − cost-only)',
    xLabel: `Partial rank correlation (LHS, N = ${N})`,
  }));
  const fp = (r, o) => `${L.fmt(r[`prcc_${o}`], 2)}${r[`p_${o}`] < 0.05 ? '*' : ''}`;
  L.writeText(path.join(TABLES, 'sensitivity.md'), [
    `# Global sensitivity (LHS + PRCC, N = ${N}, base ${matrix.sensitivityBaseScenario}, sensitivity seeds ${SEEDS.sensitivity.join(', ')})`,
    '',
    'PRCC = partial rank correlation between a factor and the outcome, controlling for the other seven factors; * = p < 0.05 (t approximation). The floor φ affects ERRRA only; the other factors change the shared scenario.',
    '',
    L.mdTable(['Factor', 'Range', 'PRCC Δworst', 'PRCC Δunmet', 'PRCC Δcost', 'PRCC ERRRA worst'], sorted.map((r) => [r.label, `${r.lo}–${r.hi}`, fp(r, 'dWorst'), fp(r, 'dUnmet'), fp(r, 'dCost'), fp(r, 'errraWorst')])),
    '',
    `ERRRA − cost-only on worst-region essential fill (tolerance ±${TOL}): better in ${better.length}/${N} samples, worse in ${worse.length}/${N}, tie in ${N - better.length - worse.length}/${N}.`,
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- stress grid
function runStress() {
  const base = SCEN[DEFAULT_KEY].scenario;
  const surges = [1.0, 1.5, 2.0, 2.5, 3.0];
  const supplies = [1.0, 0.7, 0.5, 0.3, 0.0];
  const seeds = SEEDS.test.slice(0, QUICK ? 3 : 20);
  const rows = [];
  let k = 0;
  for (const sp of supplies) {
    for (const su of surges) {
      k += 1;
      L.progress('stress', k, surges.length * supplies.length);
      const s = JSON.parse(JSON.stringify(base));
      s.events = s.events.map((e) => {
        if (e.type === 'demandSurge') return { ...e, magnitude: su };
        if (e.type === 'supplyDisruption') return { ...e, magnitude: sp };
        return e;
      });
      for (const p of matrix.policies) {
        const recs = seeds.map((seed) => L.runRecord({ scenario: s, scenarioKey: `surge${su}-supply${sp}`, policyId: p, seed, policyParams: paramsFor(p, DEFAULT_KEY) }));
        rows.push({
          surge: su, primarySupply: sp, policy: p,
          worstRegionEssentialFillRate: mean(recs.map((r) => r.worstRegionEssentialFillRate)),
          cumulativeUnmetDemand: mean(recs.map((r) => r.cumulativeUnmetDemand)),
          totalCost: mean(recs.map((r) => r.totalCost)),
        });
      }
    }
  }
  L.writeCsv(path.join(OUT, 'stress/grid.csv'), rows);
  const get = (su, sp, p, m) => rows.find((r) => r.surge === su && r.primarySupply === sp && r.policy === p)?.[m];
  const values = supplies.map((sp) => surges.map((su) => get(su, sp, ERRRA, 'worstRegionEssentialFillRate') - get(su, sp, CF, 'worstRegionEssentialFillRate')));
  L.writeText(path.join(FIGS, 'stress-dworst-heatmap.svg'), svg.heatmap({
    xs: surges.map((x) => `×${x}`), ys: supplies.map((x) => `${x}`), values,
    title: `Δ worst-region essential fill, ERRRA − cost-only (${DEFAULT_KEY} structure)`, xLabel: 'Demand surge magnitude', yLabel: 'Primary supplier capacity factor',
    fmtCell: (v) => (v >= 0 ? '+' : '') + v.toFixed(3),
  }));
  const bestPolicy = supplies.map((sp) => surges.map((su) => {
    const cand = matrix.policies.map((p) => [p, get(su, sp, p, 'worstRegionEssentialFillRate')]).sort((a, b) => b[1] - a[1]);
    return `${L.POLICY_LABEL[cand[0][0]]} (${cand[0][1].toFixed(2)})`;
  }));
  const allFail = [];
  for (const sp of supplies) for (const su of surges) if (matrix.policies.every((p) => get(su, sp, p, 'worstRegionEssentialFillRate') < 0.5)) allFail.push(`surge ×${su}, primary supply ${sp}`);
  L.writeText(path.join(TABLES, 'stress.md'), [
    `# Stress grid (${DEFAULT_KEY} structure: surge × primary-supplier capacity, backup 0.4, rural road ×2; ${seeds.length} test seeds per cell)`,
    '',
    '## Δ worst-region essential fill (ERRRA − cost-only)',
    '',
    L.mdTable(['Primary supply \\ Surge', ...surges.map((x) => `×${x}`)], supplies.map((sp, j) => [sp, ...values[j].map((v) => L.fmt(v, 3))])),
    '',
    '## Best policy by worst-region essential fill',
    '',
    L.mdTable(['Primary supply \\ Surge', ...surges.map((x) => `×${x}`)], supplies.map((sp, j) => [sp, ...bestPolicy[j]])),
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
  if (!ns.length) ns.push(SEEDS.test.length);
  const rows = [];
  for (const key of ['M2-demand-surge', 'M3-supply-disruption', 'M5-compound', 'M9-extreme']) {
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
  L.writeText(path.join(TABLES, 'ci-stability.md'), `# Convergence of the ERRRA − cost-only paired difference\n\nFirst n test seeds (frozen order), paired bootstrap 95% CI. A stable conclusion keeps its sign and CI-excludes-zero status as n grows; the half-width shrinks roughly as 1/√n.\n\n${L.mdTable(['Scenario', 'Metric', 'n', 'Mean Δ', '95% CI half-width', 'CI excludes 0'], rows.map((r) => [r.scenario, r.metric, r.n, L.fmt(r.meanDiff, r.metric === 'totalCost' ? 0 : 4), L.fmt(r.halfWidth, r.metric === 'totalCost' ? 0 : 4), r.excludesZero ? 'yes' : 'no']))}\n`);
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
  const evText = (e) => {
    const days = `day ${e.startDay + 1}–${e.startDay + e.durationDays}`;
    if (e.type === 'supplyDisruption') {
      const scope = e.targetSuppliers?.join('+') || `${e.supplierTier || 'primary'} suppliers${e.targetWarehouses ? ` of ${e.targetWarehouses.join('+')}` : ''}`;
      return `supply ×${e.magnitude} (${scope}, ${days})`;
    }
    const where = !e.targetRegions || e.targetRegions.length === 3 ? 'all regions' : e.targetRegions.join('+');
    return `${e.type} ×${e.magnitude} (${where}, ${days})`;
  };
  const scenRows = matrix.scenarios.map((s) => {
    const lg = s.scenario.logistics;
    const sn = s.scenario.supplyNetwork;
    return [s.key, s.label, s.scenario.events.length ? s.scenario.events.map(evText).join('; ') : 'none',
      lg.capacityMultiplier ?? 1, `${lg.dispatchCapacityCoverage} / ${lg.truckCapacityCoverage}`, lg.warehouseInitialStockDays,
      `${sn.primary.replenishmentLeadTime} / ${sn.backup.replenishmentLeadTime}`, s.scenarioHash.slice(0, 12)];
  });
  const base = SCEN[DEFAULT_KEY].scenario;
  const regionRows = Object.entries(base.regions).map(([rt, r]) => [rt, base.regionPharmacyCounts[rt], r.population, r.baseDemand, r.demandVolatility, r.distanceKm, r.roadAccessibility, r.transitDays, r.vulnerabilityWeight]);
  const drugRows = base.drugs.map((d) => [d.id, d.priority, d.unitProcurementCost, d.holdingCostPerUnitDay, d.stockoutPenalty, d.leadTimeDays]);
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
  const polRows = Object.values(POLICIES).map((p) => [p.shortName || p.id, p.id, p.version, `\`${JSON.stringify(p.params)}\``, p.rationing || 'rank']);
  L.writeText(path.join(TABLES, 'scenarios.md'), `# Frozen scenario matrix v${matrix.matrixVersion}\n\nHorizon ${matrix.horizonDays} days: warm-up days 1–30, shock days 31–60, recovery days 61–120. ${matrix.scenarios.length} scenarios; ${seedsCfg.test.length} common-random-number test seeds each. All values are synthetic scenario assumptions (合成场景假设).\n\n${L.mdTable(['Key', 'Label', 'Events', 'Capacity ×', 'Dispatch / truck coverage', 'WH stock (days)', 'Supplier lead primary / backup', 'Scenario hash'], scenRows)}\n\nMatrix revisions:\n\n${(matrix.revisions || []).map((r) => `- v${r.version}: ${r.change}${r.reason ? ` — ${r.reason}` : ''}`).join('\n')}\n`);
  L.writeText(path.join(TABLES, 'parameters.md'), [
    '# Model parameters (synthetic scenario assumptions, 合成场景假设)',
    '',
    `Network: ${base.warehouseCount} warehouses, ${base.pharmacyCount} pharmacies, ${base.drugs.length} SKUs, ${base.simulationDays} days. None of these values is estimated from real data.`,
    '',
    '## Regions',
    '',
    L.mdTable(['Region', 'Pharmacies', 'Population', 'Base demand /1000', 'Volatility (CV)', 'Distance km', 'Road accessibility', 'Base transit days', 'Vulnerability v_r'], regionRows),
    '',
    '## SKUs (priority demand scale: essential 1.2, chronic-care 1.0, routine 0.75)',
    '',
    L.mdTable(['SKU', 'Priority', 'Procurement c', 'Holding h /unit·day', 'Stockout penalty p', 'Lead time days'], drugRows),
    '',
    '## Logistics, supply network and lateral transfers (default scenario)',
    '',
    L.mdTable(['Parameter', 'Value'], [...flat(base.logistics, 'logistics.'), ...flat(base.supplyNetwork, 'supplyNetwork.')]),
    '',
    '## Metric weights',
    '',
    L.mdTable(['Parameter', 'Value'], [...flat(base.metricsWeights, 'metricsWeights.'), ...flat(base.policyWeights, 'policyWeights.')]),
    '',
    '## Policies (defaults; the (s,Q) z and qScale are replaced by per-scenario calibration)',
    '',
    L.mdTable(['Name', 'Id', 'Version', 'Parameters', 'Shortage rationing'], polRows),
    '',
  ].join('\n'));
}

// ---------------------------------------------------------------- run
const t0 = process.hrtime.bigint();
if (!stageArg || STAGES.includes('docs')) stage('docs', runDocs);
stage('calibrate', calibrate);
stage('main', runMain);
stage('ablation', runAblation);
stage('sensitivity', runSensitivity);
stage('stress', runStress);
stage('ciStability', runCiStability);
stage('crossModel', runCrossModel);

const manifestPath = path.join(OUT, 'manifest.json');
const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const { RELEASE_VERSION, ERRA_HEURISTIC_VERSION } = require(path.join(L.ROOT, 'server/simulation/releaseVersions'));

L.writeJson(manifestPath, {
  synthetic: true,
  disclaimer: 'All data are synthetic. Conclusions hold only within the predefined simulation scenarios (在预定义仿真场景中) and must not be read as real-world policy effects.',
  releaseVersion: RELEASE_VERSION,
  engineVersion: L.ENGINE_VERSION,
  matrixVersion: matrix.matrixVersion,
  errraHeuristicVersion: ERRA_HEURISTIC_VERSION,
  primaryAnalysis: {
    scenario: L.PRIMARY_SCENARIO,
    comparison: L.PRIMARY_COMPARISON,
    outcome: L.PRIMARY_OUTCOME,
    keySecondaryOutcomes: L.KEY_SECONDARY_OUTCOMES,
    midWorstRegionFillPP: L.MID_WORST_REGION_FILL_PP,
  },
  matrixSha256: L.sha256File(L.MATRIX_PATH),
  seedsSha256: L.sha256File(L.SEEDS_PATH),
  gitCommit: getGitCommitHash(),
  gitCommitSource: getCommitSource(),
  node: process.version,
  nodeMajor: Number(process.versions.node.split('.')[0]),
  quick: QUICK,
  seedsUsed: { calibration: SEEDS.calibration.length, test: SEEDS.test.length, sensitivity: SEEDS.sensitivity.length },
  bootstrap: { resamples: 2000, seed: BOOTSTRAP_SEED },
  errraParams: ERRRA_DEFAULTS,
  inventoryAudit: {
    runsAuditedByStage: { ...(prev.inventoryAudit?.runsAuditedByStage || {}), ...auditByStage },
    failures: 0,
    rule: 'every run ends with the three-level stock balance audit; any mismatch throws and aborts the pipeline',
  },
  stageSeconds: { ...(prev.stageSeconds || {}), ...timings },
  generatedAt: new Date().toISOString(),
});
console.log(`\nAll requested stages finished in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)}s → ${path.relative(L.ROOT, OUT)}; ${L.auditCount()} runs passed the inventory audit`);
