# Methodology — synthetic pharmacy supply simulation

## Purpose

This platform simulates **community pharmacy networks** under **public-health-style disturbances** to compare inventory and distribution policies. It does **not** model individual patients, clinical outcomes, or real pharmacy transactions.

## Data classification

All inputs and outputs are **synthetic / simulated**. Experiment files are stored under `data/simulation-experiments/` and labeled `synthetic-simulation`.

## Simulation assumptions

- **Time step:** one day per step for a fixed horizon (`simulationDays`).
- **Topology:** warehouses supply community pharmacies; pharmacies serve synthetic population buckets by region type (`urban`, `suburban`, `rural`).
- **Demand:** generated from population, regional base demand, drug priority, volatility, and event multipliers.
- **Fulfillment (backorder model):** unmet same-day demand enters a per-SKU backlog queue; **synthetic access delay** accumulates as backlog unit-days (not clinical wait times).
- **Replenishment:** policies emit requested lines; warehouse outbound is capped by `dailyDispatchCapacity × supplyFactor` during `supplyDisruption`; truck capacity is enforced **per warehouse** with vulnerability/priority sorting.
- **Costs (synthetic CNY):** SKU `holdingCostPerUnitDay`, `unitProcurementCost`, distance/road-adjusted transport, and fixed `orderCost` per shipment line.
- **Events:** active when `startDay <= day < startDay + durationDays` (`getEventEndDay = startDay + durationDays`).

## Disturbance events

| Type | Effect on simulation |
|------|----------------------|
| `demandSurge` | Multiplies regional demand |
| `supplyDisruption` | Multiplies each warehouse **daily dispatch cap** (not double-deducting on-hand); logs requested vs shipped vs unmet replenishment |
| `roadDisruption` | Multiplies transit time |
| `leadTimeExtension` | Multiplies lead/transit factor |

Default scenario `public-health-emergency-default` combines surge, supply cut, rural road delay, and extended lead times.

## Policies (explicit names)

1. **fixed-allocation** — population-proportional target stock (review-day heuristic).
2. **reorder-point** — (s, Q) reorder point with fixed batch.
3. **cost-first** — greedy ranking by `(expected stockout penalty reduction − marginal logistics cost)` per candidate line.
4. **equity-aware heuristic** — greedy ranking by weighted marginal score (stockout, backlog/wait proxy, regional inequity signal − cost); **not** a global optimizer.

## Experiment groups (fair comparison)

`POST /api/simulation/run-group` freezes one scenario JSON and runs all selected policies with **identical replicate seeds** (common random numbers). Results compare only within the same `experimentGroupId` / `scenarioHash`.

## Service inequality index (0–1)

```
index = (w_s·min(stockoutGap,1) + w_w·min(waitGap/maxWait,1) + w_g·giniCoverage) / (w_s+w_w+w_g)
```

Higher Gini on regional fill rates increases the index (Gini=0 means equal coverage).

Default parameters in `scenarioSchema.js` are **simulation assumptions** (`illustrative` / `literature-informed` in `parameterMeta`), not empirical pharmacy records.

## Multi-objective score (research penalty units)

```
compositeScore =
  totalCost
  + weightedStockoutPenalty(priority-specific)
  + waitingTimePenaltyPerDay × weighted wait
  + inequityPenaltyPerGap × (stockoutGap + waitGap)
```

**Not** a clinical benefit score. Do not interpret as health impact.

## Metrics (units)

| Metric | Unit | Definition |
|--------|------|------------|
| `stockoutRate` | proportion | Unmet demand / total demand |
| `fillRate` | proportion | Filled / demand |
| `avgAccessTimeDays` | days | Demand-weighted wait proxy |
| `avgDeliveryTimeDays` | days | Shipment transit weighted by quantity |
| `inventoryTurnover` | ratio | Filled demand / mean inventory |
| `stockoutGap` | proportion | Max − min regional stockout rate |
| `waitGap` | days | Max − min regional access time |
| `giniCoverage` | 0–1 | Gini coefficient on regional fill rates |
| `essentialStockoutRate` | proportion | Stockouts for `essential` priority SKUs |
| `chronicStockoutRate` | proportion | Stockouts for `chronic-care` SKUs |
| `serviceInequalityIndex` | composite | Mean of stockout gap, wait gap, and (1 − Gini fill) |
| `resilience.daysToRecover` | days | Days after last event until daily stockout ≤ 110% pre-event baseline |

## Reproducibility

- Randomness uses `seededRandom.js` (`createRng`, Mulberry32); simulation code must not call `Math.random()`.
- Replicates use `randomSeed + replicateIndex`.
- Record: `scenarioId`, `policyId`, `policyVersion`, `engineVersion`, `nodeVersion`, timestamps, and full scenario JSON.

## Non-applicability

- Not for clinical decision support, dispensing, or real logistics contracts.
- Not validated against real epidemic data or pharmacy ERP systems.
- Legacy demo modules (prescription CDSS, CRM, etc.) are **out of scope** for this methodology.
