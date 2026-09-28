const { createRng } = require('./seededRandom');
const { REGION_TYPES } = require('./scenarioSchema');
const { computeEventFactors } = require('./eventUtils');
const { buildSuppliers, drawReliability, supplierDayStatus } = require('./supplyNetwork');
const { assignPharmacyPopulations } = require('./populationAllocation');

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

function networkSeedOf(scenario) {
  return scenario.networkSeed != null ? scenario.networkSeed : scenario.randomSeed;
}

function generateScenarioInstance(scenario) {
  const rng = createRng(scenario.randomSeed);
  const networkRng = createRng(networkSeedOf(scenario));
  const drugs = scenario.drugs.map((d) => ({ ...d }));
  const logistics = scenario.logistics || {};
  const capacityMultiplier = logistics.capacityMultiplier ?? 1;

  const warehouses = [];
  for (let w = 0; w < scenario.warehouseCount; w += 1) {
    const whCfg = scenario.warehouses?.[w] || {};
    warehouses.push({
      id: `WH${w + 1}`,
      capacityInStandardUnits: whCfg.capacityInStandardUnits ?? whCfg.capacityUnits ?? null,
      dailyDispatchCapacity: (whCfg.dailyDispatchCapacity
        ?? logistics.dailyDispatchCapacityPerWarehouse ?? 2500) * capacityMultiplier,
      truckCapacityUnits: (whCfg.truckCapacityUnits
        ?? logistics.truckCapacityUnits ?? 2000) * capacityMultiplier,
      initialStock: {},
      targetStock: {},
      servedDailyDemand: 0,
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
    pharmacies.push({
      id: `PH${p + 1}`,
      index: p,
      regionType,
      population: 0,
      warehouseId: warehouses[p % warehouses.length].id,
      vulnerabilityWeight: reg.vulnerabilityWeight,
      transitDaysBase: reg.transitDays,
      onHand: {},
    });
  }
  assignPharmacyPopulations(pharmacies, scenario, networkRng);

  const whStockMult = logistics.warehouseInitialStockMultiplier ?? 15;
  const phStockMult = logistics.pharmacyInitialStockMultiplier ?? 1;
  const stockDaysMult = logistics.initialStockMultiplier ?? 1;
  const servedDemandByWarehouse = {};
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
      const targetDays = logistics.warehouseTargetStockDays ?? logistics.warehouseInitialStockDays;
      wh.targetStock[drug.id] = targetDays != null
        ? Math.round(baseline * targetDays)
        : wh.initialStock[drug.id];
    }
    wh.servedDailyDemand = servedDailyDemand;
    servedDemandByWarehouse[wh.id] = servedDailyDemand;
    if (wh.capacityInStandardUnits == null) {
      const initialTotal = Object.values(wh.initialStock).reduce((a, b) => a + b, 0);
      const targetTotal = Object.values(wh.targetStock).reduce((a, b) => a + b, 0);
      wh.capacityInStandardUnits = Math.max(
        initialTotal,
        targetTotal,
        Math.round(servedDailyDemand * (logistics.warehouseCapacityDays ?? 45)),
      );
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

  const suppliers = buildSuppliers(scenario, warehouses, servedDemandByWarehouse);
  const reliabilityDraws = drawReliability(scenario, suppliers);

  const dailyPlans = [];
  for (let day = 0; day < scenario.simulationDays; day += 1) {
    const eventFactors = computeEventFactors(scenario, day);
    const supplierStatus = supplierDayStatus(scenario, suppliers, reliabilityDraws, day);
    eventFactors.supplyByWarehouse = supplierStatus.warehouseFactor;
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
    dailyPlans.push({ day, eventFactors, pharmacyDemand, supplierStatus });
  }

  return {
    meta: {
      synthetic: true,
      scenarioId: scenario.id,
      randomSeed: scenario.randomSeed,
      networkSeed: networkSeedOf(scenario),
    },
    scenario,
    warehouses,
    pharmacies,
    drugs,
    suppliers,
    dailyPlans,
    rngStateNote: 'Demand draws consumed RNG stream in fixed pharmacy×drug×day order; independent of policy (common random numbers).',
  };
}

module.exports = {
  generateScenarioInstance,
  computeEventFactors,
  assignPharmacyRegions,
  baselineDailyDemand,
  networkSeedOf,
  PRIORITY_DEMAND_SCALE,
};
