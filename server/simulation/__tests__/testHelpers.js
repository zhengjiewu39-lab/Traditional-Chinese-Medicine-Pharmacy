const { normalizeScenario, deepMerge } = require('../scenarioSchema');
const { generateScenarioInstance } = require('../scenarioGenerator');
const { initPharmacyState, initWarehouseState } = require('../inventoryEngine');
const { initForecasts } = require('../forecastEngine');
const { NEUTRAL_FACTORS } = require('../distributionEngine');

const ALL_POLICIES = [
  'fixed-allocation',
  'reorder-point',
  'cost-first',
  'equity-aware',
  'equity-constrained-rolling-horizon',
];

const ABLATIONS = [
  'errra-no-floor',
  'errra-no-vulnerability',
  'errra-no-rolling',
  'errra-no-essential-priority',
  'errra-no-compound-awareness',
];

/** Small synthetic network with demand-relative logistics and no events. */
function smallScenario(patch = {}) {
  return normalizeScenario(deepMerge({
    simulationDays: 40,
    pharmacyCount: 6,
    regionPharmacyCounts: { urban: 2, suburban: 2, rural: 2 },
    randomSeed: 11,
    events: [],
    logistics: {
      orderCost: 25,
      transportCostPerUnit: 0.15,
      pharmacyInitialStockDays: 3,
      warehouseInitialStockDays: 30,
      upstreamInboundCoverage: 1.2,
      dispatchCapacityCoverage: 5,
      truckCapacityCoverage: 5,
    },
  }, patch));
}

/** Decision context on day `day` from a fresh instance; `mutate` may edit states before deciding. */
function makeCtx({ scenario, policyId, day = 0, mutate, eventFactors = NEUTRAL_FACTORS, regionalStats = {} }) {
  const instance = generateScenarioInstance(scenario);
  const pharmacyStates = instance.pharmacies.map(initPharmacyState);
  const warehouseStates = instance.warehouses.map(initWarehouseState);
  const forecasts = initForecasts(instance);
  const ctx = { policyId, day, instance, pharmacyStates, warehouseStates, forecasts, eventFactors, regionalStats };
  if (mutate) mutate(ctx);
  return ctx;
}

function orderQty(result, pharmacyId, drugId) {
  return result.orders
    .filter((o) => o.pharmacyId === pharmacyId && o.drugId === drugId)
    .reduce((s, o) => s + o.qty, 0);
}

module.exports = { ALL_POLICIES, ABLATIONS, smallScenario, makeCtx, orderQty };
