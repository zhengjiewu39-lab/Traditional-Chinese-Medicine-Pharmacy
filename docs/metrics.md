# Metrics (engine `simulation-engine-v3.0.0`)

All metrics are computed from **synthetic** simulation logs by `server/simulation/metricsEngine.js`. They are not clinical endpoints. Notation: days \(t = 0,\dots,T-1\) (\(T = 120\) in the paper matrix), regions \(r \in \{\text{urban},\text{suburban},\text{rural}\}\), SKUs \(k\), essential SKUs \(E\). \(D_{rt}\) = units demanded, \(F_{rt}\) = units filled **from stock at the time of demand**; unfilled units are backordered and may be served later from arriving stock (FIFO).

## Service and equity

| Metric | Formula | Unit | Better | Range |
|---|---|---|---|---|
| `fillRate` | \(\sum_{r,t} F_{rt} / \sum_{r,t} D_{rt}\) | fraction | higher | [0, 1] |
| `essentialFillRate` | same, essential SKUs only | fraction | higher | [0, 1] |
| Regional essential fill \(EF_r\) | \(\sum_t F^{E}_{rt} / \sum_t D^{E}_{rt}\) | fraction | higher | [0, 1] |
| `worstRegionEssentialFillRate` | \(\min_r EF_r\) | fraction | higher | [0, 1] |
| `worstRegionEssentialFillRatePostOnset` | \(\min_r EF_r\) restricted to \(t \ge\) first event day | fraction | higher | [0, 1] |
| `minRegionalServiceLevel` | \(\min_r \sum_t F_{rt} / \sum_t D_{rt}\) (all SKUs) | fraction | higher | [0, 1] |
| `essentialServiceGap` | \(\max_r EF_r - \min_r EF_r\) | fraction (×100 = percentage points) | lower | [0, 1] |
| `cumulativeUnmetEssentialDemand` | \(\sum_{r,t} (D^{E}_{rt} - F^{E}_{rt})\) — essential units **not filled at the time of demand** (includes units later served from backlog) | units | lower | [0, ∞) |
| `maxBacklog` | \(\max_t \sum_{\text{pharmacy},k} B_{t}\) (end-of-day backlog) | units | lower | [0, ∞) |
| `backlogAtHorizon` | backlog at the end of day \(T-1\) | units | lower | [0, ∞) |
| `avgSyntheticAccessDelayDays` | \(\sum_t \text{backlog unit-days} / \sum_t D_t\) | synthetic days per demanded unit | lower | [0, ∞) |
| `serviceInequalityIndex` | weighted mean of \(\min(1,\text{stockoutGap})\), \(\min(1,\text{waitGap}/30)\), Gini of regional fill | index | lower | [0, 1] |

## Resilience (essential fill trajectory)

Let \(e_t\) = daily essential fill rate (all regions), \(t_0\) = first event day, \(t_1\) = last event end day (exclusive), \(\tilde e_t\) = trailing 7-day mean of \(e_t\).

| Metric | Formula | Unit | Better | Range |
|---|---|---|---|---|
| Baseline \(B\) | mean of \(e_t\) for \(t \in [7, t_0)\) (warm-up, first week skipped) | fraction | — | [0, 1] |
| `serviceLossAUC` | \(\sum_{t \ge t_0} \max(0, B - e_t)\) | fill-rate·days | lower | [0, \(T - t_0\)] |
| Trough | \(\min_{t\ge t_0} \tilde e_t\), day \(t^\*\) | fraction | higher | [0, 1] |
| `timeToRecovery{90,95,99}` | 0 if \(\tilde e_{t^\*} \ge pB\); else \(\max(0, t_p - t_1)\) with \(t_p\) the first day \(\ge t^\*\) with \(\tilde e_t \ge pB\); **right-censored** if never reached | days after disruption end | lower | [0, \(T - t_1\)] |
| `recoverySlope` | \((\tilde e_{t_{95}} - \tilde e_{t^\*}) / (t_{95} - t^\*)\) | fill-rate per day | higher | ≥ 0 |

Paper tables replace censored recovery times by the maximum observable delay \(T - t_1\) (= 60 days) and report the share of runs that recovered (`Rec95`). Recovery metrics are n/a when a scenario has no event (S01).

## Cost

| Metric | Formula | Unit | Better |
|---|---|---|---|
| `totalCost` | procurement \(c\cdot q\) + transport \(c^{tr}_r\cdot q\) + fixed order \(K\) per shipped line + pharmacy and warehouse holding \(h\) per unit·day | synthetic currency | lower |

Stockout penalties are **not** part of `totalCost`; they appear separately as `penalties.weightedStockoutPenalty` (used only as the reorder-point calibration objective and in the legacy composite score).

## Policy comparison (paper pipeline)

| Quantity | Definition |
|---|---|
| Paired difference | \(\Delta = \frac{1}{n}\sum_s (X^{A}_s - X^{B}_s)\) over common seeds \(s\); 95% CI \(\bar\Delta \pm t_{0.975,n-1}\, \mathrm{sd}(\Delta)/\sqrt n\) |
| Cost per percentage point of gap reduction | \((C_{\text{policy}} - C_{\text{cost-first}}) / (100\cdot(G_{\text{cost-first}} - G_{\text{policy}}))\), \(G\) = `essentialServiceGap`; reported only when the gap falls and cost rises |
| Price of Equity (relative) | \(\dfrac{(C_{\text{policy}} - C_{\text{cost-first}})/C_{\text{cost-first}}}{(G_{\text{cost-first}} - G_{\text{policy}})/G_{\text{cost-first}}}\) (dimensionless; relative cost increase per relative gap reduction) |
| "dominant" | lower cost **and** lower gap than cost-first |
| Pareto efficiency | policy not dominated on (mean cost ↓, mean worst-region essential fill ↑, mean unmet essential ↓) within a scenario |

The literal formula requested, \((\text{equityPolicyCost} - \text{costFirstCost})/\text{equityGapReduction}\), equals *cost per percentage point* when the gap reduction is expressed in percentage points.
