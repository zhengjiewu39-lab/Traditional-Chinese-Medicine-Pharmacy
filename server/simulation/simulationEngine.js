const { generateScenarioInstance } = require('./scenarioGenerator');
const {
  initPharmacyState,
  initWarehouseState,
  fulfillDemandWithBackorder,
  warehouseIssue,
  accrueBacklogWait,
  finalizeHorizonBacklog,
} = require('./inventoryEngine');
const {
  scheduleShipment,
  processArrivals,
  allocateTruckCapacityByWarehouse,
  computeTransitDays,
  transportCostPerUnit,
} = require('./distributionEngine');
const { applyWarehouseSupplyCaps } = require('./dispatchEngine');
const { decideReplenishment, getPolicy, resolvePolicyId } = require('./policyEngine');
const { computeRunMetrics } = require('./metricsEngine');
const { ENGINE_VERSION } = require('./simulationConstants');

function computeRegionalStockoutRates(pharmacyResults) {
  const by = { urban: { d: 0, s: 0 }, suburban: { d: 0, s: 0 }, rural: { d: 0, s: 0 } };
  for (const row of pharmacyResults) {
    const b = by[row.regionType];
    if (!b) continue;
    b.d += row.demand;
    b.s += row.stockout;
  }
  const out = {};
  for (const [k, v] of Object.entries(by)) {
    out[k] = v.d > 0 ? v.s / v.d : 0;
  }
  return out;
}

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
  const orderCost = scenario.logistics?.orderCost ?? 25;
  let lastPharmacyResults = [];

  const drugMeta = Object.fromEntries(instance.drugs.map((d) => [d.id, d]));
  const phMap = Object.fromEntries(instance.pharmacies.map((p) => [p.id, p]));
  const drugMap = drugMeta;

  for (let day = 0; day < scenario.simulationDays; day += 1) {
    if (shouldCancel?.()) {
      return { cancelled: true, day, engineVersion: ENGINE_VERSION };
    }

    inTransit = processArrivals(day, inTransit, pharmacyStates, drugMeta);
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
    let dayAccessDelayUnitDays = 0;

    for (const phState of pharmacyStates) {
      const ph = phMap[phState.id];
      const demandRow = plan.pharmacyDemand.find((r) => r.pharmacyId === ph.id);
      let demand = 0;
      let filled = 0;
      let stockout = 0;
      const stockoutByDrug = [];

      for (const [drugId, units] of Object.entries(demandRow?.drugDemand || {})) {
        demand += units;
        const res = fulfillDemandWithBackorder(ph, drugId, units, phState, drugMeta[drugId]);
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
          stockoutByDrug.push({ drugId, units: res.stockout, priority: pr });
        }
      }

      const backlogBeforeWait = Object.values(phState.backlog).reduce((a, b) => a + b, 0);
      accrueBacklogWait(phState);
      dayAccessDelayUnitDays += backlogBeforeWait;

      const backlogUnits = Object.values(phState.backlog).reduce((a, b) => a + b, 0);
      pharmacyResults.push({
        pharmacyId: ph.id,
        regionType: ph.regionType,
        demand,
        filled,
        stockout,
        backlogUnits,
        accessDelayUnitDays: phState.backlogUnitDays,
        stockoutByDrug,
      });

      for (const v of Object.values(phState.onHand)) dayInventory += v;
    }

    for (const wh of warehouseStates) {
      for (const v of Object.values(wh.onHand)) dayInventory += v;
    }

    for (const drug of instance.drugs) {
      for (const phState of pharmacyStates) {
        totalCost += (phState.onHand[drug.id] || 0) * (drug.holdingCostPerUnitDay ?? 0.02);
      }
      for (const wh of warehouseStates) {
        totalCost += (wh.onHand[drug.id] || 0) * (drug.holdingCostPerUnitDay ?? 0.02);
      }
    }

    const regionalStockoutRate = computeRegionalStockoutRates(lastPharmacyResults.length ? lastPharmacyResults : pharmacyResults);

    const { orders: requestedOrders, decisions: policyDecisions } = decideReplenishment({
      policyId: canonicalPolicyId,
      day,
      instance,
      pharmacyStates,
      warehouseStates,
      regionalStockoutRate,
    });

    const { accepted: afterSupply, supplyLog } = applyWarehouseSupplyCaps(
      requestedOrders,
      instance.warehouses,
      instance.pharmacies,
      plan.eventFactors,
      phMap,
      drugMap,
    );

    const { accepted: truckAccepted, allocationLog } = allocateTruckCapacityByWarehouse(
      afterSupply,
      instance.warehouses,
      phMap,
      drugMap,
    );

    const shipments = [];
    for (const o of truckAccepted) {
      const whState = warehouseStates.find((w) => w.id === o.warehouseId);
      const shipped = warehouseIssue(whState, o.drugId, o.qty);
      if (shipped <= 0) continue;
      const ph = phMap[o.pharmacyId];
      const drug = drugMeta[o.drugId];
      const transit = computeTransitDays(ph, scenario.regions[ph.regionType], drug, plan, scenario);
      const transport = transportCostPerUnit(ph, scenario);
      totalCost += orderCost + shipped * (transport + (drug.unitProcurementCost ?? 0));
      scheduleShipment({
        pharmacy: ph,
        drugId: o.drugId,
        qty: shipped,
        currentDay: day,
        transitDays: transit,
        inTransit,
      });
      shipments.push({ ...o, qty: shipped, transitDays: transit, transportCostPerUnit: transport });
    }

    daily.push({
      day,
      eventFactors: plan.eventFactors,
      pharmacyResults,
      policyDecisions,
      supplyLog,
      allocationLog,
      shipments,
      totalInventory: dayInventory,
      priorityTotals,
      dailyStockoutRate: dayDemand > 0 ? dayStockout / dayDemand : 0,
      dailyFillRate: dayDemand > 0 ? (dayDemand - dayStockout) / dayDemand : 1,
      dailyAccessDelayUnitDays: dayAccessDelayUnitDays,
    });

    lastPharmacyResults = pharmacyResults;
    if (onProgress) onProgress({ day, totalDays: scenario.simulationDays, pct: ((day + 1) / scenario.simulationDays) * 100 });
  }

  for (const phState of pharmacyStates) finalizeHorizonBacklog(phState);

  const runLog = {
    engineVersion: ENGINE_VERSION,
    policyId: canonicalPolicyId,
    policyVersion: policy.version,
    scenarioId: scenario.id,
    randomSeed: scenario.randomSeed,
    totalCost,
    daily,
    pharmacyStatesSummary: pharmacyStates.map((p) => ({
      id: p.id,
      permanentlyUnmetUnits: p.permanentlyUnmetUnits,
      eventuallyFilledUnits: p.eventuallyFilledUnits,
      backlogUnitDays: p.backlogUnitDays,
    })),
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
