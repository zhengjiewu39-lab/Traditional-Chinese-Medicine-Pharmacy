const express = require('express');
const fs = require('fs');
const path = require('path');
const { run } = require('../../scripts/evaluate-review');
const ruleEngine = require('../services/prescriptionAnalyzer');
const baselineNaive = require('../services/baselineAnalyzer');
const baselineKeyword = require('../services/baselineKeywordAnalyzer');
const mlEngine = require('../services/mlPrescriptionClassifier');
const { loadRules, DEFAULT_PATH } = require('../services/ruleLoader');

const router = express.Router();

const ANALYZERS = {
  'rule-engine-v3': ruleEngine,
  'baseline-naive': baselineNaive,
  'baseline-keyword': baselineKeyword,
  'ml-interpretable-v1': mlEngine,
};

router.get('/dataset', (req, res) => {
  res.json(require('../../benchmarks/prescription-review-dataset.json'));
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

router.get('/rules', (req, res) => {
  res.json(loadRules());
});

router.post('/analyze', (req, res) => {
  const engine = req.query.engine || req.body.engine || 'rule-engine-v3';
  const analyzer = ANALYZERS[engine];
  if (!analyzer) return res.status(400).json({ message: `Unknown engine: ${engine}`, available: Object.keys(ANALYZERS) });
  const result = analyzer.analyzePrescription(req.body);
  res.json({ ...result, engineUsed: engine, rulesPath: DEFAULT_PATH });
});

module.exports = router;
