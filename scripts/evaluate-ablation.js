#!/usr/bin/env node
/**
 * Ablation study for HAR-CDSS paper:
 * Rule-only vs ML-only vs Fusion (dual-track)
 */

const fs = require('fs');
const path = require('path');
const { run, computeMetrics, predictLabel } = require('./evaluate-review');

const ruleEngine = require('../server/services/prescriptionAnalyzer');
const mlEngine = require('../server/services/mlPrescriptionClassifier');
const cdssEngine = require('../server/services/cdssEngine');

const DATASET = process.env.TCM_EVAL_DATASET
  || (fs.existsSync(path.join(__dirname, '../benchmarks/prescription-review-dataset-expanded.json'))
    ? path.join(__dirname, '../benchmarks/prescription-review-dataset-expanded.json')
    : path.join(__dirname, '../benchmarks/prescription-review-dataset.json'));

const ABLATION_ENGINES = {
  'rule-only': { name: 'rule-only', label: '专家规则（单轨）', analyzer: ruleEngine },
  'ml-only': { name: 'ml-only', label: '可解释 ML（单轨）', analyzer: mlEngine },
  'fusion-cdss': { name: 'fusion-cdss', label: '双轨融合 CDSS', analyzer: cdssEngine },
};

function adrHighRiskLabel(expertLabel) {
  return expertLabel === 'needs_revision' ? 1 : 0;
}

function computeAdrDetectionMetrics(yTrueLabels, yPredLabels) {
  const yTrue = yTrueLabels.map(adrHighRiskLabel);
  const yPred = yPredLabels.map(adrHighRiskLabel);
  let tp = 0; let fp = 0; let fn = 0; let tn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1 && yPred[i] === 1) tp++;
    else if (yTrue[i] === 0 && yPred[i] === 1) fp++;
    else if (yTrue[i] === 1 && yPred[i] === 0) fn++;
    else tn++;
  }
  const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
  const ppv = tp + fp > 0 ? tp / (tp + fp) : 0;
  const npv = tn + fn > 0 ? tn / (tn + fn) : 0;
  const f1 = ppv + sensitivity > 0 ? (2 * ppv * sensitivity) / (ppv + sensitivity) : 0;
  return {
    sensitivity: +sensitivity.toFixed(4),
    specificity: +specificity.toFixed(4),
    ppv: +ppv.toFixed(4),
    npv: +npv.toFixed(4),
    f1: +f1.toFixed(4),
    confusion: { tp, fp, fn, tn },
  };
}

function runAblation() {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const yTrue = dataset.cases.map((c) => c.expertLabel);

  const results = {
    study: 'HAR-CDSS Ablation',
    purpose: 'herb_adverse_reaction_prevention',
    dataset: dataset.dataset,
    version: dataset.version,
    n: dataset.cases.length,
    evaluatedAt: new Date().toISOString(),
    variants: {},
    comparison: [],
    fullBenchmark: null,
  };

  for (const [key, cfg] of Object.entries(ABLATION_ENGINES)) {
    const yPred = dataset.cases.map((c) => predictLabel(cfg.analyzer, c));
    const metrics = computeMetrics(yTrue, yPred);
    const adrMetrics = computeAdrDetectionMetrics(yTrue, yPred);
    results.variants[key] = {
      engine: cfg.name,
      label: cfg.label,
      metrics,
      adrHighRiskDetection: adrMetrics,
    };
    results.comparison.push({
      variant: key,
      label: cfg.label,
      accuracy: metrics.accuracy,
      macroF1: metrics.macro.f1,
      adrF1: adrMetrics.f1,
      adrSensitivity: adrMetrics.sensitivity,
      adrSpecificity: adrMetrics.specificity,
    });
  }

  results.comparison.sort((a, b) => b.macroF1 - a.macroF1);

  const outPath = path.join(__dirname, '../benchmarks/results/ablation-latest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log('\n=== HAR-CDSS Ablation Study ===\n');
  console.log(`Dataset: ${dataset.dataset} (n=${dataset.cases.length})\n`);
  console.log('Variant           Accuracy  Macro-F1  ADR-F1  Sens    Spec');
  console.log('----------------  --------  --------  ------  ------  ------');
  for (const row of results.comparison) {
    console.log(
      `${row.label.padEnd(16)}  ${String(row.accuracy).padEnd(8)}  ${String(row.macroF1).padEnd(8)}  ${String(row.adrF1).padEnd(6)}  ${String(row.adrSensitivity).padEnd(6)}  ${row.adrSpecificity}`
    );
  }
  console.log(`\nReport: ${outPath}\n`);

  return results;
}

if (require.main === module) {
  runAblation();
}

module.exports = { runAblation, computeAdrDetectionMetrics, ABLATION_ENGINES };
