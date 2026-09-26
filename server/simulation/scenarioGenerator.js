const { createRng } = require('./rng');
const { REGION_TYPES } = require('./scenarioSchema');

/**
 * Build synthetic network topology and daily demand multipliers from scenario + seed.
 */
function generateScenarioInstance(scenario) {
  const rng = createRng(scenario.randomSeed);
  const drugs = scenario.drugs.map((d) => ({ ...d }));

  const warehouses = [];
  for (let w = 0; w < scenario.warehouseCount; w += 1) {
    warehouses.push({
      id: `WH${w + 1}`,
      capacityUnits: 50000 + rng.int(0, 20000),
      initialStock: {},
    });
  }

  const pharmacies = [];
  const regionMix = REGION_TYPES;
  for (let p = 0; p < scenario.pharmacyCount; p += 1) {
    const regionType = regionMix[p % regionMix.length];
    const reg = scenario.regions[regionType];
    pharmacies.push({
      id: `PH${p + 1}`,
      regionType,
      population: Math.round(reg.population * (0.8 + rng.next() * 0.4)),
      warehouseId: warehouses[p % warehouses.length].id,
      vulnerabilityWeight: reg.vulnerabilityWeight,
      transitDaysBase: reg.transitDays,
      onHand: {},
    });
  }

  for (const wh of warehouses) {
    for (const drug of drugs) {
      wh.initialStock[drug.id] = 8000 + rng.int(0, 4000);
    }
  }
  for (const ph of pharmacies) {
    for (const drug of drugs) {
      ph.onHand[drug.id] = 200 + rng.int(0, 150);
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
    dailyPlans.push({
      day,
      eventFactors,
      pharmacyDemand,
    });
  }

  return {
    meta: {
      synthetic: true,
      scenarioId: scenario.id,
      randomSeed: scenario.randomSeed,
      generatedAt: new Date().toISOString(),
    },
    scenario,
    warehouses,
    pharmacies,
    drugs,
    dailyPlans,
    rngStateNote: 'Demand draws consumed RNG stream in fixed pharmacy×drug×day order.',
  };
}

function computeEventFactors(scenario, day) {
  const demand = { urban: 1, suburban: 1, rural: 1 };
  const supply = { urban: 1, suburban: 1, rural: 1 };
  const transit = { urban: 1, suburban: 1, rural: 1 };
  const lead = { urban: 1, suburban: 1, rural: 1 };

  for (const ev of scenario.events || []) {
    if (day < ev.startDay || day >= ev.startDay + ev.durationDays) continue;
    const targets = ev.targetRegions || REGION_TYPES;
    for (const rt of targets) {
      if (ev.type === 'demandSurge') demand[rt] *= ev.magnitude;
      if (ev.type === 'supplyDisruption') supply[rt] *= ev.magnitude;
      if (ev.type === 'roadDisruption') transit[rt] *= ev.magnitude;
      if (ev.type === 'leadTimeExtension') lead[rt] *= ev.magnitude;
    }
  }
  return { demand, supply, transit, lead };
}

module.exports = { generateScenarioInstance, computeEventFactors };
