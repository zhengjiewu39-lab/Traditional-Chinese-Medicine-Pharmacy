#!/usr/bin/env node
/**
 * Train interpretable logistic weights from feature CSV/JSON and write ml-weights.json.
 * Usage: node scripts/train-ml-weights.js --data experiments/data/tcm/features_expanded.csv
 */

const fs = require('fs');
const path = require('path');
const { FEATURE_NAMES } = require('./export_features');

const LABELS = ['approved', 'review', 'needs_revision'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    data: 'experiments/data/tcm/features_expanded.csv',
    out: 'server/config/ml-weights.json',
    epochs: 800,
    lr: 0.08,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data') opts.data = args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--epochs') opts.epochs = +args[++i];
    else if (args[i] === '--lr') opts.lr = +args[++i];
  }
  return opts;
}

function loadRows(filePath) {
  const p = path.resolve(filePath);
  if (p.endsWith('.json')) {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw.rows;
  }
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cols[i]; });
    row.label = row.label;
    FEATURE_NAMES.forEach((f) => { row[f] = parseFloat(row[f]) || 0; });
    return row;
  });
}

function sigmoid(x) {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function trainBinary(rows, featureNames, positiveLabel, epochs, lr) {
  const weights = { bias: 0 };
  featureNames.forEach((f) => { weights[f] = 0; });

  for (let e = 0; e < epochs; e++) {
    for (const row of rows) {
      const y = row.label === positiveLabel ? 1 : 0;
      let z = weights.bias;
      for (const f of featureNames) z += (weights[f] || 0) * row[f];
      const p = sigmoid(z);
      const err = p - y;
      weights.bias -= lr * err;
      for (const f of featureNames) {
        weights[f] -= lr * err * row[f];
      }
    }
  }

  Object.keys(weights).forEach((k) => {
    weights[k] = +weights[k].toFixed(4);
  });
  return weights;
}

function main() {
  const opts = parseArgs();
  const rows = loadRows(opts.data);
  if (!rows.length) {
    console.error('No training rows found');
    process.exit(1);
  }

  const needsRevision = trainBinary(rows, FEATURE_NAMES, 'needs_revision', opts.epochs, opts.lr);
  const review = trainBinary(rows, FEATURE_NAMES, 'review', opts.epochs, opts.lr);

  const out = {
    version: '1.1.0',
    description: `Interpretable logistic weights trained on ${rows.length} samples (${path.basename(opts.data)})`,
    trainedAt: new Date().toISOString(),
    nSamples: rows.length,
    labelMap: { approved: 0, review: 1, needs_revision: 2 },
    features: FEATURE_NAMES,
    weights: {
      needs_revision: needsRevision,
      review,
    },
    explainability: 'Linear weights over hand-crafted clinical features; top positive features indicate drivers toward review/revision.',
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(out, null, 2));
  console.log(`Trained on n=${rows.length} → ${opts.out}`);
}

if (require.main === module) main();
