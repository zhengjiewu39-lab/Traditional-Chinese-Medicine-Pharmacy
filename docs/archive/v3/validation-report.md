# Validation report (engine v3.0.0, matrix v1.1.0)

Generated from commit `d4c3a4e` by `npm run paper:all` (397 s, one core); hashes are in `paper/results/manifest.json`. All data are synthetic, and every statement holds only 在预定义仿真场景中. The plan is in [model-validation.md](model-validation.md).

## 1. Automated verification

`npm run test:server`: **101 / 101 pass** (57 pre-existing + 44 new), 33 suites.

| Group | Result |
|---|---|
| Inventory position | For all 5 policies: backlog never lowers the order; on-order stock removes it; no duplicate order while in transit |
| Ranking through caps | Supply and truck caps preserve `policyRank`. In an S09 run, no lower-ranked order is served after a higher-ranked one is cut. Proportional rationing is exact. ERRRA is never cut by the supply cap |
| Equity direction | Rural-worse, urban-worse and equal-region cases behave as specified |
| Cost-first | K = 10⁶ → all lines rejected with `negative_net_benefit`; the penalty appears only in the benefit |
| Extreme conditions | Zero demand, unlimited resources, zero capacity, supply cut to 0: all pass for 5 policies and 5 ablations |
| Conservation | Three daily identities hold in S10, S12, S14 for 10 policy variants; a one-unit leak is detected |
| Hand-calculated | Existing hand-checked scenario still exact under v3 |

Three pre-existing tests were changed; see `CHANGELOG.md`. Two changed because the policy list grew from 4 to 5. One changed because fixed-allocation reviews are now staggered by pharmacy.

## 2. Cross-model check (ERRRA stage 1 vs exhaustive enumeration)

| Warehouses | Floor φ | Instances | Exactly optimal | Mean gap | Max gap |
|---|---|---|---|---|---|
| 1 | 1.0 | 500 | 100.0% | 0 | 0 |
| 1 | 0.8 | 500 | 100.0% | 0 | 0 |
| 2 | 1.0 | 500 | 86.4% | 0.0098 | 0.15 |
| 2 | 0.8 | 500 | 90.8% | 0.0081 | 0.20 |

Stage 1 is exact with one shared capacity. With coupled capacities it is a heuristic with a small average gap.

## 3. Baseline calibration (reorder-point, calibration seeds only)

| Scenario | S01 | S02 | S03 | S04 | S05 | S06 | S07 | S08 | S09 | S10 | S11 | S12 | S13 | S14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z | 1.28 | 2.05 | 1.65 | 8 | 1.65 | 2.58 | 27 | 6 | 12 | 12 | 6 | 5 | 8 | 18 |
| qScale | 1 | 1 | 1.5 | 12 | 1 | 1.5 | 3 | 1 | 8 | 8 | 12 | 8 | 16 | 36 |

After adaptive grid extension, every optimum lies inside the grid. Very high z in disrupted scenarios means the cost-plus-penalty objective rewards stockpiling ahead of the disruption.

## 4. CI stability (ERRRA − cost-first)

For S04, S09, S10 and S14, both Δ worst-region essential fill and Δ cost exclude 0 from n = 10 onward and keep their sign up to n = 100. The CI half-width shrinks roughly as \(1/\sqrt n\); for S10, Δ worst fill has half-width 0.019 at n = 10 and 0.004 at n = 100. With 100 seeds, the headline differences are not a small-sample artefact. See `paper/tables/ci-stability.md`.

## 5. Structural behaviour checks (from the main run)

- **No disturbance (S01):** all adaptive policies reach ≥ 0.998 worst-region essential fill with nearly identical cost. Fixed allocation costs about 26% more because of its fixed review stock, and has a small gap.
- **Monotonic stress response:** as the surge rises (S02 → S04) or supply falls (S05 → S07), fixed allocation degrades monotonically (worst fill 0.905 → 0.319; 0.957 → 0.371).
- **Recovery:** every adaptive policy recovers (Rec95 = 1.00) in S02–S11 and S13. Only ERRRA and cost-first recover in S13. No policy recovers in S12 or S14, where backlog persists at the horizon (T95 censored at 60 days).
- **Default scenario:** in the default API scenario, cost-first and equity-aware produce different costs (tested).

## 6. Face validation

Not yet conducted. The plan (2–3 reviewers, structural questions only) is in [model-validation.md](model-validation.md) §4.

## 7. Threats to validity that the results expose

1. **S12 and S14** (severe scarcity): ERRRA cuts the essential gap by about 48 percentage points compared with cost-first, but increases cumulative unmet essential demand by +4,144 (S12) and +2,853 (S14) units. Under those conditions equity and total-unmet goals conflict.
2. **In the LHS**, ERRRA has more unmet essential demand than cost-first in 41 of 256 samples, concentrated where the supply factor ≤ 0.49 (34% of those samples vs 6% above).
3. **Stress grid:** when supply = 0.1 and surge ≥ ×2.5, ERRRA is slightly worse than cost-first on worst-region fill (−0.006, −0.008). Twelve of the 25 cells fail for every policy (worst fill < 0.5).
