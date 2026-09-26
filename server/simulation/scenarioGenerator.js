const { createRng } = require('./seededRandom');
const { REGION_TYPES } = require('./scenarioSchema');
const { computeEventFactors } = require('./eventUtils');

const PRIORITY_DEMAND_SCALE = { essential: 1.2, 'chronic-care': 1.0, routine: 0.75 };

function assignPharmacyRegions(scenario) {
  const counts = scenario.regionPharmacyCounts || {
    urban: Math.ceil(scenario.pharmacyCount / 3),
    suburban: Math.ceil(scenario.pharmacyCount / 3),
    rural: scenario.pharmacyCount - 2 * Math.ceil(scenario.pharmacyCount / 3),
  };
  const list = [];
  for (const rt of REGION_TYPES) {
    for (let i = 0; i < (counts[rt] || 0); i += 1) list.push(rt);
  }
  while (list.length < scenario.pharmacyCount) list.push(REGION_TYPES[list.length % REGION_TYPES.length]);
  return list.slice(0, scenario.pharmacyCount);
}

/**
 * Planning prior: expected undisturbed daily demand from configured parameters only
 * (never from realized draws). Policies may use this as their day-0 forecast.
 */
function baselineDailyDemand(pharmacy, drug, scenario) {
  const reg = scenario.regions[pharmacy.regionType];
  return (pharmacy.population / 1000) * reg.baseDemand * (PRIORITY_DEMAND_SCALE[drug.priority] ?? 1);
}

function generateScenarioInstance(scenario) {
  const rng = createRng(scenario.randomSeed);
  const drugs = scenario.drugs.map((d) => ({ ...d }));
  const logistics = scenario.logistics || {};
  const capacityMultiplier = logistics.capacityMultiplier ?? 1;

  const warehouses = [];
  for (let w = 0; w < scenario.warehouseCount; w += 1) {
    warehouses.push({
      id: `WH${w + 1}`,
      capacityUnits: scenario.warehouses?.[w]?.capacityUnits ?? 50000 + rng.int(0, 20000),
      dailyDispatchCapacity: (scenario.warehouses?.[w]?.dailyDispatchCapacity
        ?? logistics.dailyDispatchCapacityPerWarehouse ?? 2500) * capacityMultiplier,
      truckCapacityUnits: (scenario.warehouses?.[w]?.truckCapacityUnits
        ?? logistics.truckCapacityUnits ?? 2000) * capacityMultiplier,
      initialStock: {},
      inboundBase: {},
    });
  }

  const regionTypes = assignPharmacyRegions(scenario);
  const pharmacies = [];
  const phCountByRegion = {};
  for (const rt of regionTypes) {
    phCountByRegion[rt] = (phCountByRegion[rt] || 0) + 1;
  }

  for (let p = 0; p < scenario.pharmacyCount; p += 1) {
    const regionType = regionTypes[p];
    const reg = scenario.regions[regionType];
    const nInRegion = phCountByRegion[regionType] || 1;
    const popShare = reg.population / nInRegion;
    pharmacies.push({
      id: `PH${p + 1}`,
      index: p,
      regionType,
      population: Math.round(popShare * (0.95 + rng.next() * 0.1)),
      warehouseId: warehouses[p % warehouses.length].id,
      vulnerabilityWeight: reg.vulnerabilityWeight,
      transitDaysBase: reg.transitDays,
      onHand: {},
    });
  }

  const whStockMult = logistics.warehouseInitialStockMultiplier ?? 15;
  const phStockMult = logistics.pharmacyInitialStockMultiplier ?? 1;
  const inboundCoverage = logistics.upstreamInboundCoverage ?? 1.1;
  const stockDaysMult = logistics.initialStockMultiplier ?? 1;
  for (const wh of warehouses) {
    const served = pharmacies.filter((p) => p.warehouseId === wh.id);
    let servedDailyDemand = 0;
    for (const drug of drugs) {
      const jitter = rng.int(0, 500);
      const baseline = served.reduce((s, ph) => s + baselineDailyDemand(ph, drug, scenario), 0);
      servedDailyDemand += baseline;
      wh.initialStock[drug.id] = logistics.warehouseInitialStockDays != null
        ? Math.round(baseline * logistics.warehouseInitialStockDays * stockDaysMult)
        : Math.round((drug.initialStock ?? 200) * whStockMult + jitter);
      wh.inboundBase[drug.id] = baseline * inboundCoverage;
    }
    if (logistics.dispatchCapacityCoverage != null) {
      wh.dailyDispatchCapacity = Math.round(servedDailyDemand * logistics.dispatchCapacityCoverage * capacityMultiplier);
    }
    if (logistics.truckCapacityCoverage != null) {
      wh.truckCapacityUnits = Math.round(servedDailyDemand * logistics.truckCapacityCoverage * capacityMultiplier);
    }
  }
  for (const ph of pharmacies) {
    for (const drug of drugs) {
      ph.onHand[drug.id] = logistics.pharmacyInitialStockDays != null
        ? Math.round(baselineDailyDemand(ph, drug, scenario) * logistics.pharmacyInitialStockDays * stockDaysMult)
        : Math.round((drug.initialStock ?? 200) * phStockMult);
    }
  }

  const dailyPlans = [];
  for (let day = 0; day < scenario.simulationDays; day += 1) {
    const eventFactors = computeEventFactors(scenario, day);
    const pharmacyDemand = pharmacies.map((ph) => {
      const reg = scenario.regions[ph.regionType];
      const drugDemand = {};
      for (const drug of drugs) {
        const noise = 1 + rng.normal(0, reg.demandVolatility);
        let units = baselineDailyDemand(ph, drug, scenario) * noise * eventFactors.demand[ph.regionType];
        units = Math.max(0, Math.round(units * (scenario.demandMultiplier ?? 1)));
        drugDemand[drug.id] = units;
      }
      return { pharmacyId: ph.id, regionType: ph.regionType, drugDemand };
    });
    dailyPlans.push({ day, eventFactors, pharmacyDemand });
  }

  return {
    meta: {
      synthetic: true,
      scenarioId: scenario.id,
      randomSeed: scenario.randomSeed,
    },
    scenario,
    warehouses,
    pharmacies,
    drugs,
    dailyPlans,
    rngStateNote: 'Demand draws consumed RNG stream in fixed pharmacy×drug×day order; independent of policy (common random numbers).',
  };
}

module.exports = {
  generateScenarioInstance,
  computeEventFactors,
  assignPharmacyRegions,
  baselineDailyDemand,
  PRIORITY_DEMAND_SCALE,
};
