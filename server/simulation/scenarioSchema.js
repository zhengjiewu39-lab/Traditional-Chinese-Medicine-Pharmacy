/** Scenario parameter definitions, defaults, validation, and help text. */

const REGION_TYPES = ['urban', 'suburban', 'rural'];
const DRUG_PRIORITIES = ['essential', 'chronic-care', 'routine'];
const EVENT_TYPES = ['demandSurge', 'supplyDisruption', 'roadDisruption', 'leadTimeExtension'];

const SCHEMA_VERSION = '2.1.0';

const DEFAULT_SCENARIO = {
  schemaVersion: SCHEMA_VERSION,
  id: 'public-health-emergency-default',
  name: 'Default public health emergency (synthetic)',
  description: 'Synthetic surge + partial supply disruption + rural delivery delay.',
  parameterMeta: {
    population: 'illustrative',
    baseDemand: 'illustrative',
    costs: 'illustrative',
    events: 'illustrative',
  },
  randomSeed: 20240901,
  defaultReplicates: 30,
  simulationDays: 30,
  warehouseCount: 2,
  pharmacyCount: 12,
  drugCount: 8,
  regionPharmacyCounts: { urban: 4, suburban: 4, rural: 4 },
  logistics: {
    orderCost: 25,
    transportCostPerUnit: 0.15,
    truckCapacityUnits: 2000,
    dailyDispatchCapacityPerWarehouse: 2500,
  },
  regions: {
    urban: { population: 50000, baseDemand: 1.0, demandVolatility: 0.15, distanceKm: 8, roadAccessibility: 1.0, transitDays: 0.5, vulnerabilityWeight: 1.0 },
    suburban: { population: 20000, baseDemand: 0.85, demandVolatility: 0.2, distanceKm: 25, roadAccessibility: 0.85, transitDays: 1.0, vulnerabilityWeight: 1.2 },
    rural: { population: 8000, baseDemand: 0.7, demandVolatility: 0.25, distanceKm: 60, roadAccessibility: 0.6, transitDays: 2.5, vulnerabilityWeight: 1.6 },
  },
  drugs: [
    { id: 'D1', name: 'Synthetic essential A', priority: 'essential', initialStock: 220, unitProcurementCost: 4, holdingCostPerUnitDay: 0.03, stockoutPenalty: 50, leadTimeDays: 2 },
    { id: 'D2', name: 'Synthetic essential B', priority: 'essential', initialStock: 220, unitProcurementCost: 4.2, holdingCostPerUnitDay: 0.03, stockoutPenalty: 50, leadTimeDays: 2 },
    { id: 'D3', name: 'Synthetic chronic C', priority: 'chronic-care', initialStock: 180, unitProcurementCost: 3, holdingCostPerUnitDay: 0.025, stockoutPenalty: 35, leadTimeDays: 3 },
    { id: 'D4', name: 'Synthetic chronic D', priority: 'chronic-care', initialStock: 180, unitProcurementCost: 3.1, holdingCostPerUnitDay: 0.025, stockoutPenalty: 35, leadTimeDays: 3 },
    { id: 'D5', name: 'Synthetic routine E', priority: 'routine', initialStock: 150, unitProcurementCost: 2, holdingCostPerUnitDay: 0.02, stockoutPenalty: 15, leadTimeDays: 4 },
    { id: 'D6', name: 'Synthetic routine F', priority: 'routine', initialStock: 150, unitProcurementCost: 2, holdingCostPerUnitDay: 0.02, stockoutPenalty: 15, leadTimeDays: 4 },
    { id: 'D7', name: 'Synthetic routine G', priority: 'routine', initialStock: 140, unitProcurementCost: 1.8, holdingCostPerUnitDay: 0.02, stockoutPenalty: 15, leadTimeDays: 4 },
    { id: 'D8', name: 'Synthetic routine H', priority: 'routine', initialStock: 140, unitProcurementCost: 1.8, holdingCostPerUnitDay: 0.02, stockoutPenalty: 15, leadTimeDays: 4 },
  ],
  events: [
    { type: 'demandSurge', startDay: 5, durationDays: 10, magnitude: 1.8, targetRegions: ['urban', 'suburban', 'rural'] },
    { type: 'supplyDisruption', startDay: 8, durationDays: 7, magnitude: 0.45, targetRegions: ['urban', 'suburban', 'rural'] },
    { type: 'roadDisruption', startDay: 12, durationDays: 5, magnitude: 1.5, targetRegions: ['rural'] },
    { type: 'leadTimeExtension', startDay: 10, durationDays: 8, magnitude: 2.0, targetRegions: ['rural', 'suburban'] },
  ],
  metricsWeights: {
    stockoutPenaltyByPriority: { essential: 50, 'chronic-care': 35, routine: 15 },
    waitingTimePenaltyPerDay: 8,
    inequityPenaltyPerGap: 120,
    maxRelevantWaitDays: 30,
    serviceInequalityWeights: { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 },
  },
  policyWeights: {
    equityAware: { stockout: 1, wait: 0.5, inequity: 1, cost: 0.01 },
  },
};

const SCENARIO_PRESETS = {
  baseline: { id: 'preset-baseline', name: 'Baseline (no events)', events: [] },
  demandSurgeOnly: { id: 'preset-demand-surge', name: 'Demand surge only', events: [{ type: 'demandSurge', startDay: 5, durationDays: 12, magnitude: 1.8, targetRegions: REGION_TYPES }] },
  supplyDisruptionOnly: { id: 'preset-supply', name: 'Supply disruption only', events: [{ type: 'supplyDisruption', startDay: 5, durationDays: 12, magnitude: 0.4, targetRegions: REGION_TYPES }] },
  roadDisruptionOnly: { id: 'preset-road', name: 'Road disruption only', events: [{ type: 'roadDisruption', startDay: 5, durationDays: 10, magnitude: 1.6, targetRegions: ['rural'] }] },
  compound: { id: 'preset-compound', name: 'Compound disturbance', events: DEFAULT_SCENARIO.events },
  lowVolatility: { id: 'preset-low-vol', name: 'Low demand volatility', regions: { urban: { demandVolatility: 0.05 }, suburban: { demandVolatility: 0.05 }, rural: { demandVolatility: 0.05 } } },
  highVolatility: { id: 'preset-high-vol', name: 'High demand volatility', regions: { urban: { demandVolatility: 0.35 }, suburban: { demandVolatility: 0.35 }, rural: { demandVolatility: 0.35 } } },
};

const FIELD_HELP = {
  randomSeed: 'Integer seed for reproducible synthetic demand and disruptions.',
  simulationDays: 'Number of discrete daily simulation steps (1–365).',
  warehouseCount: 'Central warehouses replenishing pharmacies (1–10).',
  pharmacyCount: 'Community pharmacies in the synthetic network (3–60).',
  'logistics.truckCapacityUnits': 'Max units per warehouse dispatch wave per day (illustrative).',
  'events.*.magnitude': 'Surge multiplier, supply outbound fraction, delay factor, etc.',
};

const LIMITS = {
  simulationDays: [1, 365],
  warehouseCount: [1, 10],
  pharmacyCount: [3, 60],
  drugCount: [2, 20],
};

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function err(path, code, message) {
  return { path, code, message };
}

function validateScenario(input) {
  const merged = deepMerge(DEFAULT_SCENARIO, input || {});
  const errors = [];
  const warnings = [];

  const scenario = normalizeScenario(merged);

  for (const rt of REGION_TYPES) {
    if (!scenario.regions?.[rt]) errors.push(err(`regions.${rt}`, 'missing_region', `Missing region config: ${rt}`));
    else {
      const r = scenario.regions[rt];
      if (!Number.isFinite(r.population) || r.population < 0) errors.push(err(`regions.${rt}.population`, 'invalid', 'Population must be non-negative finite number'));
      if (r.demandVolatility < 0 || r.demandVolatility > 1) warnings.push(`regions.${rt}.demandVolatility should be in [0,1]`);
    }
  }

  const ids = new Set();
  for (const d of scenario.drugs) {
    if (ids.has(d.id)) errors.push(err(`drugs.${d.id}`, 'duplicate_id', `Duplicate drug id ${d.id}`));
    ids.add(d.id);
    if (!DRUG_PRIORITIES.includes(d.priority)) errors.push(err(`drugs.${d.id}.priority`, 'invalid_priority', `Invalid priority ${d.priority}`));
  }

  for (let i = 0; i < (scenario.events || []).length; i += 1) {
    const ev = scenario.events[i];
    if (!EVENT_TYPES.includes(ev.type)) errors.push(err(`events[${i}].type`, 'unknown_event', `Unknown event type: ${ev.type}`));
    if (ev.startDay < 0 || ev.durationDays <= 0) errors.push(err(`events[${i}]`, 'invalid_duration', 'startDay >= 0 and durationDays > 0 required'));
    if (ev.startDay + ev.durationDays > scenario.simulationDays) {
      warnings.push(`events[${i}] extends past simulationDays; effects apply only within horizon`);
    }
    for (const rt of ev.targetRegions || []) {
      if (!REGION_TYPES.includes(rt)) errors.push(err(`events[${i}].targetRegions`, 'invalid_region', `Invalid target region ${rt}`));
    }
  }

  return { valid: errors.length === 0, errors, warnings, scenario };
}

function normalizeScenario(s) {
  const out = JSON.parse(JSON.stringify(deepMerge(DEFAULT_SCENARIO, s)));
  out.simulationDays = clamp(out.simulationDays, ...LIMITS.simulationDays);
  out.warehouseCount = clamp(out.warehouseCount, ...LIMITS.warehouseCount);
  out.pharmacyCount = clamp(out.pharmacyCount, ...LIMITS.pharmacyCount);
  out.drugCount = clamp(out.drugCount, ...LIMITS.drugCount);
  while (out.drugs.length < out.drugCount) {
    const i = out.drugs.length + 1;
    out.drugs.push({
      id: `D${i}`,
      name: `Synthetic drug ${i}`,
      priority: DRUG_PRIORITIES[i % 3],
      initialStock: 150,
      unitProcurementCost: 2,
      holdingCostPerUnitDay: 0.02,
      stockoutPenalty: DRUG_PRIORITIES[i % 3] === 'essential' ? 50 : 15,
      leadTimeDays: 3,
    });
  }
  out.drugs = out.drugs.slice(0, out.drugCount);
  return out;
}

function buildPreset(presetKey) {
  const patch = SCENARIO_PRESETS[presetKey];
  if (!patch) return null;
  return normalizeScenario(deepMerge(DEFAULT_SCENARIO, patch));
}

module.exports = {
  SCHEMA_VERSION,
  REGION_TYPES,
  DRUG_PRIORITIES,
  EVENT_TYPES,
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  FIELD_HELP,
  LIMITS,
  validateScenario,
  normalizeScenario,
  deepMerge,
  buildPreset,
};
