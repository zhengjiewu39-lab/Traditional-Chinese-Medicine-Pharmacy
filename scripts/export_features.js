#!/usr/bin/env node
/**
 * Export TCM prescription features + labels for Python ML experiments.
 * Usage:
 *   node scripts/export_features.js --input benchmarks/prescription-review-dataset.json --out experiments/data/tcm/features_v1.csv
 *   node scripts/export_features.js --input experiments/data/tcm/synth_n500.json --out experiments/data/tcm/features_synth.csv --format json
 */

const fs = require('fs');
const path = require('path');
const { parseHerbs, extractFeatures } = require('../server/services/prescriptionAnalyzer');
const { loadRules } = require('../server/services/ruleLoader');

const FEATURE_NAMES = require('../server/config/ml-weights.json').features;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: 'benchmarks/prescription-review-dataset.json',
    out: 'experiments/data/tcm/features_v1.csv',
    format: 'csv',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '--dataset') opts.input = args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--format') opts.format = args[++i];
  }
  return opts;
}

function loadCases(filePath) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  return raw.cases || raw;
}

function rowFromCase(c, rules) {
  const input = {
    prescription: c.prescription,
    diagnosis: c.diagnosis,
    patientAge: c.patientAge,
    patientGender: c.patientGender,
  };
  const herbs = parseHerbs(c.prescription);
  const features = extractFeatures(input, herbs, rules);
  const label = c.expertLabel || c.label;
  const row = { id: c.id, label };
  for (const f of FEATURE_NAMES) row[f] = features[f] ?? 0;
  return row;
}

function toCsv(rows) {
  const cols = ['id', 'label', ...FEATURE_NAMES];
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push(cols.map(c => r[c]).join(','));
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs();
  const rules = loadRules();
  const cases = loadCases(opts.input);
  const rows = cases.map(c => rowFromCase(c, rules));

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });

  if (opts.format === 'json') {
    fs.writeFileSync(opts.out, JSON.stringify({ features: FEATURE_NAMES, rows }, null, 2));
  } else {
    fs.writeFileSync(opts.out, toCsv(rows));
  }

  console.log(`Exported ${rows.length} rows → ${opts.out}`);
  console.log(`Features: ${FEATURE_NAMES.join(', ')}`);
}

if (require.main === module) main();
module.exports = { rowFromCase, loadCases, FEATURE_NAMES };
