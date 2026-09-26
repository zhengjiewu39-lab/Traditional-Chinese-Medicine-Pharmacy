# Changelog

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
