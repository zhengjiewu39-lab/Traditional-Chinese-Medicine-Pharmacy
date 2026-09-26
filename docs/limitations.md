# Limitations

## Scope and data

- **No real data.** No real patients, prescriptions, pharmacy transactions, ADR reports or public-health outcomes are used. Every parameter is a synthetic, illustrative value.
- **Simulation-only inference.** Results describe behaviour inside the predefined synthetic scenarios (在预定义仿真场景中). They must not be extrapolated to real cities, health systems or policy decisions, and they do not show real policy effects.
- **Not for dispensing or care.** The platform must not be used for clinical decisions, dispensing, billing or real resource allocation.
- **Policy labels.** Strategy names describe algorithmic heuristics in silico. ERRRA is a rule-based heuristic, not AI and not proven optimal.

## Model structure

- Demand is i.i.d. Gaussian noise around a population-scaled mean. The model has no autocorrelation, no patient switching between pharmacies, no substitution between SKUs, no expiry and no batch or lot tracking.
- Backorders are served FIFO and wait indefinitely; the model does not represent patients who give up (lost sales).
- Upstream supply is an exogenous daily inbound per warehouse scaled by a supply factor. There is no manufacturer or tier-2 dynamics, and warehouses do not transfer stock to each other.
- Unshipped requests are dropped and re-planned the next day instead of queued.

## Algorithm and evaluation

- **ERRRA stage 1** is exact only for a single shared capacity. With several warehouse capacities it is a heuristic (cross-model: 86–91% of instances exact, mean gap < 0.01, max gap ≈ 0.2 in projected service).
- **Unmet versus gap trade-off.** Under severe scarcity (S12 limited warehouse stock, S14 extreme), ERRRA lowers the regional gap and raises worst-region fill, but cumulative unmet essential demand increases, because scarce units go to pharmacies with backlog.
- **Vulnerability tilt** (β = 0.05) has a negligible measured effect in the ablation. It is a tie-breaker, not a driver.
- **Reorder-point calibration** optimises cost + weighted stockout penalty. In disrupted scenarios this favours stockpiling, and the optimum lies at the high-z edge of the grid (a plateau; see `docs/validation-report.md`).
- ERRRA parameters (φ, δ, β, …) were fixed a priori and not tuned. Other settings may perform better or worse; LHS explores scenario factors, not ERRRA parameters.
- **Face validation** with domain reviewers is planned but not yet conducted.

## Engineering

- The frontend still uses CRA; migrating to Vite has been evaluated only (`docs/vite-evaluation.md`). There are 16 low or moderate `npm audit` findings, all from the `react-scripts` toolchain; none is high or critical.
- **Legacy demo.** The prescription-rule benchmarks under `/legacy/research` suffer from label leakage (rules generate the labels used for evaluation). They are kept only for history (tag `legacy-cdss-v1`) and are not evidence of anything.
