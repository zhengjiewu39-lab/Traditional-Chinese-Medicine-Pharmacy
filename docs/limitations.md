# Limitations

## Scope and data

- **Synthetic data only.** No real patients, prescriptions, pharmacy transactions, supplier records, ADR reports or epidemic data are used. Every parameter is a synthetic scenario assumption (合成场景假设), and none is estimated from data.
- **Simulation-only inference.** Results describe behaviour inside the predefined synthetic scenarios (在预定义仿真场景中). They cannot be used to infer real policy effects or be extrapolated to real cities, health systems or supply chains.
- **Not for dispensing, care or real allocation.**
- **Naming.** The five policies are algorithmic heuristics. ERRRA is a rule-based allocation heuristic: not AI, not an optimizer, and not proven optimal.

## Model structure

- **Capacity in standard units.** `capacityInStandardUnits` limits the sum of units over SKUs. There is no volume, weight, pallet, cold-chain or shelf-life model; one unit of any SKU occupies the same space.
- **Demand:** i.i.d. Gaussian noise around a population-scaled mean with multiplicative surges. There is no autocorrelation, no seasonality, no substitution between SKUs and no patients moving between pharmacies.
- **Backorders** wait indefinitely (no lost sales, no patient abandonment). Waiting times for units still backordered at the horizon are censored, so mean and p95 waits are lower bounds when horizon-end unmet > 0. Recovery times are right-censored at 60 days.
- **Suppliers:**
  - one primary and one backup per warehouse, with a fixed lead time, a daily capacity and Bernoulli daily reliability
  - no supplier contracts, allocation among warehouses, price dynamics or tier-2 suppliers
  - the warehouse upstream rule is the same base-stock rule for every policy; policies decide only the warehouse → pharmacy flow
- **No expiry, batches or lots;** `expiredOrLost` is 0 in the audit.
- **Lateral transfers** are limited to pharmacies of the same region type and to essential SKUs, with a stylized cost and a daily capacity.
- **Unshipped requests** are not queued; they are re-planned the next day from the updated inventory position.

## Evaluation

- **tuned-sQ is a strong baseline, and in several scenarios a better one.** Calibrated per SKU × region type on cost + stockout penalty, it stockpiles. In six of nine scenarios (M2–M7) its worst-region essential fill is higher than ERRRA's, at a much higher cost in M3 and M5–M7. A baseline calibrated for equity might look different again.
- **Calibration boundary.** In M7 the optimal uniform z was still on the upper grid edge after four extensions (z ≈ 50.6, effectively "always order up to the maximum"). The M7 tuned-sQ result is therefore a lower bound on what that rule family could reach.
- **ERRRA trade-offs:**
  - its waiting-time tail is longer than cost-only's in M2, M5, M6 and M9
  - its cumulative unmet demand is higher in M2 and M7
  - weighted-equity has lower unmet demand than ERRRA in M2–M7
- **Mechanism versus rule.** Supplier redundancy has by far the largest ablation effect, but it is a network mechanism available to every policy. The vulnerability tilt (β = 0.05) has no measurable effect in four of six ablation scenarios. Lateral transfers change worst-region fill by ≤ 0.5 pp.
- **ERRRA stage 1** is exact only for a single shared capacity; with two warehouse capacities it is exact in 86–91% of instances (max gap 0.15–0.20). Stage 2 is greedy.
- **ERRRA parameters** (φ, δ, β, …) were fixed a priori and not tuned. LHS varies φ only within 0.8–1.0; its PRCC is not significant.
- **Statistics.** No multiplicity correction is applied across scenarios, pairs and metrics. With 100 seeds, practically negligible differences can have CIs excluding 0.
- **Scenario matrix revision.** The v2.0.0 base warehouse buffer (10 days) was set after observing, on non-reporting seeds, that a 20-day buffer absorbed single-mechanism shocks completely. The same buffer applies to every policy, and the rationale is recorded in the matrix revision log.
- **No face validation.** Review of the model structure by pharmacy-logistics experts is planned but has not been conducted.

## Engineering

- The frontend still uses Create React App; migration to Vite has only been evaluated (`docs/vite-evaluation.md`).
- `npm audit --omit=dev` reports 0 vulnerabilities. The full audit reports 14 low or moderate findings (0 high, 0 critical), all in the `react-scripts` build toolchain.
- **Legacy demo.** The prescription-rule benchmarks under `/legacy/research` suffer from label leakage. They are kept for history (tag `legacy-cdss-v1`) and are not evidence of anything.
