/**
 * Shared helpers for the paper pipeline: loading the frozen matrix and seeds, running one
 * replicate into a flat record, statistics, CSV/Markdown writers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '../..');
const { runSimulation } = require(path.join(ROOT, 'server/simulation/simulationEngine'));
const { stats } = require(path.join(ROOT, 'server/simulation/metricsEngine'));
const { ENGINE_VERSION } = require(path.join(ROOT, 'server/simulation/simulationConstants'));

const MATRIX_PATH = path.join(ROOT, 'paper/config/scenario-matrix.json');
const SEEDS_PATH = path.join(ROOT, 'paper/config/seeds.json');

function loadMatrix() {
  return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
}

function loadSeeds() {
  return JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'));
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

const POLICY_LABEL = {
  'fixed-allocation': 'Fixed allocation',
  'reorder-point': 'Tuned (s,Q)',
  'cost-first': 'Cost-first',
  'equity-aware': 'Equity-aware (weighted)',
  'equity-constrained-rolling-horizon': 'ERRRA',
  'errra-no-floor': 'ERRRA − floor',
  'errra-no-vulnerability': 'ERRRA − vulnerability',
  'errra-no-rolling': 'ERRRA − rolling horizon',
  'errra-no-essential-priority': 'ERRRA − essential priority',
  'errra-no-compound-awareness': 'ERRRA − compound awareness',
};

/** Recovery times are right-censored at (horizon − disruption end); see docs/metrics.md. */
function recoveryValue(res, key, censorAt) {
  const v = res?.[key];
  return v == null ? censorAt : v;
}

function runRecord({ scenario, scenarioKey, policyId, seed, policyParams, keepDaily = false }) {
  const r = runSimulation({ scenario: { ...scenario, randomSeed: seed }, policyId, policyParams, logLevel: 'summary' });
  const m = r.metrics;
  const res = m.resilience || {};
  const hasDisruption = res.firstDisruptionStartDay != null && res.lastDisruptionEndDay != null && res.lastDisruptionEndDay >= 0;
  const censorAt = hasDisruption ? Math.max(0, scenario.simulationDays - res.lastDisruptionEndDay) : null;
  const rec = {
    scenario: scenarioKey,
    policy: policyId,
    seed,
    totalCost: m.totalCost,
    procurementCost: m.costs.procurement,
    transportCost: m.costs.transport,
    orderFixedCost: m.costs.orderFixed,
    holdingCost: m.costs.pharmacyHolding + m.costs.warehouseHolding,
    fillRate: m.fillRate,
    essentialFillRate: m.essentialFillRate,
    worstRegionEssentialFillRate: m.worstRegionEssentialFillRate,
    worstRegionEssentialFillRatePostOnset: m.worstRegionEssentialFillRatePostOnset,
    minRegionalServiceLevel: m.minRegionalServiceLevel,
    essentialServiceGap: m.essentialServiceGap,
    cumulativeUnmetEssentialDemand: m.cumulativeUnmetEssentialDemand,
    maxBacklog: m.maxBacklog,
    backlogAtHorizon: m.backlogAtHorizon,
    serviceLossAUC: m.serviceLossAUC,
    avgSyntheticAccessDelayDays: m.avgSyntheticAccessDelayDays,
    timeToRecovery90: hasDisruption ? recoveryValue(res, 'timeToRecovery90', censorAt) : null,
    timeToRecovery95: hasDisruption ? recoveryValue(res, 'timeToRecovery95', censorAt) : null,
    timeToRecovery99: hasDisruption ? recoveryValue(res, 'timeToRecovery99', censorAt) : null,
    recovered95: hasDisruption ? (res.recoveredWithinHorizon?.timeToRecovery95 ? 1 : 0) : null,
    recoverySlope: hasDisruption ? res.recoverySlope : null,
    weightedStockoutPenalty: m.penalties.weightedStockoutPenalty,
  };
  if (keepDaily) rec.dailyEssentialFill = r.runLog.daily.map((d) => d.dailyEssentialFillRate);
  return rec;
}

const METRICS = [
  { key: 'totalCost', label: 'Total cost', unit: 'synthetic currency', better: 'lower', digits: 0 },
  { key: 'worstRegionEssentialFillRate', label: 'Worst-region essential fill', unit: 'fraction [0,1]', better: 'higher', digits: 3 },
  { key: 'minRegionalServiceLevel', label: 'Min regional service', unit: 'fraction [0,1]', better: 'higher', digits: 3 },
  { key: 'essentialServiceGap', label: 'Essential service gap', unit: 'fraction [0,1]', better: 'lower', digits: 3 },
  { key: 'cumulativeUnmetEssentialDemand', label: 'Unmet essential demand', unit: 'units', better: 'lower', digits: 0 },
  { key: 'maxBacklog', label: 'Max backlog', unit: 'units', better: 'lower', digits: 0 },
  { key: 'backlogAtHorizon', label: 'Backlog at horizon', unit: 'units', better: 'lower', digits: 0 },
  { key: 'serviceLossAUC', label: 'Service-loss AUC', unit: 'fill-rate·days', better: 'lower', digits: 2 },
  { key: 'timeToRecovery90', label: 'T90', unit: 'days after disruption end (censored)', better: 'lower', digits: 1 },
  { key: 'timeToRecovery95', label: 'T95', unit: 'days after disruption end (censored)', better: 'lower', digits: 1 },
  { key: 'timeToRecovery99', label: 'T99', unit: 'days after disruption end (censored)', better: 'lower', digits: 1 },
  { key: 'fillRate', label: 'Overall fill', unit: 'fraction [0,1]', better: 'higher', digits: 3 },
];

function numeric(vals) {
  return vals.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

function summarize(records, key) {
  const vals = numeric(records.map((r) => r[key]));
  return vals.length ? stats(vals) : null;
}

/** Paired difference (a − b) over common seeds. */
function pairedDiff(recsA, recsB, key) {
  const bySeed = new Map(recsB.map((r) => [r.seed, r]));
  const diffs = [];
  for (const a of recsA) {
    const b = bySeed.get(a.seed);
    if (b && typeof a[key] === 'number' && typeof b[key] === 'number') diffs.push(a[key] - b[key]);
  }
  if (!diffs.length) return null;
  const s = stats(diffs);
  return { ...s, wins: diffs.filter((d) => d > 1e-12).length, losses: diffs.filter((d) => d < -1e-12).length };
}

function csvEscape(v) {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(Number.isInteger(v) ? v : Number(v.toPrecision(10))) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows, columns) {
  const cols = columns || Object.keys(rows[0] || {});
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(','));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function mdTable(header, rows) {
  const out = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

function fmt(v, digits = 3) {
  if (v == null || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtCI(s, digits = 3) {
  if (!s) return '—';
  return `${fmt(s.mean, digits)} [${fmt(s.ci95Low, digits)}, ${fmt(s.ci95High, digits)}]`;
}

function progress(label, i, n) {
  if (process.stdout.isTTY) process.stdout.write(`\r${label} ${i}/${n}   `);
  else if (i === n || i % Math.max(1, Math.floor(n / 10)) === 0) console.log(`${label} ${i}/${n}`);
  if (i === n && process.stdout.isTTY) process.stdout.write('\n');
}

module.exports = {
  ROOT,
  ENGINE_VERSION,
  MATRIX_PATH,
  SEEDS_PATH,
  POLICY_LABEL,
  METRICS,
  loadMatrix,
  loadSeeds,
  sha256File,
  runRecord,
  summarize,
  pairedDiff,
  stats,
  writeCsv,
  writeJson,
  writeText,
  mdTable,
  fmt,
  fmtCI,
  progress,
};
