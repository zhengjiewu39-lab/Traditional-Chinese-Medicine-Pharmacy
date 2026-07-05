#!/usr/bin/env node
/**
 * Generate synthetic TCM prescriptions from tcm-rules.json (positive/negative/boundary).
 * Usage: node scripts/generate_synthetic_prescriptions.js --n 500 --out experiments/data/tcm/synth_n500.json
 */

const fs = require('fs');
const path = require('path');
const { loadRules } = require('../server/services/ruleLoader');
const { analyzePrescription, parseHerbs, mapStatusToLabel } = require('../server/services/prescriptionAnalyzer');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { n: 500, out: 'experiments/data/tcm/synth_n500.json', seed: 42 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n') opts.n = +args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--seed') opts.seed = +args[++i];
  }
  return opts;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function fmtHerb(name, dosage, unit = 'g') { return `${name}${dosage}${unit}`; }

function buildSafeFormula(rng, herbKeys) {
  const pool = ['黄芪', '当归', '白芍', '川芎', '甘草', '熟地黄', '丹参', '板蓝根'];
  const n = 4 + Math.floor(rng() * 3);
  const chosen = [];
  while (chosen.length < n) {
    const h = pick(rng, pool);
    if (!chosen.includes(h)) chosen.push(h);
  }
  const parts = chosen.map(h => {
    const rule = herbKeys[h];
    const d = rule ? rule.min + rng() * (rule.max - rule.min) : 6 + rng() * 6;
    return fmtHerb(h, +d.toFixed(1));
  });
  return parts.join('，');
}

function build18Fan(rng) {
  return `${fmtHerb('甘草', 10)}，${fmtHerb('甘遂', 0.8 + rng() * 0.5)}`;
}

function buildOverdose(rng, herbKeys) {
  const h = pick(rng, ['甘草', '黄芪', '当归']);
  const rule = herbKeys[h];
  const high = rule ? rule.max * (1.5 + rng()) : 25;
  return `${fmtHerb(h, +high.toFixed(1))}，${fmtHerb('白芍', 10)}，${fmtHerb('川芎', 6)}`;
}

function buildBorderline(rng, herbKeys) {
  const h = pick(rng, ['甘草', '黄芪', '当归']);
  const rule = herbKeys[h];
  const d = rule ? rule.max * (0.95 + rng() * 0.08) : 12;
  return `${fmtHerb(h, +d.toFixed(1))}，${fmtHerb('白芍', 10)}，${fmtHerb('川芎', 6)}`;
}

function build19Wei(rng) {
  return `${fmtHerb('人参', 6)}，${fmtHerb('莱菔子', 10)}`;
}

function inferLabel(prescription, rules, rng) {
  const age = 20 + Math.floor(rng() * 50);
  const result = analyzePrescription({
    prescription,
    diagnosis: pick(rng, ['气血两虚', '感冒', '失眠', '水肿', '头痛']),
    patientAge: age,
    patientGender: rng() > 0.5 ? '女' : '男',
  }, { rules });
  let label = mapStatusToLabel(result.status);
  if (rng() < 0.05) {
    const labels = ['approved', 'review', 'needs_revision'];
    label = pick(rng, labels.filter(l => l !== label));
  }
  return { label, age, result };
}

function main() {
  const opts = parseArgs();
  const rng = mulberry32(opts.seed);
  const rules = loadRules();
  const herbKeys = rules.herbRules;

  const generators = [
    { fn: () => buildSafeFormula(rng, herbKeys), weight: 0.35 },
    { fn: () => build18Fan(rng), weight: 0.15 },
    { fn: () => buildOverdose(rng, herbKeys), weight: 0.2 },
    { fn: () => buildBorderline(rng, herbKeys), weight: 0.15 },
    { fn: () => build19Wei(rng), weight: 0.1 },
    { fn: () => buildSafeFormula(rng, herbKeys) + '，' + fmtHerb('附子', 12), weight: 0.05 },
  ];

  const cases = [];
  for (let i = 0; i < opts.n; i++) {
    const r = rng();
    let acc = 0;
    let prescription = '';
    for (const g of generators) {
      acc += g.weight;
      if (r <= acc) { prescription = g.fn(); break; }
    }
    if (!prescription) prescription = buildSafeFormula(rng, herbKeys);

    const { label, age, result } = inferLabel(prescription, rules, rng);
    cases.push({
      id: `SYN-${String(i + 1).padStart(4, '0')}`,
      prescription,
      diagnosis: result.diagnosis || '合成',
      patientAge: age,
      patientGender: rng() > 0.5 ? '女' : '男',
      expertLabel: label,
      rationale: `Synthetic (${result.status}, score=${result.score})`,
      synthetic: true,
    });
  }

  const out = {
    dataset: 'TCM-Prescription-Review-Synth-v1',
    version: '1.0.0',
    license: 'CC-BY-4.0',
    description: `Synthetic prescriptions generated from tcm-rules.json (n=${opts.n}, seed=${opts.seed})`,
    cases,
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(out, null, 2));
  console.log(`Generated ${cases.length} prescriptions → ${opts.out}`);
}

if (require.main === module) main();
