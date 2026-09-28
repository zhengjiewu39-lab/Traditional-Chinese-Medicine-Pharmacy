# Metrics (engine `simulation-engine-v4.0.0`)

All metrics are computed from **synthetic** simulation logs by `server/simulation/metricsEngine.js`. They are not clinical endpoints.

Notation:

- Days \(t = 0,\dots,T-1\) (\(T = 120\)); regions \(r\); essential SKUs \(E\).
- \(D\): units demanded. \(F\): units filled **from stock on the day of demand**. Unfilled units join a FIFO backlog and may be handed out later.

## Three unmet-demand concepts

These three quantities are different and must not be used interchangeably:

| Concept | Key | Definition |
|---|---|---|
| Same-day unfilled | `sameDayUnfilledUnits` (= `cumulativeUnmetDemand`), `sameDayUnfilledRate` (legacy alias `stockoutRate`) | \(\sum (D - F)\): units not available when demanded |
| Late-filled | `lateFilledUnits`, `lateFilledRate` | backordered units handed out later, before the horizon |
| Horizon-end unmet | `horizonEndUnmetUnits`, `horizonEndUnmetRate` | units still backordered at the end of day \(T-1\) |

Identity (tested): same-day unfilled = late-filled + horizon-end unmet. Rates divide by total demand.

## Primary metrics (`PRIMARY_METRICS`, reported in every table)

| Key | Formula | Unit | Better | Range |
|---|---|---|---|---|
| `overallFillRate` | \(\sum F / \sum D\), all SKUs | fraction | higher | [0, 1] |
| `essentialMedicineFillRate` | same, essential SKUs | fraction | higher | [0, 1] |
| `worstRegionEssentialFillRate` | \(\min_r EF_r\), \(EF_r = \sum_t F^E_{rt} / \sum_t D^E_{rt}\) | fraction | higher | [0, 1] |
| `regionalServiceGap` | \(\max_r EF_r - \min_r EF_r\) | fraction (×100 = pp) | lower | [0, 1] |
| `cumulativeUnmetDemand` | same-day unfilled units, all SKUs | units | lower | [0, ∞) |
| `backlogArea` | \(\sum_t\) end-of-day backlog (unit·days) | unit·days | lower | [0, ∞) |
| `stockoutIncidentRate` | share of demand lines (pharmacy × SKU × day with \(D > 0\)) with any unit unfilled that day | fraction | lower | [0, 1] |
| `horizonEndUnmetRate` | horizon-end unmet / total demand | fraction | lower | [0, 1] |
| `meanWaitingTime` | mean wait per demanded unit; 0 for units filled on demand | days | lower | [0, T] |
| `p95WaitingTime` | 95th percentile of the same distribution | days | lower | [0, T] |
| `recoveryTime90`, `recoveryTime95`, `recoveryTime99` | see Resilience | days after shock end | lower | [0, \(T - t_1\)] |
| `serviceLossAUC` | \(\sum_{t \ge t_0}\max(0, B - e_t)\) | fill-rate·days | lower | [0, \(T - t_0\)] |
| `totalCost` | see Cost | synthetic currency | lower | [0, ∞) |

**Waiting-time censoring.** Units still backordered at the horizon enter the wait distribution with their censored wait \(T - t_{\text{demand}}\). The mean and p95 are therefore **lower bounds** whenever `waitingTimeCensoredUnits` > 0. Essential-only versions are `meanWaitingTimeEssential`, `p95WaitingTimeEssential` and `essentialStockoutIncidentRate`.

## Resilience (essential fill trajectory)

Definitions:

- \(e_t\): daily essential fill rate over all regions.
- \(t_0\): first event day; \(t_1\): last event end (exclusive).
- \(\tilde e_t\): trailing 7-day mean of \(e_t\).
- Baseline \(B\): mean of \(e_t\) over \(t \in [7, t_0)\).

| Quantity | Definition |
|---|---|
| Trough | \(\min_{t\ge t_0}\tilde e_t\) at day \(t^\*\) |
| `timeToRecovery{p}` | 0 if the trough is \(\ge pB\); otherwise \(\max(0, t_p - t_1)\), where \(t_p\) is the first day \(\ge t^\*\) with \(\tilde e_t \ge pB\). **Right-censored** (`null`) if never reached |

The paper tables replace censored values by the maximum observable delay \(T - t_1\) (60 days) and report the share of runs that recovered. Recovery metrics are n/a in M1, which has no event.

## Cost

\[
\text{totalCost} = \text{procurement} + \text{transport} + \text{orderFixed} + \text{pharmacyHolding} + \text{warehouseHolding} + \text{upstreamSupply} + \text{lateralTransfer}
\]

The weighted stockout penalty \(\sum p_k \times\) same-day unfilled units is reported separately (`penalties.weightedStockoutPenalty`). It is **not** part of totalCost; it is used only in the tuned-sQ calibration objective.

## Network counters

`lateralTransferUnits`, `lateralTransferCount`, `backupSupplierUnits`; per-supplier shipped units and days in each state (`runLog.suppliers`).

## Comparisons

| Quantity | Definition |
|---|---|
| Paired difference | \(\bar\Delta = \frac1n\sum_s (X^A_s - X^B_s)\) over common seeds; 95% CI = paired percentile bootstrap (2000 resamples, seed 20240901) |
| Price of Equity | \(\text{PoE}_A = (C_A - C_{\text{cost-only}})/C_{\text{cost-only}}\); the pipeline averages it per seed with a bootstrap CI. It can be negative |
| Cost per pp | \(\Delta C / (100\cdot\Delta\text{worstRegionEssentialFillRate})\) vs cost-only, only when both are positive |
| Pareto efficiency | not dominated on (mean cost ↓, mean worst-region essential fill ↑, mean cumulative unmet ↓) within a scenario |

## Secondary and legacy keys

`minRegionalServiceLevel`, `essentialServiceGap` (= `regionalServiceGap`), `cumulativeUnmetEssentialDemand`, `maxBacklog`, `backlogAtHorizon`, `avgSyntheticAccessDelayDays` (= backlogArea / demand) and `serviceInequalityIndex` are still computed for continuity with v3 archives. They are not primary metrics.
