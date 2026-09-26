const { createRng } = require('./seededRandom');
const { REGION_TYPES } = require('./scenarioSchema');
const { computeEventFactors } = require('./eventUtils');

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

function generateScenarioInstance(scenario) {
  const rng = createRng(scenario.randomSeed);
  const drugs = scenario.drugs.map((d) => ({ ...d }));

  const warehouses = [];
  for (let w = 0; w < scenario.warehouseCount; w += 1) {
    warehouses.push({
      id: `WH${w + 1}`,
      capacityUnits: scenario.warehouses?.[w]?.capacityUnits ?? 50000 + rng.int(0, 20000),
      dailyDispatchCapacity: scenario.warehouses?.[w]?.dailyDispatchCapacity ?? scenario.logistics?.dailyDispatchCapacityPerWarehouse ?? 2500,
      truckCapacityUnits: scenario.warehouses?.[w]?.truckCapacityUnits ?? scenario.logistics?.truckCapacityUnits ?? 2000,
      initialStock: {},
    });
  }

  const regionTypes = assignPharmacyRegions(scenario);
  const popByRegion = {};
  for (const rt of REGION_TYPES) popByRegion[rt] = scenario.regions[rt].population;

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
      regionType,
      population: Math.round(popShare * (0.95 + rng.next() * 0.1)),
      warehouseId: warehouses[p % warehouses.length].id,
      vulnerabilityWeight: reg.vulnerabilityWeight,
      transitDaysBase: reg.transitDays,
      onHand: {},
    });
  }

  for (const wh of warehouses) {
    for (const drug of drugs) {
      wh.initialStock[drug.id] = Math.round((drug.initialStock ?? 200) * 15 + rng.int(0, 500));
    }
  }
  for (const ph of pharmacies) {
    for (const drug of drugs) {
      ph.onHand[drug.id] = drug.initialStock ?? 200;
    }
  }

  const dailyPlans = [];
  for (let day = 0; day < scenario.simulationDays; day += 1) {
    const eventFactors = computeEventFactors(scenario, day);
    const pharmacyDemand = pharmacies.map((ph) => {
      const reg = scenario.regions[ph.regionType];
      const drugDemand = {};
      for (const drug of drugs) {
        const priorityScale = drug.priority === 'essential' ? 1.2 : drug.priority === 'chronic-care' ? 1.0 : 0.75;
        const noise = 1 + rng.normal(0, reg.demandVolatility);
        let units = (ph.population / 1000) * reg.baseDemand * priorityScale * noise * eventFactors.demand[ph.regionType];
        units = Math.max(0, Math.round(units));
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
    rngStateNote: 'Demand draws consumed RNG stream in fixed pharmacy×drug×day order.',
  };
}

module.exports = { generateScenarioInstance, computeEventFactors, assignPharmacyRegions };
