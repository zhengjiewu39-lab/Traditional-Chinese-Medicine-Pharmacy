# Changelog

## 1.1.0-ai-pharmacy — 2026-09-28 (pharmacist-governed AI layer)

Product default is the intelligent TCM pharmacy workbench. Supply-resilience simulation (engine 4.0.0, matrix 2.0.0, ERRRA 2.0.0) remains under **药房数字孪生**; frozen paper tables are unchanged.

- Prescription state machine, RBAC (`admin|pharmacist|technician|patient|researcher`), three-track screening, pharmacist queue, patient token portal, governance, audit chain, operations agent + digital-twin proposals.
- `npm run ai:evaluate` on synthetic cases. Production refuses `AI_PROVIDER=mock`.
- Documentation: `docs/ai-*.md`, `AI_PHARMACY_VALIDATION_REPORT.md`.

## 1.0.0-research — 2026-09-28 (research release patch)

Software release tag aligned with frozen paper results (`v1.0.0-research`). Simulation engine remains **4.0.0**; scenario matrix **2.0.0**; ERRRA heuristic **2.0.0**.

### Correctness and inference
- **Recovery metrics:** sustained 7-day smoothed essential fill only after shock end; right-censored `timeToRecovery*`; `restrictedRecoveryTime*` for horizon-capped summaries; `recovered*Share`, Kaplan–Meier median and RMTR in paper outputs.
- **Population:** regional pharmacy populations conserved exactly (±5% jitter, largest-remainder integers); optional `networkSeed` separate from `randomSeed`.
- **Statistics:** pre-registered primary analysis (M5, ERRRA vs cost-only, worst-region essential fill); exploratory cells with Holm adjustment; 1 pp minimum important difference for worst-region fill.

### Deployment and versions
- Production Docker defaults: `ALLOW_DEMO_AUTH=false`, required `TCM_JWT_SECRET`, `npm ci --omit=dev` only.
- `/api/health` reports `release`, `simulationEngine`, `scenarioMatrix`, `errraHeuristic`.
- Node **20** (`.nvmrc`, `engines`, CI, Docker); pipeline `stageSeconds` use monotonic clock.
- Removed fake change-password success; removed `DANGEROUSLY_DISABLE_HOST_CHECK` from dev env.

## 4.0.0 — 2026-09-28 (engine v4, matrix v2.0.0, research-quality revision)

The full report is in [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md). All data remain synthetic.

### Model
- **Supplier network:** primary and backup supplier per warehouse, with lead time, daily capacity, Bernoulli reliability and unit cost. `supplyDisruption` now targets suppliers (`supplierTier`, `targetWarehouses` or `targetSuppliers`) and never reduces warehouse dispatch; `targetRegions` on it is a validation error.
- **Warehouse replenishment:** a base-stock upstream rule limited by `capacityInStandardUnits`.
- **Lateral emergency transfers** between same-region pharmacies (essential SKUs, cost, capacity and cooldown).
- **Backlog:** FIFO queue with per-unit waiting times; horizon-end backlog finalized with censored waits.
- **Mandatory end-of-run inventory audit** at pharmacy, warehouse and network level, plus both pipelines; a failure throws `ConservationError`.
- **Default horizon:** 120 days (warm-up 1–30, shock 31–60, recovery 61–120). Nine presets M1–M9 are shared by the API, tests and paper.

### Policies (baselines 4.0.0, ERRRA 2.0.0)
- One selection gate and one deterministic tie-break for all policies. Every candidate has `priorityScore` and `priorityReason`; every rejection has a reason.
- weighted-equity: the equity term is multiplicative, \((1 + \lambda\cdot\text{needScore}_r)\), and `needScore` is monotone in unmet share, vulnerability and backlog.
- tuned-sQ: \((z, q_{scale})\) per SKU × region type, calibrated on calibration seeds with a guard against the best uniform point.
- Display names: fixed-allocation, tuned-sQ, cost-only, weighted-equity, ERRRA (the ids are unchanged; aliases added).
- New ERRRA ablations: `errra-no-transfers` and `errra-no-supplier-redundancy`.

### Metrics and statistics
- New metrics:
  - same-day unfilled, late-filled and horizon-end unmet (with identity)
  - backlog area
  - stockout incident rate
  - mean and p95 waiting time (censored lower bounds)
  - regional service gap
  - transfer and backup counters
- 15 primary metrics with direction.
- Paired percentile bootstrap (2000 resamples, fixed seed) for all policy pairs; Price of Equity relative to cost-only.

### Reproducibility
- Canonical JSON hashing at every nesting level, with explicit rejection of non-JSON values. `SOURCE_COMMIT` is supported and validated.
- `research:reproduce` stores a five-policy group and requires every metric to match exactly on re-run; `--latest` also fails on an engine mismatch.

### API and security
- Strict request validation (unknown fields, replicate bounds, unique policies, id whitelists).
- Worker-thread job queue with progress and cancellation; run endpoints return 202.
- bcrypt passwords; JWT algorithm check, `timingSafeEqual` and required `exp`; demo-token bypass removed.
- Profile field whitelist; in-memory content-checked uploads; public `/uploads` removed; CSP.

### Experiments
- Matrix **v2.0.0**. v1.1.0 is archived in `paper/config/archive/` and the old results in `paper/archive/results-v1.1.0-engine-v3/`. The revision rationale is in the matrix revision log.
- Pipeline stages: all-pairs bootstrap CSV, PoE with CIs, seven ablations on six scenarios, LHS + PRCC over eight factors, stress grid, and audited-run counts in the manifest.

### Build and dependencies
- Removed unused `react-simple-maps` and `d3-geo`; `react-router-dom` ^7.18.4; `bcryptjs` ^3.
- `npm audit --omit=dev`: 0.
- CI adds the reproduce check and runs without `continue-on-error`.

### Docs
- New: `docs/model-specification.md`, `verification-validation.md`, `experiment-protocol.md`, `result-interpretation.md`, `data-dictionary.md`.
- Rewritten: methodology, metrics, algorithm, limitations, paper outline, checklists, reproducibility, assumptions, README and model card.
- The v3 validation docs moved to `docs/archive/v3/`.

## 3.0.0 — 2026-09-26 (simulation engine v3, research platform)

Legacy CDSS, ERP and CRM state is frozen at tag **`legacy-cdss-v1`** (commit 464dee7).

### Model correctness
- Every policy now decides on the inventory position \(IP = \text{onHand} + \text{onOrder} - \text{backlog}\). Previously on-order stock was ignored, which caused repeated orders while goods were in transit. A higher backlog can no longer reduce an order.
- Warehouses receive an explicit upstream inbound (`upstreamInboundCoverage` × mean demand × supply factor).
- Daily conservation check (`checkConservation`, `ConservationError`) covering three identities: stock, pipeline and backlog.
- Dispatch capacity is consumed only by units the warehouse can issue. Previously stock-less orders used up capacity.
- Policy rank is preserved through the supply cap and the truck cap. Orders carry `policyScore`, `policyRank` and `allocationReason`, and supply and truck logs record deferral reasons.
- Unscored baselines (fixed-allocation, reorder-point) are rationed proportionally, with integer largest remainders. Previously pharmacy index order implicitly favoured urban pharmacies.
- The equity signal is now a regional **deficit** (≥ 0; zero when regions are equal). The old signal could reward the better-served region.

### Policies
- `cost-first` v3: newsvendor (s, S) with EOQ batching capped at 30 days of demand. A line is ordered only if net benefit > 0; rejected lines are logged as `negative_net_benefit`. The stockout loss counts only as benefit.
- `reorder-point` v3: (s, Q) on IP; z and qScale are tuned per scenario on calibration seeds.
- `fixed-allocation` v3: order-up-to covering lead + review + safety days, with reviews staggered by pharmacy.
- `equity-aware` v3: uses the deficit signal and (s, S) batching; still a weighted heuristic.
- **New** `equity-constrained-rolling-horizon` v1.0.0, the **ERRRA heuristic**: stage 1 is a max–min essential service floor; stage 2 adds cost-aware units under a regional gap bound. It includes ablation flags and diagnostics and uses no future demand.

### Metrics
- Added:
  - worst-region essential fill (whole horizon and post-onset), minimum regional service, essential service gap
  - cumulative unmet essential demand, maximum backlog, backlog at horizon
  - service-loss AUC, T90/T95/T99 with censoring, recovery slope
- The paper pipeline adds cost per percentage point of gap reduction, Price of Equity and Pareto efficiency. See `docs/metrics.md`.

### Experiments
- Frozen scenario matrix `paper/config/scenario-matrix.json`:
  - 14 scenarios, 120 days (30 + 30 + 60)
  - seeds: 20 calibration, 100 test, 5 sensitivity
  - **Matrix revision v1.0.0 → v1.1.0:** `upstreamInboundCoverage` changed from 1.05 to 1.2. At 1.05, no policy could recover after a supply disruption (upstream headroom was below the backlog). The change was made on non-reporting seeds 1–3, before any calibration or test-seed run.
- `npm run paper:all` runs these stages: docs tables, calibration, main, ablation, LHS sensitivity, stress grid, CI stability and exhaustive cross-model. Outputs go to CSV, Markdown and SVG, with a manifest of hashes and timings.
- The reorder-point calibration grid was extended to z ≤ 8 and qScale ≤ 24 after the first run put the optimum at the grid edge.

### Tests
- There are 44 new tests: inventory position and onOrder, ranking through caps, equity direction, cost-first economics, extreme conditions, conservation, ERRRA stage-1 optimality and hand-checked instances. All 101 tests pass (57 pre-existing + 44 new).
- Three pre-existing tests changed because the behaviour they encoded changed on purpose:
  - `simulation.test.js` and `simulationRoutes.test.js`: the policy list has 5 entries instead of 4 (ERRRA added); all four original ids are still asserted.
  - `simulationCorrectness.test.js`: fixed-allocation reviews are now staggered (`day % 3 === pharmacyIndex % 3` instead of `day % 3 === 0`).

### Build and repository
- ESLint warnings fixed instead of suppressed. `DISABLE_ESLINT_PLUGIN` removed from CI; `CI=true npm run build` passes; `npm run lint` runs with `--max-warnings 0`.
- Legacy pages are lazy-loaded (`React.lazy`). Unreferenced legacy page files were moved (not deleted) to `legacy/unreferenced-src/pages/`.
- `xlsx` removed (unused; it had unfixable high advisories). `npm audit`: 0 critical, 0 high, after audit fixes and `overrides`.
- CI runs audit (`--audit-level=high`), lint, tests, strict build and `paper:quick`.
- Docs added: `MODEL_CARD.md`, `CITATION.cff`, `docs/algorithm.md`, `docs/metrics.md`, `docs/model-validation.md`, `docs/validation-report.md`, `docs/stress-checklist.md`, `docs/simulate-checklist.md`, `docs/vite-evaluation.md`. README first screen rewritten.

## 2.x and earlier

The earlier simulation platform and the legacy CDSS demo are available via git history and tag `legacy-cdss-v1`.
