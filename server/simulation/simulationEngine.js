const { generateScenarioInstance } = require('./scenarioGenerator');
const {
  initPharmacyState,
  initWarehouseState,
  fulfillDemandWithBackorder,
  warehouseIssue,
  warehouseReceive,
  markShipped,
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
const { applyWarehouseSupplyCaps, warehouseSupplyFactor } = require('./dispatchEngine');
const { decideReplenishment, getPolicy, resolvePolicyId } = require('./policyEngine');
const { initForecasts, updateForecast } = require('./forecastEngine');
const { summarizeWindow } = require('./equitySignals');
const { computeRunMetrics } = require('./metricsEngine');
const { ENGINE_VERSION, PRIORITY_WEIGHT } = require('./simulationConstants');
const { REGION_TYPES } = require('./scenarioSchema');

const EQUITY_WINDOW_DAYS = 7;

function emptyRegionDaily() {
  return Object.fromEntries(REGION_TYPES.map((rt) => [rt, {
    demand: 0, filled: 0, stockout: 0, essDemand: 0, essFilled: 0, essStockout: 0, backlog: 0, delayUnitDays: 0,
  }]));
}

class ConservationError extends Error {}

/**
 * Stock-flow identities checked per SKU at the end of every simulated day:
 *   (1) Σ warehouse onHand + Σ pharmacy onHand + Σ in-transit = initial + cumulative inbound − cumulative dispensed
 *   (2) Σ pharmacy onOrder = Σ in-transit
 *   (3) cumulative backordered = Σ backlog + cumulative served from backlog
 */
function checkConservation({ day, drugs, pharmacyStates, warehouseStates, inTransit, ledger }) {
  for (const drug of drugs) {
    const id = drug.id;
    const whStock = warehouseStates.reduce((s, w) => s + (w.onHand[id] || 0), 0);
    const phStock = pharmacyStates.reduce((s, p) => s + (p.onHand[id] || 0), 0);
    const transit = inTransit.filter((x) => x.drugId === id).reduce((s, x) => s + x.qty, 0);
    const onOrder = pharmacyStates.reduce((s, p) => s + (p.onOrder[id] || 0), 0);
    const backlog = pharmacyStates.reduce((s, p) => s + (p.backlog[id] || 0), 0);
    const served = pharmacyStates.reduce((s, p) => s + (p.backlogServed[id] || 0), 0);
    const expected = ledger.initial[id] + ledger.inbound[id] - ledger.dispensed[id];
    const neg = pharmacyStates.some((p) => (p.onHand[id] || 0) < 0 || (p.backlog[id] || 0) < 0 || (p.onOrder[id] || 0) < 0)
      || warehouseStates.some((w) => (w.onHand[id] || 0) < 0);
    if (neg) throw new ConservationError(`day ${day} ${id}: negative stock/backlog/onOrder`);
    if (Math.abs(whStock + phStock + transit - expected) > 1e-6) {
      throw new ConservationError(`day ${day} ${id}: stock ${whStock + phStock + transit} ≠ expected ${expected}`);
    }
    if (Math.abs(onOrder - transit) > 1e-6) {
      throw new ConservationError(`day ${day} ${id}: onOrder ${onOrder} ≠ inTransit ${transit}`);
    }
    if (Math.abs(ledger.backordered[id] - (backlog + served)) > 1e-6) {
      throw new ConservationError(`day ${day} ${id}: backordered ${ledger.backordered[id]} ≠ backlog ${backlog} + served ${served}`);
    }
  }
}

/**
 * @param {Object} opts
 * @param {'full'|'summary'} [opts.logLevel='full'] — 'summary' omits per-pharmacy and per-order logs (for large batches).
 * @param {boolean} [opts.checkConservation=false]
 * @param {Object} [opts.policyParams] — overrides merged on top of policy defaults and scenario.policyParams.
 */
function runSimulation({
  scenario,
  policyId,
  onProgress,
  shouldCancel,
  logLevel = 'full',
  checkConservation: doCheck = false,
  policyParams,
}) {
  const canonicalPolicyId = resolvePolicyId(policyId);
  const policy = getPolicy(policyId);
  if (!policy) throw new Error(`Unknown policy: ${policyId}`);
  const full = logLevel === 'full';

  const instance = generateScenarioInstance(scenario);
  const pharmacyStates = instance.pharmacies.map(initPharmacyState);
  const warehouseStates = instance.warehouses.map(initWarehouseState);
  const forecasts = initForecasts(instance);
  const phMap = Object.fromEntries(instance.pharmacies.map((p) => [p.id, p]));
  const drugMeta = Object.fromEntries(instance.drugs.map((d) => [d.id, d]));
  const orderCost = scenario.logistics?.orderCost ?? 25;
  const penaltyFor = (drug) => drug.stockoutPenalty ?? scenario.metricsWeights?.stockoutPenaltyByPriority?.[drug.priority] ?? 15;

  const ledger = { initial: {}, inbound: {}, dispensed: {}, backordered: {} };
  for (const d of instance.drugs) {
    ledger.initial[d.id] = warehouseStates.reduce((s, w) => s + (w.onHand[d.id] || 0), 0)
      + pharmacyStates.reduce((s, p) => s + (p.onHand[d.id] || 0), 0);
    ledger.inbound[d.id] = 0;
    ledger.dispensed[d.id] = 0;
    ledger.backordered[d.id] = 0;
  }
  const costs = { procurement: 0, transport: 0, orderFixed: 0, pharmacyHolding: 0, warehouseHolding: 0 };
  const regionHistory = [];
  let inTransit = [];
  const daily = [];

  for (let day = 0; day < scenario.simulationDays; day += 1) {
    if (shouldCancel?.()) {
      return { cancelled: true, day, engineVersion: ENGINE_VERSION };
    }
    const plan = instance.dailyPlans[day];

    for (const wh of instance.warehouses) {
      const factor = warehouseSupplyFactor(wh.id, instance.pharmacies, plan.eventFactors);
      const whState = warehouseStates.find((w) => w.id === wh.id);
      for (const d of instance.drugs) {
        const qty = Math.round((wh.inboundBase[d.id] || 0) * factor);
        warehouseReceive(whState, d.id, qty);
        ledger.inbound[d.id] += qty;
      }
    }

    const servedBefore = Object.fromEntries(instance.drugs.map((d) => [
      d.id, pharmacyStates.reduce((s, p) => s + (p.backlogServed[d.id] || 0), 0),
    ]));
    inTransit = processArrivals(day, inTransit, pharmacyStates);

    const regionDaily = emptyRegionDaily();
    const pharmacyResults = [];
    const priorityTotals = {
      essential: { demand: 0, filled: 0, stockout: 0 },
      'chronic-care': { demand: 0, filled: 0, stockout: 0 },
      routine: { demand: 0, filled: 0, stockout: 0 },
    };
    let dayDemand = 0;
    let dayStockout = 0;
    let dayAccessDelayUnitDays = 0;
    let weightedStockoutPenalty = 0;

    plan.pharmacyDemand.forEach((demandRow, idx) => {
      const phState = pharmacyStates[idx];
      const ph = phMap[phState.id];
      const rd = regionDaily[ph.regionType];
      let demand = 0;
      let filled = 0;
      let stockout = 0;
      const stockoutByDrug = [];

      for (const [drugId, units] of Object.entries(demandRow.drugDemand)) {
        const drug = drugMeta[drugId];
        const res = fulfillDemandWithBackorder(ph, drugId, units, phState);
        ledger.dispensed[drugId] += res.filled;
        ledger.backordered[drugId] += res.backordered;
        demand += units;
        filled += res.filled;
        stockout += res.stockout;
        const pr = drug.priority || 'routine';
        priorityTotals[pr].demand += units;
        priorityTotals[pr].filled += res.filled;
        priorityTotals[pr].stockout += res.stockout;
        if (pr === 'essential') {
          rd.essDemand += units;
          rd.essFilled += res.filled;
          rd.essStockout += res.stockout;
        }
        if (res.stockout > 0) {
          weightedStockoutPenalty += res.stockout * penaltyFor(drug) * (PRIORITY_WEIGHT[pr] ?? 1);
          if (full) stockoutByDrug.push({ drugId, units: res.stockout, priority: pr });
        }
        updateForecast(forecasts[ph.id][drugId], units);
      }

      const backlogUnits = Object.values(phState.backlog).reduce((a, b) => a + b, 0);
      accrueBacklogWait(phState);
      dayAccessDelayUnitDays += backlogUnits;
      dayDemand += demand;
      dayStockout += stockout;
      rd.demand += demand;
      rd.filled += filled;
      rd.stockout += stockout;
      rd.backlog += backlogUnits;
      rd.delayUnitDays += backlogUnits;

      if (full) {
        pharmacyResults.push({
          pharmacyId: ph.id,
          regionType: ph.regionType,
          demand,
          filled,
          stockout,
          backlogUnits,
          onOrderUnits: Object.values(phState.onOrder).reduce((a, b) => a + b, 0),
          accessDelayUnitDays: backlogUnits,
          stockoutByDrug,
        });
      }
    });

    for (const d of instance.drugs) {
      const servedNow = pharmacyStates.reduce((s, p) => s + (p.backlogServed[d.id] || 0), 0);
      ledger.dispensed[d.id] += servedNow - servedBefore[d.id];
    }

    let dayInventory = 0;
    for (const drug of instance.drugs) {
      const h = drug.holdingCostPerUnitDay ?? 0.02;
      for (const phState of pharmacyStates) {
        const u = phState.onHand[drug.id] || 0;
        costs.pharmacyHolding += u * h;
        dayInventory += u;
      }
      for (const wh of warehouseStates) {
        const u = wh.onHand[drug.id] || 0;
        costs.warehouseHolding += u * h;
        dayInventory += u;
      }
    }

    regionHistory.push(regionDaily);
    const regionalStats = summarizeWindow(regionHistory, EQUITY_WINDOW_DAYS);

    const { orders: requestedOrders, decisions: policyDecisions, diagnostics } = decideReplenishment({
      policyId: canonicalPolicyId,
      policyParams,
      day,
      instance,
      pharmacyStates,
      warehouseStates,
      forecasts,
      eventFactors: plan.eventFactors,
      regionalStats,
    });

    const { accepted: afterSupply, deferred: supplyDeferred, supplyLog } = applyWarehouseSupplyCaps(
      requestedOrders,
      instance.warehouses,
      instance.pharmacies,
      plan.eventFactors,
      warehouseStates,
    );
    const { accepted: truckAccepted, deferred: truckDeferred, allocationLog } = allocateTruckCapacityByWarehouse(
      afterSupply,
      instance.warehouses,
    );

    const orderLog = full ? new Map(requestedOrders.map((o) => [`${o.pharmacyId}|${o.drugId}`, {
      pharmacyId: o.pharmacyId,
      drugId: o.drugId,
      regionType: o.regionType,
      requestRank: o.policyRank,
      requestQty: o.qty,
      postSupplyRank: null,
      afterSupplyQty: 0,
      postTruckRank: null,
      afterTruckQty: 0,
      shippedQty: 0,
      unshippedReasons: [],
    }])) : null;
    if (full) {
      for (const o of afterSupply) Object.assign(orderLog.get(`${o.pharmacyId}|${o.drugId}`), { postSupplyRank: o.postSupplyRank, afterSupplyQty: o.qty });
      for (const o of supplyDeferred) orderLog.get(`${o.pharmacyId}|${o.drugId}`).unshippedReasons.push({ reason: o.reason, qty: o.qty });
      for (const o of truckDeferred) orderLog.get(`${o.pharmacyId}|${o.drugId}`).unshippedReasons.push({ reason: 'truck_capacity', qty: o.qty });
    }

    const shipments = [];
    let shippedUnits = 0;
    let transitUnitDays = 0;
    for (const o of truckAccepted) {
      const whState = warehouseStates.find((w) => w.id === o.warehouseId);
      const shipped = warehouseIssue(whState, o.drugId, o.qty);
      const entry = full ? orderLog.get(`${o.pharmacyId}|${o.drugId}`) : null;
      if (entry) Object.assign(entry, { postTruckRank: o.postTruckRank, afterTruckQty: o.qty, shippedQty: shipped });
      if (entry && shipped < o.qty) entry.unshippedReasons.push({ reason: 'warehouse_stock', qty: o.qty - shipped });
      if (shipped <= 0) continue;
      const ph = phMap[o.pharmacyId];
      const drug = drugMeta[o.drugId];
      const phState = pharmacyStates[ph.index];
      const transit = computeTransitDays(ph, scenario.regions[ph.regionType], drug, plan, scenario);
      const transport = transportCostPerUnit(ph, scenario);
      costs.orderFixed += orderCost;
      costs.transport += shipped * transport;
      costs.procurement += shipped * (drug.unitProcurementCost ?? 0);
      scheduleShipment({ pharmacy: ph, drugId: o.drugId, qty: shipped, currentDay: day, transitDays: transit, inTransit });
      markShipped(phState, o.drugId, shipped);
      shippedUnits += shipped;
      transitUnitDays += shipped * transit;
      if (full) shipments.push({ ...o, qty: shipped, transitDays: transit, transportCostPerUnit: transport });
    }

    if (doCheck) {
      checkConservation({ day, drugs: instance.drugs, pharmacyStates, warehouseStates, inTransit, ledger });
    }

    const essDemand = priorityTotals.essential.demand;
    const entry = {
      day,
      eventFactors: plan.eventFactors,
      regionDaily,
      priorityTotals,
      totalInventory: dayInventory,
      totalBacklog: pharmacyStates.reduce((s, p) => s + Object.values(p.backlog).reduce((a, b) => a + b, 0), 0),
      dailyStockoutRate: dayDemand > 0 ? dayStockout / dayDemand : 0,
      dailyFillRate: dayDemand > 0 ? (dayDemand - dayStockout) / dayDemand : 1,
      dailyEssentialFillRate: essDemand > 0 ? priorityTotals.essential.filled / essDemand : 1,
      dailyAccessDelayUnitDays: dayAccessDelayUnitDays,
      weightedStockoutPenalty,
      shippedUnits,
      transitUnitDays,
      orderedLines: requestedOrders.length,
    };
    if (full) {
      Object.assign(entry, {
        pharmacyResults,
        policyDecisions: policyDecisions.map((d) => ({ ...d, score: d.policyScore })),
        policyDiagnostics: diagnostics,
        orderLog: [...orderLog.values()].map((o) => ({
          ...o,
          unshippedQty: o.requestQty - o.shippedQty,
          unshippedReason: o.unshippedReasons.map((r) => r.reason).join('+') || null,
        })),
        supplyLog,
        allocationLog,
        shipments,
      });
    } else if (diagnostics) {
      entry.policyDiagnostics = {
        stage1Value: diagnostics.stage1Value,
        floorSatisfied: diagnostics.floorSatisfied,
        gapSatisfied: diagnostics.gapSatisfied,
        gapConstraintRelaxed: diagnostics.gapConstraintRelaxed,
      };
    }
    daily.push(entry);

    if (onProgress) onProgress({ day, totalDays: scenario.simulationDays, pct: ((day + 1) / scenario.simulationDays) * 100 });
  }

  for (const phState of pharmacyStates) finalizeHorizonBacklog(phState);

  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  const runLog = {
    engineVersion: ENGINE_VERSION,
    policyId: canonicalPolicyId,
    policyVersion: policy.version,
    scenarioId: scenario.id,
    randomSeed: scenario.randomSeed,
    totalCost,
    costs,
    daily,
    pharmacyStatesSummary: pharmacyStates.map((p) => ({
      id: p.id,
      regionType: p.regionType,
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

function runReplicates({ scenario, policyId, replicates, onProgress, shouldCancel, logLevel, seeds }) {
  const results = [];
  const n = seeds?.length ?? replicates;
  for (let i = 0; i < n; i += 1) {
    const seed = seeds ? seeds[i] : scenario.randomSeed + i;
    const scen = { ...scenario, randomSeed: seed };
    const r = runSimulation({
      scenario: scen,
      policyId,
      shouldCancel,
      logLevel,
      onProgress: (p) => onProgress?.({ ...p, replicate: i + 1, replicates: n }),
    });
    if (r.cancelled) return { cancelled: true, results };
    results.push({ replicateIndex: i, seed, metrics: r.metrics, runLog: r.runLog });
  }
  return { cancelled: false, results };
}

module.exports = {
  ENGINE_VERSION,
  runSimulation,
  runReplicates,
  checkConservation,
  ConservationError,
};
