#!/usr/bin/env node
/**
 * Writes the pre-registered scenario matrix and seed lists to paper/config/.
 * The matrix is built from SCENARIO_PRESETS in server/simulation/scenarioSchema.js, so the API,
 * the tests and the paper pipeline share one definition. Once results exist the JSON files are
 * treated as frozen; a change means a new matrixVersion (older versions go to paper/config/archive/).
 * Refuses to overwrite existing files unless --force is given.
 */
const fs = require('fs');
const path = require('path');
const {
  SCENARIO_PRESETS, PHASES, HORIZON_DAYS, buildPreset,
} = require('../../server/simulation/scenarioSchema');
const { hashScenario } = require('../../server/simulation/scenarioHash');

const OUT_DIR = path.join(__dirname, '../../paper/config');

const REVISIONS = [
  { version: '1.0.0', change: 'initial matrix, engine v3 (upstreamInboundCoverage 1.05)' },
  { version: '1.1.0', change: 'upstreamInboundCoverage 1.05 → 1.2', reason: 'backlog could not clear within the recovery phase under any policy (engine v3).' },
  {
    version: '2.0.0',
    change: 'engine v4: supplier network (primary + backup per warehouse), supplier-scoped supply disruptions, lateral transfers, warehouse capacity; nine scenarios M1–M9 built from SCENARIO_PRESETS; base warehouse stock 20 → 10 days; M3 = primary suppliers down; M7 warehouse stock 4 days',
    reason: 'Supply disruptions in v1 throttled whole-warehouse dispatch; in v4 they act on suppliers and reach pharmacies through warehouse stock. With 20 days of warehouse stock a single-mechanism shock of 30 days was absorbed completely (no shortage under any policy, checked on non-reporting seeds 1–3), so the base buffer was set below the deficit of a primary-supplier outage (0.6 × 30 = 18 demand-days). Applied before any calibration- or test-seed run and identically to every policy.',
  },
];

function build() {
  const scenarios = Object.keys(SCENARIO_PRESETS).map((key) => {
    const scenario = buildPreset(key);
    return { key, label: SCENARIO_PRESETS[key].name, scenarioHash: hashScenario(scenario), scenario };
  });
  return {
    matrixVersion: '2.0.0',
    frozenAt: new Date().toISOString(),
    note: 'Pre-registered synthetic scenario matrix (合成场景假设). Do not edit after results are generated; add a new matrixVersion instead.',
    revisions: REVISIONS,
    horizonDays: HORIZON_DAYS,
    phases: PHASES,
    policies: [
      'fixed-allocation',
      'reorder-point',
      'cost-first',
      'equity-aware',
      'equity-constrained-rolling-horizon',
    ],
    ablationPolicies: [
      'equity-constrained-rolling-horizon',
      'errra-no-floor',
      'errra-no-vulnerability',
      'errra-no-rolling',
      'errra-no-essential-priority',
      'errra-no-compound-awareness',
      'errra-no-transfers',
      'errra-no-supplier-redundancy',
    ],
    ablationScenarios: ['M2-demand-surge', 'M3-supply-disruption', 'M4-transport-disruption', 'M5-compound', 'M8-tight-transport', 'M9-extreme'],
    sensitivityBaseScenario: 'M5-compound',
    scenarios,
  };
}

function buildSeeds() {
  const calibration = Array.from({ length: 20 }, (_, i) => 900001 + i);
  const test = Array.from({ length: 100 }, (_, i) => 100001 + i);
  const sensitivity = Array.from({ length: 5 }, (_, i) => 500001 + i);
  return {
    note: 'Calibration seeds tune the (s,Q) baseline only. Test seeds are used only for reported results. Sensitivity seeds only for LHS. Sets are disjoint.',
    calibration,
    test,
    sensitivity,
  };
}

function writeOnce(file, obj) {
  if (fs.existsSync(file) && !process.argv.includes('--force')) {
    console.log(`exists, not overwritten: ${path.relative(process.cwd(), file)}`);
    return;
  }
  if (fs.existsSync(file)) {
    const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (prev.matrixVersion && prev.matrixVersion !== obj.matrixVersion) {
      const dir = path.join(OUT_DIR, 'archive');
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, `${path.basename(file, '.json')}-v${prev.matrixVersion}.json`);
      if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
      console.log(`archived previous version → ${path.relative(process.cwd(), dest)}`);
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writeOnce(path.join(OUT_DIR, 'scenario-matrix.json'), build());
writeOnce(path.join(OUT_DIR, 'seeds.json'), buildSeeds());
