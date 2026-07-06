#!/usr/bin/env node
/**
 * Merge hand-curated benchmark + synthetic prescriptions into expanded dataset.
 * Usage: node scripts/merge-datasets.js [--out benchmarks/prescription-review-dataset-expanded.json]
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    base: 'benchmarks/prescription-review-dataset.json',
    synth: 'experiments/data/tcm/synth_n500.json',
    out: 'benchmarks/prescription-review-dataset-expanded.json',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') opts.base = args[++i];
    else if (args[i] === '--synth') opts.synth = args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
  }
  return opts;
}

function loadCases(filePath) {
  if (!fs.existsSync(path.resolve(filePath))) return [];
  const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  return raw.cases || [];
}

function main() {
  const opts = parseArgs();
  const baseCases = loadCases(opts.base);
  const synthCases = loadCases(opts.synth);
  const seen = new Set();
  const merged = [];

  for (const c of [...baseCases, ...synthCases]) {
    const key = `${c.prescription}|${c.patientAge}|${c.expertLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }

  const out = {
    dataset: 'TCM-Prescription-Review-Expanded-v1',
    version: '1.1.0',
    license: 'CC-BY-4.0',
    description: `Expanded benchmark: ${baseCases.length} curated + ${synthCases.length} synthetic (deduped n=${merged.length}).`,
    sources: { curated: baseCases.length, synthetic: synthCases.length },
    cases: merged,
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(out, null, 2));
  console.log(`Merged ${merged.length} cases → ${opts.out}`);
}

if (require.main === module) main();
module.exports = { loadCases };
