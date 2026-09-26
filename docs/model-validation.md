# Model validation plan (synthetic simulation)

Scope: verification (the code does what `docs/algorithm.md` says) and structural validation (behaviour is plausible and consistent). There is **no empirical validation**: the model is not fitted to or compared with real pharmacy, epidemic or patient data. Every conclusion therefore holds only 在预定义仿真场景中. Results are in [validation-report.md](validation-report.md).

## 1. Verification — automated (`npm run simulation:test`)

| Area | Test file | What is checked |
|---|---|---|
| Hand-calculated inventory and flows | `handCalculatedScenario.test.js` | Fill/backorder arithmetic, warehouse issue limits, arrival before backlog service, costs |
| Inventory position | `modelCorrectness.test.js` | For every policy: a higher backlog never lowers the order; a higher onOrder lowers it (to 0 when the pipeline covers the need); no second order while the first is in transit; integer, non-negative quantities |
| Ranking through caps | `modelCorrectness.test.js` | Supply and truck caps serve `policyRank` order; unissuable stock does not consume capacity; once an order is cut by supply cap, lower-ranked orders get none; proportional rationing is exact; ERRRA plans within capacity |
| Equity signal direction | `modelCorrectness.test.js` | Rural worse → rural deficit, rural ranked earlier; urban worse → rural not favoured; equal regions → zero bonus; ERRRA stage 1 serves the lowest region first and equalizes when regions are equal |
| Cost-first economics | `modelCorrectness.test.js` | Negative-net lines are rejected with a logged reason; selected lines have net > 0; stockout penalty only on the benefit side |
| Extreme conditions | `modelCorrectness.test.js` | Zero demand → no stockout or backlog; unlimited stock and capacity → fill ≥ 99.9%; zero capacity → nothing ships and no shipping cost; total supply cut → no shipments (all policies and ablations) |
| Conservation | `modelCorrectness.test.js` | Three daily identities (stock, pipeline, backlog) in S10, S12, S14 for all policies and ablations; the checker itself detects a one-unit discrepancy |
| Cross-model | `errraOptimality.test.js` + pipeline `crossModel` | ERRRA stage 1 vs exhaustive integer enumeration: exact for a single capacity; ≥ 80% exact and mean gap ≤ 0.03 with two capacities |
| Pre-existing suite | `simulation.test.js`, `simulationCorrectness.test.js`, `simulationRoutes.test.js` | Determinism under seeds, event windows, API routes, experiment archive |

## 2. Experimental design controls

- **Frozen matrix** `paper/config/scenario-matrix.json` (v1.1.0) and **seed sets** `paper/config/seeds.json` were written by `scripts/paper/build-scenario-matrix.js`, which refuses to overwrite without `--force`. The manifest stores SHA-256 hashes of both files. The one revision (v1.0.0 → v1.1.0, upstream inbound coverage) was made **before** any calibration or test-seed run and is recorded in the matrix together with its reason.
- **Common random numbers**: demand is drawn from the seed in a fixed order before any policy acts, so every policy faces identical demand paths.
- **Disjoint seeds**: 20 calibration seeds (900001–900020) are used only to tune reorder-point; 100 test seeds (100001–100100) are used for every reported table; 5 sensitivity seeds (500001–500005) are used for LHS.
- **No cherry-picking**: every scenario and every seed in the matrix is reported. ERRRA parameters are the a-priori defaults in `ERRRA_DEFAULTS`.
- **Baseline strength**: reorder-point is tuned per scenario (an advantage ERRRA does not get), over a grid wide enough to reach the plateau where larger (s, Q) stops helping. In some disrupted scenarios the best grid point is at the upper z edge; a probe on S10 beyond the grid (z = 10, qScale = 40) did not improve the objective (1.465M vs 1.460M at z = 8, qScale = 24).

## 3. CI stability

`paper/tables/ci-stability.md` recomputes the ERRRA − cost-first paired difference on the first n = 10, 20, 30, 50, 75, 100 test seeds. A conclusion is treated as stable only if its sign and its CI-excludes-zero status do not change once n ≥ 30.

## 4. Face validation (structural review only)

Planned with 2–3 reviewers who have community-pharmacy or supply-chain background. Reviewers **only** judge structure; they do not supply data or calibrate parameters.

| Step | Material | Question |
|---|---|---|
| 1 | `docs/algorithm.md` §1 | Is the daily sequence (inbound → arrivals → demand → decisions → dispatch) plausible? Are backorders FIFO a reasonable simplification? |
| 2 | Scenario table (`paper/tables/scenarios.md`) | Are the disturbance types and magnitudes recognisable stress patterns (not forecasts)? |
| 3 | Daily essential-fill figures | Do the warm-up, trough and recovery shapes look qualitatively plausible? |
| 4 | Policy table | Are the baselines recognisable practice-style rules (fixed allocation, (s,Q), cost-driven)? |
| 5 | Limitations | What structural omissions matter most (e.g. expiry, substitution, patient switching between pharmacies)? |

Record per reviewer: role, date, answers, and the model changes made in response (to be recorded in CHANGELOG). Status: **not yet conducted**. No reviewer feedback is claimed in any results.

## 5. Known validity threats

- Synthetic parameters; demand model has no autocorrelation and no cross-pharmacy switching.
- Metric `cumulativeUnmetEssentialDemand` counts demand not filled at arrival; allocating scarce goods to pharmacies with backlog serves earlier patients first and can raise this count while lowering the gap (seen in S12 and S14).
- ERRRA's multi-warehouse stage 1 is a heuristic (§1 cross-model gaps).
- Unshipped requests are re-issued the next day instead of being held in a queue; fixed order cost is charged per shipped line, which penalises proportional rationing (many partial lines) for the reorder-point baseline.
