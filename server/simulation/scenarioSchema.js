/** Scenario parameter definitions, defaults, validation, and help text. */

const REGION_TYPES = ['urban', 'suburban', 'rural'];
const DRUG_PRIORITIES = ['essential', 'chronic-care', 'routine'];
const EVENT_TYPES = ['demandSurge', 'supplyDisruption', 'roadDisruption', 'leadTimeExtension'];

const DEFAULT_SCENARIO = {
  id: 'public-health-emergency-default',
  name: 'Default public health emergency (synthetic)',
  description: 'Synthetic surge + partial supply disruption + rural delivery delay.',
  randomSeed: 20240901,
  simulationDays: 30,
  warehouseCount: 2,
  pharmacyCount: 12,
  drugCount: 8,
  regions: {
    urban: { population: 50000, baseDemand: 1.0, demandVolatility: 0.15, transitDays: 0.5, vulnerabilityWeight: 1.0 },
    suburban: { population: 20000, baseDemand: 0.85, demandVolatility: 0.2, transitDays: 1.0, vulnerabilityWeight: 1.2 },
    rural: { population: 8000, baseDemand: 0.7, demandVolatility: 0.25, transitDays: 2.5, vulnerabilityWeight: 1.6 },
  },
  drugs: [
    { id: 'D1', name: 'Synthetic essential A', priority: 'essential' },
    { id: 'D2', name: 'Synthetic essential B', priority: 'essential' },
    { id: 'D3', name: 'Synthetic chronic C', priority: 'chronic-care' },
    { id: 'D4', name: 'Synthetic chronic D', priority: 'chronic-care' },
    { id: 'D5', name: 'Synthetic routine E', priority: 'routine' },
    { id: 'D6', name: 'Synthetic routine F', priority: 'routine' },
    { id: 'D7', name: 'Synthetic routine G', priority: 'routine' },
    { id: 'D8', name: 'Synthetic routine H', priority: 'routine' },
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
  },
};

const FIELD_HELP = {
  randomSeed: 'Integer seed for reproducible synthetic demand and disruptions.',
  simulationDays: 'Number of discrete daily simulation steps (1–365).',
  warehouseCount: 'Central warehouses replenishing pharmacies (1–10).',
  pharmacyCount: 'Community pharmacies in the synthetic network (3–60).',
  drugCount: 'Count of synthetic drug SKUs (uses first N from drugs list or auto-generated).',
  'regions.*.population': 'Synthetic population served; drives baseline demand scale.',
  'regions.*.baseDemand': 'Relative demand multiplier (0.2–2.0).',
  'regions.*.demandVolatility': 'Daily demand noise σ (0–1).',
  'regions.*.transitDays': 'Mean warehouse-to-pharmacy transit time in days.',
  'regions.*.vulnerabilityWeight': 'Equity weight for underserved areas (≥1).',
  'events.*.magnitude': 'Surge multiplier, supply fraction, delay factor, etc., by event type.',
};

const LIMITS = {
  simulationDays: [1, 365],
  warehouseCount: [1, 10],
  pharmacyCount: [3, 60],
  drugCount: [2, 20],
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function validateScenario(input) {
  const errors = [];
  const scenario = normalizeScenario({ ...DEFAULT_SCENARIO, ...input });
  for (const rt of REGION_TYPES) {
    if (!scenario.regions?.[rt]) errors.push(`Missing region config: ${rt}`);
  }
  if (scenario.events) {
    for (const ev of scenario.events) {
      if (!EVENT_TYPES.includes(ev.type)) errors.push(`Unknown event type: ${ev.type}`);
    }
  }
  const warnings = [];
  const raw = { ...DEFAULT_SCENARIO, ...input };
  if (raw.simulationDays != null && raw.simulationDays !== scenario.simulationDays) {
    warnings.push(`simulationDays clamped to ${scenario.simulationDays}`);
  }
  if (raw.pharmacyCount != null && raw.pharmacyCount !== scenario.pharmacyCount) {
    warnings.push(`pharmacyCount clamped to ${scenario.pharmacyCount}`);
  }
  return { valid: errors.length === 0, errors, warnings, scenario };
}

function normalizeScenario(s) {
  const out = JSON.parse(JSON.stringify({ ...DEFAULT_SCENARIO, ...s }));
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
    });
  }
  out.drugs = out.drugs.slice(0, out.drugCount);
  return out;
}

module.exports = {
  REGION_TYPES,
  DRUG_PRIORITIES,
  EVENT_TYPES,
  DEFAULT_SCENARIO,
  FIELD_HELP,
  LIMITS,
  validateScenario,
  normalizeScenario,
};
