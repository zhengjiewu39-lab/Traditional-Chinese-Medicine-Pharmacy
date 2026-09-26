const { generateScenarioInstance } = require('./scenarioGenerator');
const {
  initPharmacyState,
  initWarehouseState,
  fulfillDemand,
} = require('./inventoryEngine');
const {
  scheduleShipment,
  processArrivals,
  allocateTruckCapacity,
} = require('./distributionEngine');
const { decideReplenishment, getPolicy, resolvePolicyId } = require('./policyEngine');
const { computeRunMetrics } = require('./metricsEngine');

const ENGINE_VERSION = 'simulation-engine-v1.0.0';
const HOLDING_COST = 0.02;
const ORDER_COST = 25;
const TRANSPORT_COST_PER_UNIT = 0.15;

function runSimulation({ scenario, policyId, onProgress, shouldCancel }) {
  const canonicalPolicyId = resolvePolicyId(policyId);
  const policy = getPolicy(policyId);
  if (!policy) throw new Error(`Unknown policy: ${policyId}`);

  const instance = generateScenarioInstance(scenario);
  const pharmacyStates = instance.pharmacies.map(initPharmacyState);
  const warehouseStates = instance.warehouses.map(initWarehouseState);
  let inTransit = [];
  let totalCost = 0;
  const daily = [];
  const recentStockoutsByPharmacy = {};

  const drugMeta = Object.fromEntries(instance.drugs.map((d) => [d.id, d]));
  const phMap = Object.fromEntries(instance.pharmacies.map((p) => [p.id, p]));

  for (let day = 0; day < scenario.simulationDays; day += 1) {
    if (shouldCancel?.()) {
      return { cancelled: true, day, engineVersion: ENGINE_VERSION };
    }

    inTransit = processArrivals(day, inTransit, pharmacyStates);
    const plan = instance.dailyPlans[day];
    const pharmacyResults = [];
    let dayInventory = 0;
    const priorityTotals = {
      essential: { demand: 0, filled: 0, stockout: 0 },
      'chronic-care': { demand: 0, filled: 0, stockout: 0 },
      routine: { demand: 0, filled: 0, stockout: 0 },
    };
    let dayDemand = 0;
    let dayStockout = 0;

    for (const phState of pharmacyStates) {
      const ph = phMap[phState.id];
      const demandRow = plan.pharmacyDemand.find((r) => r.pharmacyId === ph.id);
      let demand = 0;
      let filled = 0;
      let stockout = 0;
      let waitDays = 0;
      const stockoutByDrug = [];

      for (const [drugId, units] of Object.entries(demandRow?.drugDemand || {})) {
        demand += units;
        const res = fulfillDemand(ph, drugId, units, phState);
        filled += res.filled;
        stockout += res.stockout;
        const pr = drugMeta[drugId]?.priority || 'routine';
        if (priorityTotals[pr]) {
          priorityTotals[pr].demand += units;
          priorityTotals[pr].filled += res.filled;
          priorityTotals[pr].stockout += res.stockout;
        }
        dayDemand += units;
        dayStockout += res.stockout;
        if (res.stockout > 0) {
          const meta = drugMeta[drugId];
          stockoutByDrug.push({ drugId, units: res.stockout, priority: meta.priority });
          recentStockoutsByPharmacy[ph.id] = (recentStockoutsByPharmacy[ph.id] || 0) + res.stockout;
          waitDays += 1.0 * plan.eventFactors.transit[ph.regionType];
        }
      }

      const avgWait = demand > 0 ? waitDays : 0;
      pharmacyResults.push({
        pharmacyId: ph.id,
        regionType: ph.regionType,
        demand,
        filled,
        stockout,
        waitDays: avgWait,
        stockoutByDrug,
      });

      for (const v of Object.values(phState.onHand)) dayInventory += v;
    }

    for (const wh of warehouseStates) {
      for (const v of Object.values(wh.onHand)) dayInventory += v;
    }

    totalCost += dayInventory * HOLDING_COST;

    const orders = decideReplenishment({
      policyId: canonicalPolicyId,
      day,
      instance,
      pharmacyStates,
      warehouseStates,
      recentStockoutsByPharmacy,
    });

    const shipments = [];
    const batched = allocateTruckCapacity(orders);
    for (const o of batched) {
      const ph = phMap[o.pharmacyId];
      const transit = ph.transitDaysBase * plan.eventFactors.transit[ph.regionType]
        * plan.eventFactors.lead[ph.regionType];
      scheduleShipment({
        pharmacy: ph,
        drugId: o.drugId,
        qty: o.qty,
        currentDay: day,
        transitDays: transit,
        inTransit,
      });
      totalCost += ORDER_COST + o.qty * TRANSPORT_COST_PER_UNIT;
      shipments.push({ ...o, transitDays: transit });
    }

    daily.push({
      day,
      pharmacyResults,
      shipments,
      totalInventory: dayInventory,
      priorityTotals,
      dailyStockoutRate: dayDemand > 0 ? dayStockout / dayDemand : 0,
      dailyFillRate: dayDemand > 0 ? (dayDemand - dayStockout) / dayDemand : 1,
    });
    if (onProgress) onProgress({ day, totalDays: scenario.simulationDays, pct: ((day + 1) / scenario.simulationDays) * 100 });
  }

  const runLog = {
    engineVersion: ENGINE_VERSION,
    policyId: canonicalPolicyId,
    policyVersion: policy.version,
    scenarioId: scenario.id,
    randomSeed: scenario.randomSeed,
    totalCost,
    daily,
  };

  const metrics = computeRunMetrics(runLog, instance, canonicalPolicyId);
  return {
    cancelled: false,
    instanceMeta: instance.meta,
    runLog,
    metrics,
    engineVersion: ENGINE_VERSION,
  };
}

function runReplicates({ scenario, policyId, replicates, onProgress, shouldCancel }) {
  const results = [];
  for (let i = 0; i < replicates; i += 1) {
    const seedOffset = scenario.randomSeed + i;
    const scen = { ...scenario, randomSeed: seedOffset };
    const r = runSimulation({
      scenario: scen,
      policyId,
      shouldCancel,
      onProgress: (p) => onProgress?.({ ...p, replicate: i + 1, replicates }),
    });
    if (r.cancelled) return { cancelled: true, results };
    results.push({ replicateIndex: i, seed: seedOffset, metrics: r.metrics, runLog: r.runLog });
  }
  return { cancelled: false, results };
}

module.exports = {
  ENGINE_VERSION,
  runSimulation,
  runReplicates,
};
