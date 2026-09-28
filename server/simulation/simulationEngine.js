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
const { applyWarehouseSupplyCaps } = require('./dispatchEngine');
const { decideReplenishment, getPolicy, resolvePolicyId, resolveParams } = require('./policyEngine');
const { initForecasts, updateForecast } = require('./forecastEngine');
const { summarizeWindow } = require('./equitySignals');
const { computeRunMetrics } = require('./metricsEngine');
const { initSupplyState, receiveUpstream, placeUpstreamOrders } = require('./supplyNetwork');
const { lateralConfig, planLateralTransfers } = require('./lateralTransfers');
const { ENGINE_VERSION, PRIORITY_WEIGHT } = require('./simulationConstants');
const { REGION_TYPES } = require('./scenarioSchema');

const EQUITY_WINDOW_DAYS = 7;
const AUDIT_TOLERANCE = 1e-6;

function emptyRegionDaily() {
  return Object.fromEntries(REGION_TYPES.map((rt) => [rt, {
    demand: 0, filled: 0, stockout: 0, essDemand: 0, essFilled: 0, essStockout: 0, backlog: 0, delayUnitDays: 0,
  }]));
}

class ConservationError extends Error {}

const sumBy = (list, f) => list.reduce((s, x) => s + f(x), 0);

/**
 * Stock-flow identities checked per SKU at the end of every simulated day:
 *   (1) Σ warehouse onHand + Σ pharmacy onHand + Σ in-transit = initial + cumulative upstream received − cumulative dispensed
 *   (2) Σ pharmacy onOrder = Σ in-transit (warehouse shipments and lateral transfers)
 *   (3) cumulative backordered = Σ backlog + cumulative served from backlog
 */
function checkConservation({ day, drugs, pharmacyStates, warehouseStates, inTransit, ledger }) {
  for (const drug of drugs) {
    const id = drug.id;
    const whStock = sumBy(warehouseStates, (w) => w.onHand[id] || 0);
    const phStock = sumBy(pharmacyStates, (p) => p.onHand[id] || 0);
    const transit = sumBy(inTransit.filter((x) => x.drugId === id), (x) => x.qty);
    const onOrder = sumBy(pharmacyStates, (p) => p.onOrder[id] || 0);
    const backlog = sumBy(pharmacyStates, (p) => p.backlog[id] || 0);
    const served = sumBy(pharmacyStates, (p) => p.backlogServed[id] || 0);
    const expected = ledger.initial[id] + ledger.inbound[id] - ledger.dispensed[id];
    const neg = pharmacyStates.some((p) => (p.onHand[id] || 0) < 0 || (p.backlog[id] || 0) < 0 || (p.onOrder[id] || 0) < 0)
      || warehouseStates.some((w) => (w.onHand[id] || 0) < 0);
    if (neg) throw new ConservationError(`day ${day} ${id}: negative stock/backlog/onOrder`);
    if (Math.abs(whStock + phStock + transit - expected) > AUDIT_TOLERANCE) {
      throw new ConservationError(`day ${day} ${id}: stock ${whStock + phStock + transit} ≠ expected ${expected}`);
    }
    if (Math.abs(onOrder - transit) > AUDIT_TOLERANCE) {
      throw new ConservationError(`day ${day} ${id}: onOrder ${onOrder} ≠ inTransit ${transit}`);
    }
    if (Math.abs(ledger.backordered[id] - (backlog + served)) > AUDIT_TOLERANCE) {
      throw new ConservationError(`day ${day} ${id}: backordered ${ledger.backordered[id]} ≠ backlog ${backlog} + served ${served}`);
    }
  }
}

/**
 * End-of-run inventory balance audit per SKU at three levels. Any mismatch throws (the run fails).
 *   pharmacies: initial + receivedFromWarehouses + inboundTransfers − fulfilledDemand − outboundTransfers − expiredOrLost = ending on hand
 *   warehouses: initial + receivedSupply − issuedToPharmacies − expiredOrLost = ending on hand
 *   network   : initial + receivedSupply − fulfilledDemand − expiredOrLost = ending (on hand + in transit)
 */
function inventoryAudit({ drugs, pharmacyStates, warehouseStates, inTransit, ledger }) {
  const rows = [];
  let passed = true;
  for (const drug of drugs) {
    const id = drug.id;
    const phEnding = sumBy(pharmacyStates, (p) => p.onHand[id] || 0);
    const whEnding = sumBy(warehouseStates, (w) => w.onHand[id] || 0);
    const inTransitWh = sumBy(inTransit.filter((x) => x.drugId === id && x.kind !== 'transfer'), (x) => x.qty);
    const inTransitTr = sumBy(inTransit.filter((x) => x.drugId === id && x.kind === 'transfer'), (x) => x.qty);
    const ph = {
      initialStock: ledger.initialPharmacy[id],
      receivedSupply: ledger.arrivedFromWarehouse[id],
      inboundTransfers: ledger.transfersIn[id],
      fulfilledDemand: ledger.dispensed[id],
      outboundTransfers: ledger.transfersOut[id],
      expiredOrLost: 0,
      endingStock: phEnding,
    };
    const wh = {
      initialStock: ledger.initialWarehouse[id],
      receivedSupply: ledger.inbound[id],
      issuedToPharmacies: ledger.issued[id],
      expiredOrLost: 0,
      endingStock: whEnding,
    };
    const net = {
      initialStock: ledger.initial[id],
      receivedSupply: ledger.inbound[id],
      fulfilledDemand: ledger.dispensed[id],
      expiredOrLost: 0,
      endingStock: phEnding + whEnding + inTransitWh + inTransitTr,
      inTransitWarehouseShipments: inTransitWh,
      inTransitTransfers: inTransitTr,
    };
    ph.residual = ph.initialStock + ph.receivedSupply + ph.inboundTransfers - ph.fulfilledDemand - ph.outboundTransfers - ph.expiredOrLost - ph.endingStock;
    wh.residual = wh.initialStock + wh.receivedSupply - wh.issuedToPharmacies - wh.expiredOrLost - wh.endingStock;
    net.residual = net.initialStock + net.receivedSupply - net.fulfilledDemand - net.expiredOrLost - net.endingStock;
    const pipelineResidual = ledger.issued[id] - ledger.arrivedFromWarehouse[id] - inTransitWh;
    const transferResidual = ledger.transfersOut[id] - ledger.transfersIn[id] - inTransitTr;
    const ok = [ph.residual, wh.residual, net.residual, pipelineResidual, transferResidual]
      .every((r) => Math.abs(r) <= AUDIT_TOLERANCE);
    if (!ok) passed = false;
    rows.push({ drugId: id, pharmacies: ph, warehouses: wh, network: net, pipelineResidual, transferResidual, passed: ok });
  }
  return { passed, rows };
}

function addGroup(groups, key, field, value) {
  const g = groups[key] || (groups[key] = {
    procurement: 0, transport: 0, orderFixed: 0, pharmacyHolding: 0, stockoutPenalty: 0,
  });
  g[field] += value;
}

/**
 * @param {Object} opts
 * @param {'full'|'summary'} [opts.logLevel='full'] — 'summary' omits per-pharmacy and per-order logs (for large batches).
 * @param {boolean} [opts.checkConservation=false] — daily identities; the end-of-run audit always runs.
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
  const params = resolveParams(canonicalPolicyId, scenario, policyParams);

  const instance = generateScenarioInstance(scenario);
  const pharmacyStates = instance.pharmacies.map(initPharmacyState);
  const warehouseStates = instance.warehouses.map(initWarehouseState);
  const forecasts = initForecasts(instance);
  const phMap = Object.fromEntries(instance.pharmacies.map((p) => [p.id, p]));
  const drugMeta = Object.fromEntries(instance.drugs.map((d) => [d.id, d]));
  const orderCost = scenario.logistics?.orderCost ?? 25;
  const penaltyFor = (drug) => drug.stockoutPenalty ?? scenario.metricsWeights?.stockoutPenaltyByPriority?.[drug.priority] ?? 15;

  const lateral = lateralConfig(scenario);
  const network = {
    lateralTransfers: lateral.enabled !== false && params.useLateralTransfers !== false,
    supplierRedundancy: (scenario.supplyNetwork?.redundancyEnabled ?? true) && params.useSupplierRedundancy !== false,
  };
  const supplyState = initSupplyState(instance.suppliers);

  const ledger = {
    initial: {}, initialPharmacy: {}, initialWarehouse: {}, inbound: {}, dispensed: {}, backordered: {},
    issued: {}, arrivedFromWarehouse: {}, transfersIn: {}, transfersOut: {},
  };
  for (const d of instance.drugs) {
    ledger.initialWarehouse[d.id] = sumBy(warehouseStates, (w) => w.onHand[d.id] || 0);
    ledger.initialPharmacy[d.id] = sumBy(pharmacyStates, (p) => p.onHand[d.id] || 0);
    ledger.initial[d.id] = ledger.initialWarehouse[d.id] + ledger.initialPharmacy[d.id];
    for (const k of ['inbound', 'dispensed', 'backordered', 'issued', 'arrivedFromWarehouse', 'transfersIn', 'transfersOut']) ledger[k][d.id] = 0;
  }
  const costs = {
    procurement: 0, transport: 0, orderFixed: 0, pharmacyHolding: 0, warehouseHolding: 0, upstreamSupply: 0, lateralTransfer: 0,
  };
  const groupCosts = {};
  const counters = {
    demandLines: 0, stockoutIncidents: 0, essDemandLines: 0, essStockoutIncidents: 0,
    transfers: 0, transferUnits: 0, upstreamUnitsByTier: { primary: 0, backup: 0 },
  };
  const regionHistory = [];
  let inTransit = [];
  const daily = [];

  for (let day = 0; day < scenario.simulationDays; day += 1) {
    if (shouldCancel?.()) {
      return { cancelled: true, day, engineVersion: ENGINE_VERSION };
    }
    const plan = instance.dailyPlans[day];

    let upstreamReceived = 0;
    for (const s of receiveUpstream(supplyState, day)) {
      warehouseReceive(warehouseStates.find((w) => w.id === s.warehouseId), s.drugId, s.qty);
      ledger.inbound[s.drugId] += s.qty;
      upstreamReceived += s.qty;
    }

    const servedBefore = Object.fromEntries(instance.drugs.map((d) => [
      d.id, sumBy(pharmacyStates, (p) => p.backlogServed[d.id] || 0),
    ]));
    const arrived = [];
    inTransit = processArrivals(day, inTransit, pharmacyStates, arrived);
    for (const a of arrived) {
      if (a.kind === 'transfer') ledger.transfersIn[a.drugId] += a.qty;
      else ledger.arrivedFromWarehouse[a.drugId] += a.qty;
    }

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
        const res = fulfillDemandWithBackorder(ph, drugId, units, phState, drug, day);
        ledger.dispensed[drugId] += res.filled;
        ledger.backordered[drugId] += res.backordered;
        demand += units;
        filled += res.filled;
        stockout += res.stockout;
        const pr = drug.priority || 'routine';
        priorityTotals[pr].demand += units;
        priorityTotals[pr].filled += res.filled;
        priorityTotals[pr].stockout += res.stockout;
        if (units > 0) {
          counters.demandLines += 1;
          if (res.stockout > 0) counters.stockoutIncidents += 1;
          if (pr === 'essential') {
            counters.essDemandLines += 1;
            if (res.stockout > 0) counters.essStockoutIncidents += 1;
          }
        }
        if (pr === 'essential') {
          rd.essDemand += units;
          rd.essFilled += res.filled;
          rd.essStockout += res.stockout;
        }
        if (res.stockout > 0) {
          const pen = res.stockout * penaltyFor(drug) * (PRIORITY_WEIGHT[pr] ?? 1);
          weightedStockoutPenalty += pen;
          addGroup(groupCosts, `${drugId}|${ph.regionType}`, 'stockoutPenalty', pen);
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
      const servedNow = sumBy(pharmacyStates, (p) => p.backlogServed[d.id] || 0);
      ledger.dispensed[d.id] += servedNow - servedBefore[d.id];
    }

    let dayInventory = 0;
    for (const drug of instance.drugs) {
      const h = drug.holdingCostPerUnitDay ?? 0.02;
      for (const phState of pharmacyStates) {
        const u = phState.onHand[drug.id] || 0;
        costs.pharmacyHolding += u * h;
        if (u > 0) addGroup(groupCosts, `${drug.id}|${phState.regionType}`, 'pharmacyHolding', u * h);
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

    let transfers = [];
    let transferLog = { enabled: false };
    if (network.lateralTransfers) {
      const lt = planLateralTransfers({
        day, instance, pharmacyStates, forecasts, plan, inTransit, cfg: lateral,
      });
      transfers = lt.transfers;
      transferLog = lt.log;
      costs.lateralTransfer += lt.cost;
      for (const t of transfers) {
        ledger.transfersOut[t.drugId] += t.qty;
        counters.transfers += 1;
        counters.transferUnits += t.qty;
      }
    }

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
      priorityScore: o.priorityScore,
      priorityReason: o.priorityReason,
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
      ledger.issued[o.drugId] += shipped;
      const ph = phMap[o.pharmacyId];
      const drug = drugMeta[o.drugId];
      const phState = pharmacyStates[ph.index];
      const transit = computeTransitDays(ph, scenario.regions[ph.regionType], drug, plan, scenario);
      const transport = transportCostPerUnit(ph, scenario);
      const g = `${o.drugId}|${ph.regionType}`;
      costs.orderFixed += orderCost;
      costs.transport += shipped * transport;
      costs.procurement += shipped * (drug.unitProcurementCost ?? 0);
      addGroup(groupCosts, g, 'orderFixed', orderCost);
      addGroup(groupCosts, g, 'transport', shipped * transport);
      addGroup(groupCosts, g, 'procurement', shipped * (drug.unitProcurementCost ?? 0));
      scheduleShipment({ pharmacy: ph, drugId: o.drugId, qty: shipped, currentDay: day, transitDays: transit, inTransit });
      markShipped(phState, o.drugId, shipped);
      shippedUnits += shipped;
      transitUnitDays += shipped * transit;
      if (full) {
        shipments.push({
          ...o, qty: shipped, transitDays: transit, transportCostPerUnit: transport, selectionReason: o.priorityReason,
        });
      }
    }

    const upstream = placeUpstreamOrders({
      day,
      warehouses: instance.warehouses,
      warehouseStates,
      suppliers: instance.suppliers,
      supplyState,
      dayStatus: plan.supplierStatus,
      drugs: instance.drugs,
      redundancyEnabled: network.supplierRedundancy,
    });
    for (const s of upstream.shipments) {
      costs.upstreamSupply += s.qty * (s.unitCost ?? 0);
      counters.upstreamUnitsByTier[s.tier] = (counters.upstreamUnitsByTier[s.tier] || 0) + s.qty;
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
      warehouseInventory: sumBy(warehouseStates, (w) => Object.values(w.onHand).reduce((a, b) => a + b, 0)),
      totalBacklog: sumBy(pharmacyStates, (p) => Object.values(p.backlog).reduce((a, b) => a + b, 0)),
      dailyStockoutRate: dayDemand > 0 ? dayStockout / dayDemand : 0,
      dailySameDayUnfilledRate: dayDemand > 0 ? dayStockout / dayDemand : 0,
      dailyFillRate: dayDemand > 0 ? (dayDemand - dayStockout) / dayDemand : 1,
      dailyEssentialFillRate: essDemand > 0 ? priorityTotals.essential.filled / essDemand : 1,
      dailyAccessDelayUnitDays: dayAccessDelayUnitDays,
      weightedStockoutPenalty,
      shippedUnits,
      transitUnitDays,
      orderedLines: requestedOrders.length,
      upstreamReceived,
      upstreamShipped: upstream.shipments.reduce((s, x) => s + x.qty, 0),
      transferUnits: transfers.reduce((s, t) => s + t.qty, 0),
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
        transfers,
        transferLog,
        upstreamLog: upstream.log,
        supplierStatus: plan.supplierStatus.status,
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

  for (const phState of pharmacyStates) finalizeHorizonBacklog(phState, scenario.simulationDays);

  const audit = inventoryAudit({ drugs: instance.drugs, pharmacyStates, warehouseStates, inTransit, ledger });
  if (!audit.passed) {
    const bad = audit.rows.find((r) => !r.passed);
    throw new ConservationError(`inventory audit failed for ${bad.drugId}: ${JSON.stringify(bad)}`);
  }

  const waitHistogram = { all: {}, essential: {}, censoredAll: {}, censoredEssential: {} };
  const addHist = (target, hist) => {
    for (const [w, u] of Object.entries(hist || {})) target[w] = (target[w] || 0) + u;
  };
  for (const p of pharmacyStates) {
    for (const d of instance.drugs) {
      addHist(waitHistogram.all, p.waitByDrug[d.id]);
      addHist(waitHistogram.censoredAll, p.censoredWaitByDrug?.[d.id]);
      if (d.priority === 'essential') {
        addHist(waitHistogram.essential, p.waitByDrug[d.id]);
        addHist(waitHistogram.censoredEssential, p.censoredWaitByDrug?.[d.id]);
      }
    }
  }

  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  const runLog = {
    engineVersion: ENGINE_VERSION,
    policyId: canonicalPolicyId,
    policyVersion: policy.version,
    scenarioId: scenario.id,
    randomSeed: scenario.randomSeed,
    network,
    totalCost,
    costs,
    groupCosts,
    counters,
    waitHistogram,
    inventoryAudit: audit,
    suppliers: instance.suppliers.map((s) => ({
      ...s,
      shippedUnits: supplyState.shippedBySupplier[s.id],
      daysByState: supplyState.daysByState[s.id],
    })),
    daily,
    pharmacyStatesSummary: pharmacyStates.map((p) => ({
      id: p.id,
      regionType: p.regionType,
      permanentlyUnmetUnits: p.permanentlyUnmetUnits,
      eventuallyFilledUnits: p.eventuallyFilledUnits,
      backlogUnitDays: p.backlogUnitDays,
      transferredIn: p.transferredIn,
      transferredOut: p.transferredOut,
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

function runReplicates({ scenario, policyId, replicates, onProgress, shouldCancel, logLevel, seeds, policyParams }) {
  const results = [];
  const n = seeds?.length ?? replicates;
  for (let i = 0; i < n; i += 1) {
    const seed = seeds ? seeds[i] : scenario.randomSeed + i;
    const scen = { ...scenario, randomSeed: seed };
    const r = runSimulation({
      scenario: scen,
      policyId,
      policyParams,
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
  inventoryAudit,
  ConservationError,
};
