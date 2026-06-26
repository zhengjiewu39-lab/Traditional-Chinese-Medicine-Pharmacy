/** Interpretable ML-style classifier (logistic weights + feature attributions) */

const fs = require('fs');
const path = require('path');
const { loadRules } = require('./ruleLoader');
const { parseHerbs, extractFeatures, mapStatusToLabel } = require('./prescriptionAnalyzer');

const WEIGHTS_PATH = path.join(__dirname, '../config/ml-weights.json');

function loadMlConfig() {
  return JSON.parse(fs.readFileSync(process.env.TCM_ML_WEIGHTS_PATH || WEIGHTS_PATH, 'utf8'));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function dot(weights, features, featureNames) {
  let s = weights.bias || 0;
  const contributions = {};
  for (const f of featureNames) {
    const v = features[f] || 0;
    const w = weights[f] || 0;
    s += w * v;
    if (v > 0 && w !== 0) contributions[f] = +(w * v).toFixed(4);
  }
  return { score: s, contributions };
}

function analyzePrescription(input, options = {}) {
  const rules = options.rules || loadRules(options.rulesPath);
  const ml = options.mlConfig || loadMlConfig();
  const herbs = input.herbs || parseHerbs(input.prescription);
  const features = extractFeatures(input, herbs, rules);

  const rev = dot(ml.weights.needs_revision, features, ml.features);
  const revProb = sigmoid(rev.score);
  const review = dot(ml.weights.review, features, ml.features);
  const reviewProb = sigmoid(review.score);

  let label = 'approved';
  let status = '已通过';
  if (revProb >= 0.55) {
    label = 'needs_revision';
    status = '需修改';
  } else if (reviewProb >= 0.5 || revProb >= 0.35) {
    label = 'review';
    status = '建议复核';
  }

  const topContributions = Object.entries(
    label === 'needs_revision' ? rev.contributions : review.contributions
  )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([feature, weight]) => ({ feature, contribution: weight }));

  const warnings = [];
  if (features.has_18fan) warnings.push({ level: 'error', type: 'ml-feature', message: 'ML: 十八反特征触发' });
  if (features.has_dosage_high) warnings.push({ level: 'error', type: 'ml-feature', message: 'ML: 超量特征触发' });
  if (features.licorice_ratio_high) warnings.push({ level: 'warning', type: 'ml-feature', message: 'ML: 甘草比例偏高' });

  return {
    score: Math.round((1 - revProb) * 100),
    status,
    label,
    warnings,
    suggestions: [`Top features: ${topContributions.map(c => c.feature).join(', ') || 'none'}`],
    herbs,
    summary: `ML classifier (${ml.explainability})`,
    engine: 'ml-interpretable-v1',
    probabilities: { needs_revision: +revProb.toFixed(4), review: +reviewProb.toFixed(4) },
    explainability: {
      method: 'linear-attribution',
      topContributions,
      allFeatures: features,
    },
  };
}

module.exports = { analyzePrescription, loadMlConfig, dot, sigmoid };
