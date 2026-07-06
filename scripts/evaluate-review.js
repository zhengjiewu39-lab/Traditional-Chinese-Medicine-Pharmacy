#!/usr/bin/env node
/**
 * Reproducible evaluation: baseline vs rule engine vs ML classifier
 * Usage: node scripts/evaluate-review.js [--output benchmarks/results/latest.json]
 */

const fs = require('fs');
const path = require('path');

const ruleEngine = require('../server/services/prescriptionAnalyzer');
const baselineNaive = require('../server/services/baselineAnalyzer');
const baselineKeyword = require('../server/services/baselineKeywordAnalyzer');
const mlEngine = require('../server/services/mlPrescriptionClassifier');
const cdssEngine = require('../server/services/cdssEngine');

const DATASET = process.env.TCM_EVAL_DATASET
  || (fs.existsSync(path.join(__dirname, '../benchmarks/prescription-review-dataset-expanded.json'))
    ? path.join(__dirname, '../benchmarks/prescription-review-dataset-expanded.json')
    : path.join(__dirname, '../benchmarks/prescription-review-dataset.json'));
const LABELS = ['approved', 'review', 'needs_revision'];

const ENGINES = {
  'baseline-naive': baselineNaive,
  'baseline-keyword': baselineKeyword,
  'rule-engine-v3': ruleEngine,
  'ml-interpretable-v1': mlEngine,
  'cdss-dual-track-v1': cdssEngine,
};

function predictLabel(analyzer, sample) {
  const input = {
    prescription: sample.prescription,
    diagnosis: sample.diagnosis,
    patientAge: sample.patientAge,
    patientGender: sample.patientGender,
  };
  const result = analyzer.analyzePrescription(input);
  return result.label || ruleEngine.mapStatusToLabel(result.status);
}

function computeMetrics(yTrue, yPred) {
  const n = yTrue.length;
  let correct = 0;
  const perClass = {};
  for (const c of LABELS) {
    perClass[c] = { tp: 0, fp: 0, fn: 0, support: 0 };
  }
  for (let i = 0; i < n; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    if (t === p) correct++;
    perClass[t].support++;
    if (t === p) perClass[t].tp++;
    else {
      perClass[t].fn++;
      perClass[p].fp++;
    }
  }
  const accuracy = correct / n;
  let macroP = 0; let macroR = 0; let macroF1 = 0; let count = 0;
  const report = {};
  for (const c of LABELS) {
    const { tp, fp, fn } = perClass[c];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    report[c] = { precision: +precision.toFixed(4), recall: +recall.toFixed(4), f1: +f1.toFixed(4), support: perClass[c].support };
    if (perClass[c].support > 0) {
      macroP += precision; macroR += recall; macroF1 += f1; count++;
    }
  }
  if (count > 0) {
    macroP /= count; macroR /= count; macroF1 /= count;
  }
  const binaryTrue = yTrue.map(l => l === 'needs_revision' ? 1 : 0);
  const binaryPred = yPred.map(l => l === 'needs_revision' ? 1 : 0);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (let i = 0; i < n; i++) {
    if (binaryTrue[i] === 1 && binaryPred[i] === 1) tp++;
    else if (binaryTrue[i] === 0 && binaryPred[i] === 1) fp++;
    else if (binaryTrue[i] === 1 && binaryPred[i] === 0) fn++;
    else tn++;
  }
  const binaryPrecision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const binaryRecall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const binaryF1 = binaryPrecision + binaryRecall > 0
    ? (2 * binaryPrecision * binaryRecall) / (binaryPrecision + binaryRecall) : 0;

  return {
    accuracy: +accuracy.toFixed(4),
    macro: { precision: +macroP.toFixed(4), recall: +macroR.toFixed(4), f1: +macroF1.toFixed(4) },
    perClass: report,
    binaryNeedsRevision: {
      precision: +binaryPrecision.toFixed(4),
      recall: +binaryRecall.toFixed(4),
      f1: +binaryF1.toFixed(4),
      confusion: { tp, fp, fn, tn },
    },
  };
}

function run() {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const yTrue = dataset.cases.map(c => c.expertLabel);
  const results = {
    dataset: dataset.dataset,
    version: dataset.version,
    evaluatedAt: new Date().toISOString(),
    n: dataset.cases.length,
    engines: {},
    comparison: [],
  };

  for (const [name, analyzer] of Object.entries(ENGINES)) {
    const yPred = dataset.cases.map(c => predictLabel(analyzer, c));
    const mismatches = dataset.cases
      .map((c, i) => ({ id: c.id, expected: c.expertLabel, predicted: yPred[i] }))
      .filter(x => x.expected !== x.predicted);
    results.engines[name] = { metrics: computeMetrics(yTrue, yPred), mismatches };
    results.comparison.push({ engine: name, accuracy: results.engines[name].metrics.accuracy, macroF1: results.engines[name].metrics.macro.f1 });
  }
  results.comparison.sort((a, b) => b.macroF1 - a.macroF1);

  const outArg = process.argv.indexOf('--output');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : path.join(__dirname, '../benchmarks/results/latest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log('\n=== TCM Prescription Review Evaluation ===\n');
  console.log(`Dataset: ${dataset.dataset} (n=${dataset.cases.length})\n`);
  console.log('Engine                  Accuracy  Macro-F1  Binary-F1(revision)');
  console.log('----------------------  --------  --------  -------------------');
  for (const row of results.comparison) {
    const m = results.engines[row.engine].metrics;
    const line = `${row.engine.padEnd(22)}  ${String(m.accuracy).padEnd(8)}  ${String(m.macro.f1).padEnd(8)}  ${m.binaryNeedsRevision.f1}`;
    console.log(line);
  }
  console.log(`\nFull report: ${outPath}\n`);
  return results;
}

if (require.main === module) {
  run();
}

module.exports = { run, computeMetrics, predictLabel };
