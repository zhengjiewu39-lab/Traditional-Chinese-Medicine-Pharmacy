#!/usr/bin/env node
/**
 * Writes the pre-registered scenario matrix and seed lists to paper/config/.
 * Run once before any experiment; the JSON files are committed and treated as frozen.
 * Refuses to overwrite existing files unless --force is given.
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_SCENARIO, normalizeScenario } = require('../../server/simulation/scenarioSchema');

const OUT_DIR = path.join(__dirname, '../../paper/config');
const ALL = ['urban', 'suburban', 'rural'];
const WARMUP = 30;
const DISRUPTION = 30;
const RECOVERY = 60;
const HORIZON = WARMUP + DISRUPTION + RECOVERY;

const window = { startDay: WARMUP, durationDays: DISRUPTION };
const surge = (m) => ({ type: 'demandSurge', ...window, magnitude: m, targetRegions: ALL });
const supply = (m) => ({ type: 'supplyDisruption', ...window, magnitude: m, targetRegions: ALL });
const road = (m) => ({ type: 'roadDisruption', ...window, magnitude: m, targetRegions: ['rural'] });
const lead = (m) => ({ type: 'leadTimeExtension', ...window, magnitude: m, targetRegions: ['rural', 'suburban'] });

/** Base network defined by demand-relative ratios, fixed before any result was inspected. */
const BASE = {
  ...DEFAULT_SCENARIO,
  id: 'paper-base',
  name: 'Paper base network (synthetic)',
  description: '12 pharmacies (4 urban / 4 suburban / 4 rural), 2 warehouses, 8 SKUs; 30-day warm-up, 30-day disruption window, 60-day recovery.',
  simulationDays: HORIZON,
  defaultReplicates: 100,
  logistics: {
    orderCost: 25,
    transportCostPerUnit: 0.15,
    pharmacyInitialStockDays: 10,
    warehouseInitialStockDays: 20,
    upstreamInboundCoverage: 1.2,
    dispatchCapacityCoverage: 1.5,
    truckCapacityCoverage: 1.5,
    capacityMultiplier: 1,
    initialStockMultiplier: 1,
  },
  events: [],
  phases: {
    warmup: [0, WARMUP],
    disruption: [WARMUP, WARMUP + DISRUPTION],
    recovery: [WARMUP + DISRUPTION, HORIZON],
  },
};

const compound = [surge(1.6), supply(0.5)];

const SCENARIOS = [
  { key: 'S01-baseline', label: 'No disturbance', patch: { events: [] } },
  { key: 'S02-surge-low', label: 'Demand surge ×1.3', patch: { events: [surge(1.3)] } },
  { key: 'S03-surge-mid', label: 'Demand surge ×1.6', patch: { events: [surge(1.6)] } },
  { key: 'S04-surge-high', label: 'Demand surge ×2.0', patch: { events: [surge(2.0)] } },
  { key: 'S05-supply-low', label: 'Supply at 75%', patch: { events: [supply(0.75)] } },
  { key: 'S06-supply-mid', label: 'Supply at 50%', patch: { events: [supply(0.5)] } },
  { key: 'S07-supply-high', label: 'Supply at 25%', patch: { events: [supply(0.25)] } },
  { key: 'S08-rural-road', label: 'Rural road disruption (transit ×2)', patch: { events: [road(2.0)] } },
  { key: 'S09-surge-supply', label: 'Surge ×1.6 + supply 50%', patch: { events: compound } },
  { key: 'S10-surge-supply-road', label: 'Surge ×1.6 + supply 50% + rural road ×2', patch: { events: [...compound, road(2.0)] } },
  {
    key: 'S11-long-lead',
    label: 'S09 + structural lead times ×2.5',
    patch: { events: compound, drugs: BASE.drugs.map((d) => ({ ...d, leadTimeDays: d.leadTimeDays * 2.5 })) },
  },
  {
    key: 'S12-limited-warehouse',
    label: 'S09 + warehouse stock 5 days, inbound 1.0×',
    patch: { events: compound, logistics: { ...BASE.logistics, warehouseInitialStockDays: 5, upstreamInboundCoverage: 1.0 } },
  },
  {
    key: 'S13-limited-capacity',
    label: 'S09 + dispatch/truck capacity ×0.7',
    patch: { events: compound, logistics: { ...BASE.logistics, capacityMultiplier: 0.7 } },
  },
  {
    key: 'S14-extreme',
    label: 'Extreme: surge ×2.2 + supply 20% + rural road ×2.5 + lead ×2 + capacity ×0.8',
    patch: {
      events: [surge(2.2), supply(0.2), { ...road(2.5) }, lead(2.0)],
      logistics: { ...BASE.logistics, capacityMultiplier: 0.8 },
    },
  },
];

function build() {
  const scenarios = SCENARIOS.map((s) => {
    const scen = normalizeScenario({ ...BASE, ...s.patch, id: s.key, name: s.label });
    scen.phases = BASE.phases;
    return { key: s.key, label: s.label, scenario: scen };
  });
  return {
    matrixVersion: '1.1.0',
    frozenAt: new Date().toISOString(),
    note: 'Pre-registered synthetic scenario matrix. Do not edit after results are generated; add a new matrixVersion instead.',
    revisions: [
      { version: '1.0.0', change: 'initial matrix (upstreamInboundCoverage 1.05)' },
      {
        version: '1.1.0',
        change: 'upstreamInboundCoverage 1.05 → 1.2 (all scenarios except S12, which keeps its own 1.0)',
        reason: 'Mechanics check on non-reporting seeds 1–3 showed backlog accumulated during disruption could not be cleared within the 60-day recovery phase under any policy, so every recovery-time metric was right-censored. Applied before any calibration- or test-seed run; affects all policies identically.',
      },
    ],
    horizonDays: HORIZON,
    phases: BASE.phases,
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
    ],
    ablationScenarios: ['S04-surge-high', 'S07-supply-high', 'S08-rural-road', 'S09-surge-supply', 'S10-surge-supply-road', 'S14-extreme'],
    sensitivityBaseScenario: 'S10-surge-supply-road',
    scenarios,
  };
}

function buildSeeds() {
  const calibration = Array.from({ length: 20 }, (_, i) => 900001 + i);
  const test = Array.from({ length: 100 }, (_, i) => 100001 + i);
  const sensitivity = Array.from({ length: 5 }, (_, i) => 500001 + i);
  return {
    note: 'Calibration seeds tune reorder-point (z, qScale) only. Test seeds are used only for reported results. Sets are disjoint.',
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
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writeOnce(path.join(OUT_DIR, 'scenario-matrix.json'), build());
writeOnce(path.join(OUT_DIR, 'seeds.json'), buildSeeds());
