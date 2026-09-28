/**
 * Scenario parameter definitions, defaults, presets and strict validation.
 * Every numeric parameter here is a synthetic scenario assumption (合成场景假设) unless stated otherwise;
 * none is estimated from real pharmacy, hospital or patient data.
 */

const REGION_TYPES = ['urban', 'suburban', 'rural'];
const DRUG_PRIORITIES = ['essential', 'chronic-care', 'routine'];
const EVENT_TYPES = ['demandSurge', 'supplyDisruption', 'roadDisruption', 'leadTimeExtension'];
const SUPPLIER_TIERS = ['primary', 'backup', 'all'];

const SCHEMA_VERSION = '3.0.0';

/** Default horizon: days 1–30 warm-up, 31–60 shock, 61–120 recovery (0-based day indices 0–29, 30–59, 60–119). */
const WARMUP_DAYS = 30;
const SHOCK_DAYS = 30;
const RECOVERY_DAYS = 60;
const HORIZON_DAYS = WARMUP_DAYS + SHOCK_DAYS + RECOVERY_DAYS;
const SHOCK = { startDay: WARMUP_DAYS, durationDays: SHOCK_DAYS };
const PHASES = {
  warmup: [0, WARMUP_DAYS],
  disruption: [WARMUP_DAYS, WARMUP_DAYS + SHOCK_DAYS],
  recovery: [WARMUP_DAYS + SHOCK_DAYS, HORIZON_DAYS],
};

const ev = {
  surge: (magnitude, targetRegions = REGION_TYPES) => ({ type: 'demandSurge', ...SHOCK, magnitude, targetRegions }),
  supply: (magnitude, supplierTier = 'primary') => ({ type: 'supplyDisruption', ...SHOCK, magnitude, supplierTier }),
  road: (magnitude, targetRegions = ['rural']) => ({ type: 'roadDisruption', ...SHOCK, magnitude, targetRegions }),
  lead: (magnitude, targetRegions = ['rural', 'suburban']) => ({ type: 'leadTimeExtension', ...SHOCK, magnitude, targetRegions }),
};

/**
 * Compound shock used by the default scenario: demand ×1.6 everywhere, primary suppliers at 50 %,
 * rural transit ×2. With primary coverage 1.2 and backup coverage 0.4 of baseline demand, upstream
 * capacity during the shock is 1.2·0.5 + 0.4 = 1.0 × baseline against 1.6 × baseline demand, so a
 * shortage is structural and cannot be avoided by any replenishment rule (fixed by supply–demand
 * arithmetic, not by comparing policy results).
 */
const COMPOUND_EVENTS = [ev.surge(1.6), ev.supply(0.5), ev.road(2.0)];

const DEFAULT_SCENARIO = {
  schemaVersion: SCHEMA_VERSION,
  id: 'compound-default',
  name: 'Compound public-health disturbance (synthetic, 120 days)',
  description: 'Synthetic: 30-day warm-up, 30-day demand surge ×1.6 + primary supplier capacity 50 % + rural transit ×2, 60-day recovery.',
  synthetic: true,
  parameterMeta: {
    all: '合成场景假设 (synthetic scenario assumption); not estimated from real data',
  },
  randomSeed: 20240901,
  defaultReplicates: 100,
  simulationDays: HORIZON_DAYS,
  phases: PHASES,
  warehouseCount: 2,
  pharmacyCount: 12,
  drugCount: 8,
  regionPharmacyCounts: { urban: 4, suburban: 4, rural: 4 },
  logistics: {
    orderCost: 25,
    transportCostPerUnit: 0.15,
    maxCycleDays: 30,
    pharmacyInitialStockDays: 10,
    warehouseInitialStockDays: 10,
    warehouseTargetStockDays: 10,
    warehouseCapacityDays: 45,
    dispatchCapacityCoverage: 1.5,
    truckCapacityCoverage: 1.5,
    capacityMultiplier: 1,
    initialStockMultiplier: 1,
    lateralTransfers: {
      enabled: true, essentialOnly: true, transitDays: 1, costPerUnit: 0.4, fixedCost: 10, capacityCoverage: 0.25, cooldownDays: 7, donorSafetyZ: 1.65,
    },
  },
  supplyNetwork: {
    redundancyEnabled: true,
    primary: { replenishmentLeadTime: 2, capacityCoverage: 1.2, reliability: 0.98, unitCost: 0.5 },
    backup: { replenishmentLeadTime: 5, capacityCoverage: 0.4, reliability: 0.9, unitCost: 1.2 },
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
  events: COMPOUND_EVENTS,
  metricsWeights: {
    stockoutPenaltyByPriority: { essential: 50, 'chronic-care': 35, routine: 15 },
    waitingTimePenaltyPerDay: 8,
    inequityPenaltyPerGap: 120,
    maxRelevantWaitDays: 30,
    serviceInequalityWeights: { stockout: 1 / 3, wait: 1 / 3, gini: 1 / 3 },
  },
  policyWeights: {
    equityAware: { stockout: 1, wait: 0.5, inequity: 2, cost: 0.01 },
  },
};

/**
 * Scenario matrix (presets). Each patch is applied on top of DEFAULT_SCENARIO; the shock window is
 * always days 31–60. Labels describe the patch; all values are synthetic scenario assumptions.
 */
const SCENARIO_PRESETS = {
  'M1-normal': { id: 'M1-normal', name: 'Normal baseline (no events)', events: [] },
  'M2-demand-surge': { id: 'M2-demand-surge', name: 'Demand surge ×1.6 (all regions)', events: [ev.surge(1.6)] },
  'M3-supply-disruption': { id: 'M3-supply-disruption', name: 'Upstream disruption: primary suppliers down (backup available)', events: [ev.supply(0)] },
  'M4-transport-disruption': { id: 'M4-transport-disruption', name: 'Road disruption: rural transit ×2.5, suburban ×1.5', events: [ev.road(2.5, ['rural']), ev.road(1.5, ['suburban'])] },
  'M5-compound': { id: 'M5-compound', name: 'Compound: surge ×1.6 + primary supply 50 % + rural transit ×2', events: COMPOUND_EVENTS },
  'M6-long-lead': {
    id: 'M6-long-lead',
    name: 'M5 + structural supplier and SKU lead times ×2.5',
    events: COMPOUND_EVENTS,
    supplyNetwork: { primary: { replenishmentLeadTime: 5 }, backup: { replenishmentLeadTime: 12 } },
    drugLeadTimeMultiplier: 2.5,
  },
  'M7-tight-warehouse': {
    id: 'M7-tight-warehouse',
    name: 'M5 + warehouse stock and target 4 days',
    events: COMPOUND_EVENTS,
    logistics: { warehouseInitialStockDays: 4, warehouseTargetStockDays: 4 },
  },
  'M8-tight-transport': {
    id: 'M8-tight-transport',
    name: 'M5 + dispatch and truck capacity 1.1 × baseline demand',
    events: COMPOUND_EVENTS,
    logistics: { dispatchCapacityCoverage: 1.1, truckCapacityCoverage: 1.1 },
  },
  'M9-extreme': {
    id: 'M9-extreme',
    name: 'Extreme: surge ×2.2 + all suppliers at 40 % + rural transit ×2.5 + lead ×2 + capacity ×0.8',
    events: [ev.surge(2.2), ev.supply(0.4, 'all'), ev.road(2.5), ev.lead(2.0)],
    logistics: { capacityMultiplier: 0.8 },
  },
};

const FIELD_HELP = {
  randomSeed: 'Integer seed for reproducible synthetic demand, supplier reliability and disruptions.',
  simulationDays: 'Number of discrete daily simulation steps (1–365). Default 120: warm-up 1–30, shock 31–60, recovery 61–120.',
  warehouseCount: 'Central warehouses replenishing pharmacies (1–10).',
  pharmacyCount: 'Community pharmacies in the synthetic network (3–60).',
  'logistics.truckCapacityCoverage': 'Daily truck capacity per warehouse as a multiple of its served baseline demand.',
  'events.*.magnitude': 'demandSurge: demand multiplier; supplyDisruption: fraction of supplier capacity remaining; roadDisruption / leadTimeExtension: transit multiplier.',
  'events.*.supplierTier': 'supplyDisruption only: primary (default) | backup | all. Scoped further by targetWarehouses or targetSuppliers.',
};

const LIMITS = {
  simulationDays: [1, 365],
  warehouseCount: [1, 10],
  pharmacyCount: [3, 60],
  drugCount: [2, 20],
};

const MAGNITUDE_LIMITS = {
  demandSurge: [0, 10],
  supplyDisruption: [0, 1],
  roadDisruption: [1, 10],
  leadTimeExtension: [1, 10],
};

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
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

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isInt = (x) => Number.isInteger(x);

function checkNumber(errors, path, value, { min = -Infinity, max = Infinity, integer = false, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(err(path, 'required', `${path} is required`));
    return;
  }
  if (!isNum(value)) { errors.push(err(path, 'not_a_number', `${path} must be a finite number`)); return; }
  if (integer && !isInt(value)) errors.push(err(path, 'not_an_integer', `${path} must be an integer`));
  if (value < min || value > max) errors.push(err(path, 'out_of_range', `${path} must be in [${min}, ${max}]`));
}

/**
 * Strict validation of a scenario patch merged onto DEFAULT_SCENARIO. Out-of-range values are
 * errors (never silently clamped). Returns the normalized scenario when valid.
 */
function validateScenario(input) {
  const errors = [];
  const warnings = [];
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) {
    return { valid: false, errors: [err('', 'not_an_object', 'scenario must be an object')], warnings, scenario: null };
  }
  const merged = deepMerge(DEFAULT_SCENARIO, input || {});

  checkNumber(errors, 'randomSeed', merged.randomSeed, { integer: true, min: 0, max: 2 ** 31 - 1, required: true });
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) checkNumber(errors, k, merged[k], { integer: true, min: lo, max: hi, required: true });
  checkNumber(errors, 'demandMultiplier', merged.demandMultiplier, { min: 0, max: 10 });
  checkNumber(errors, 'defaultReplicates', merged.defaultReplicates, { integer: true, min: 1, max: 1000 });
  checkNumber(errors, 'drugLeadTimeMultiplier', merged.drugLeadTimeMultiplier, { min: 0.1, max: 10 });

  if (merged.regionPharmacyCounts) {
    let total = 0;
    for (const rt of Object.keys(merged.regionPharmacyCounts)) {
      if (!REGION_TYPES.includes(rt)) errors.push(err(`regionPharmacyCounts.${rt}`, 'invalid_region', `Unknown region ${rt}`));
      checkNumber(errors, `regionPharmacyCounts.${rt}`, merged.regionPharmacyCounts[rt], { integer: true, min: 0, max: 60 });
      total += merged.regionPharmacyCounts[rt] || 0;
    }
    if (isInt(merged.pharmacyCount) && total !== merged.pharmacyCount) {
      warnings.push(`regionPharmacyCounts sum ${total} ≠ pharmacyCount ${merged.pharmacyCount}; regions are assigned from counts, then truncated or padded`);
    }
  }

  const lg = merged.logistics || {};
  for (const k of ['orderCost', 'transportCostPerUnit']) checkNumber(errors, `logistics.${k}`, lg[k], { min: 0, max: 1e6 });
  for (const k of ['maxCycleDays', 'pharmacyInitialStockDays', 'warehouseInitialStockDays', 'warehouseTargetStockDays', 'warehouseCapacityDays']) {
    checkNumber(errors, `logistics.${k}`, lg[k], { min: 0, max: 365 });
  }
  for (const k of ['dispatchCapacityCoverage', 'truckCapacityCoverage', 'capacityMultiplier', 'initialStockMultiplier', 'upstreamInboundCoverage']) {
    checkNumber(errors, `logistics.${k}`, lg[k], { min: 0, max: 100 });
  }
  const lt = lg.lateralTransfers;
  if (lt) {
    for (const k of ['transitDays', 'costPerUnit', 'fixedCost', 'capacityCoverage', 'cooldownDays', 'donorSafetyZ']) {
      checkNumber(errors, `logistics.lateralTransfers.${k}`, lt[k], { min: 0, max: 1e6 });
    }
  }

  const sn = merged.supplyNetwork || {};
  for (const tier of ['primary', 'backup']) {
    const t = sn[tier];
    if (!t) continue;
    checkNumber(errors, `supplyNetwork.${tier}.replenishmentLeadTime`, t.replenishmentLeadTime, { integer: true, min: 1, max: 365 });
    checkNumber(errors, `supplyNetwork.${tier}.capacityCoverage`, t.capacityCoverage, { min: 0, max: 100 });
    checkNumber(errors, `supplyNetwork.${tier}.reliability`, t.reliability, { min: 0, max: 1 });
    checkNumber(errors, `supplyNetwork.${tier}.unitCost`, t.unitCost, { min: 0, max: 1e6 });
  }

  for (const rt of REGION_TYPES) {
    const r = merged.regions?.[rt];
    if (!r) { errors.push(err(`regions.${rt}`, 'missing_region', `Missing region config: ${rt}`)); continue; }
    checkNumber(errors, `regions.${rt}.population`, r.population, { min: 0, max: 1e8, required: true });
    checkNumber(errors, `regions.${rt}.baseDemand`, r.baseDemand, { min: 0, max: 1e4, required: true });
    checkNumber(errors, `regions.${rt}.demandVolatility`, r.demandVolatility, { min: 0, max: 1, required: true });
    checkNumber(errors, `regions.${rt}.transitDays`, r.transitDays, { min: 0, max: 60, required: true });
    checkNumber(errors, `regions.${rt}.vulnerabilityWeight`, r.vulnerabilityWeight, { min: 0.01, max: 100, required: true });
  }
  for (const rt of Object.keys(merged.regions || {})) {
    if (!REGION_TYPES.includes(rt)) errors.push(err(`regions.${rt}`, 'invalid_region', `Unknown region ${rt}`));
  }

  if (!Array.isArray(merged.drugs) || !merged.drugs.length) {
    errors.push(err('drugs', 'required', 'drugs must be a non-empty array'));
  } else {
    const ids = new Set();
    merged.drugs.forEach((d, i) => {
      const p = `drugs[${i}]`;
      if (typeof d?.id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(d.id)) errors.push(err(`${p}.id`, 'invalid_id', 'drug id must match [A-Za-z0-9_-]{1,32}'));
      else if (ids.has(d.id)) errors.push(err(`${p}.id`, 'duplicate_id', `Duplicate drug id ${d.id}`));
      ids.add(d?.id);
      if (!DRUG_PRIORITIES.includes(d?.priority)) errors.push(err(`${p}.priority`, 'invalid_priority', `Invalid priority ${d?.priority}`));
      for (const k of ['initialStock', 'unitProcurementCost', 'holdingCostPerUnitDay', 'stockoutPenalty', 'leadTimeDays']) {
        checkNumber(errors, `${p}.${k}`, d?.[k], { min: 0, max: 1e6 });
      }
    });
  }

  if (!Array.isArray(merged.events)) {
    errors.push(err('events', 'not_an_array', 'events must be an array'));
  } else {
    merged.events.forEach((e, i) => {
      const p = `events[${i}]`;
      if (!EVENT_TYPES.includes(e?.type)) { errors.push(err(`${p}.type`, 'unknown_event', `Unknown event type: ${e?.type}`)); return; }
      checkNumber(errors, `${p}.startDay`, e.startDay, { integer: true, min: 0, max: 364, required: true });
      checkNumber(errors, `${p}.durationDays`, e.durationDays, { integer: true, min: 1, max: 365, required: true });
      const [lo, hi] = MAGNITUDE_LIMITS[e.type];
      checkNumber(errors, `${p}.magnitude`, e.magnitude, { min: lo, max: hi, required: true });
      if (isInt(e.startDay) && isInt(e.durationDays) && e.startDay + e.durationDays > merged.simulationDays) {
        warnings.push(`${p} extends past simulationDays; effects apply only within the horizon`);
      }
      if (e.type === 'supplyDisruption') {
        if (e.targetRegions !== undefined) {
          errors.push(err(`${p}.targetRegions`, 'supply_disruption_region_scope',
            'supplyDisruption acts on suppliers, not regions; use supplierTier, targetWarehouses or targetSuppliers'));
        }
        if (e.supplierTier !== undefined && !SUPPLIER_TIERS.includes(e.supplierTier)) {
          errors.push(err(`${p}.supplierTier`, 'invalid_tier', `supplierTier must be one of ${SUPPLIER_TIERS.join(', ')}`));
        }
        for (const k of ['targetWarehouses', 'targetSuppliers']) {
          if (e[k] !== undefined && (!Array.isArray(e[k]) || !e[k].every((x) => typeof x === 'string'))) {
            errors.push(err(`${p}.${k}`, 'invalid_targets', `${k} must be an array of ids`));
          }
        }
      } else {
        if (e.targetRegions !== undefined && !Array.isArray(e.targetRegions)) {
          errors.push(err(`${p}.targetRegions`, 'invalid_targets', 'targetRegions must be an array'));
        }
        for (const rt of e.targetRegions || []) {
          if (!REGION_TYPES.includes(rt)) errors.push(err(`${p}.targetRegions`, 'invalid_region', `Invalid target region ${rt}`));
        }
      }
    });
  }

  if (errors.length) return { valid: false, errors, warnings, scenario: null };
  const scenario = normalizeScenario(merged);
  return { valid: true, errors, warnings, scenario };
}

/** Normalize a (validated or internal) scenario: fill defaults, pad/truncate the SKU list, apply drugLeadTimeMultiplier. */
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
  if (out.drugLeadTimeMultiplier != null && out.drugLeadTimeMultiplier !== 1) {
    out.drugs = out.drugs.map((d) => ({ ...d, leadTimeDays: (d.leadTimeDays ?? 3) * out.drugLeadTimeMultiplier }));
    delete out.drugLeadTimeMultiplier;
  }
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
  SUPPLIER_TIERS,
  WARMUP_DAYS,
  SHOCK_DAYS,
  RECOVERY_DAYS,
  HORIZON_DAYS,
  PHASES,
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  FIELD_HELP,
  LIMITS,
  validateScenario,
  normalizeScenario,
  deepMerge,
  buildPreset,
};
