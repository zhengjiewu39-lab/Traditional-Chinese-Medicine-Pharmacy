const express = require('express');
const fs = require('fs');
const path = require('path');
const { run } = require('../../scripts/evaluate-review');
const { runAblation } = require('../../scripts/evaluate-ablation');
const { loadTaxonomy } = require('../services/adrTaxonomy');
const { SYSTEM_META } = require('../services/cdssEngine');
const ruleEngine = require('../services/prescriptionAnalyzer');
const baselineNaive = require('../services/baselineAnalyzer');
const baselineKeyword = require('../services/baselineKeywordAnalyzer');
const mlEngine = require('../services/mlPrescriptionClassifier');
const cdssEngine = require('../services/cdssEngine');
const { loadRules, DEFAULT_PATH } = require('../services/ruleLoader');

const router = express.Router();

const ANALYZERS = {
  'rule-engine-v3': ruleEngine,
  'baseline-naive': baselineNaive,
  'baseline-keyword': baselineKeyword,
  'ml-interpretable-v1': mlEngine,
  'cdss-dual-track-v1': cdssEngine,
};

router.get('/dataset', (req, res) => {
  const expanded = path.join(__dirname, '../../benchmarks/prescription-review-dataset-expanded.json');
  const base = path.join(__dirname, '../../benchmarks/prescription-review-dataset.json');
  const p = fs.existsSync(expanded) ? expanded : base;
  res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
});

router.get('/results', (req, res) => {
  const p = path.join(__dirname, '../../benchmarks/results/latest.json');
  if (!fs.existsSync(p)) {
    return res.json({ message: 'No results yet. Run evaluation first.', comparison: [] });
  }
  res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
});

router.get('/engines', (req, res) => {
  res.json(Object.keys(ANALYZERS));
});

router.post('/compare', (req, res) => {
  const input = req.body;
  const results = Object.entries(ANALYZERS).map(([name, analyzer]) => ({
    engine: name,
    result: analyzer.analyzePrescription(input),
  }));
  res.json({ input, results });
});

router.post('/evaluate', (req, res) => {
  const results = run();
  res.json(results);
});

router.post('/ablation', (req, res) => {
  const results = runAblation();
  res.json(results);
});

router.get('/ablation', (req, res) => {
  const p = path.join(__dirname, '../../benchmarks/results/ablation-latest.json');
  if (!fs.existsSync(p)) {
    return res.json({ message: 'No ablation results yet. POST /api/research/ablation to run.' });
  }
  res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
});

router.get('/meta', (req, res) => {
  res.json({
    system: SYSTEM_META,
    adrTaxonomy: loadTaxonomy(),
    engines: Object.keys(ANALYZERS),
    paperTitle: SYSTEM_META.paperTitle,
  });
});

router.get('/rules', (req, res) => {
  res.json(loadRules());
});

router.post('/cdss', (req, res) => {
  res.json(cdssEngine.analyzePrescription(req.body));
});

router.post('/analyze', (req, res) => {
  const engine = req.query.engine || req.body.engine || 'rule-engine-v3';
  const analyzer = ANALYZERS[engine];
  if (!analyzer) return res.status(400).json({ message: `Unknown engine: ${engine}`, available: Object.keys(ANALYZERS) });
  const result = analyzer.analyzePrescription(req.body);
  res.json({ ...result, engineUsed: engine, rulesPath: DEFAULT_PATH });
});

module.exports = router;
