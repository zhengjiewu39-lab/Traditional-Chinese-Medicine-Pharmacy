# Experiment protocol (matrix v2.0.0, engine v4)

This protocol fixes, before any reported result is generated, what is run, on which seeds, and how results are compared. All scenarios are synthetic scenario assumptions (合成场景假设). Conclusions hold only within the predefined simulation scenarios (在预定义仿真场景中).

## 1. Frozen inputs

| File | Content |
|---|---|
| `paper/config/scenario-matrix.json` | Nine scenarios M1–M9 built from `SCENARIO_PRESETS` (`scenarioSchema.js`), each with its canonical-JSON SHA-256 `scenarioHash`; policy lists; ablation scenarios; sensitivity base; revision log |
| `paper/config/seeds.json` | 20 calibration seeds (900001–900020), 100 test seeds (100001–100100) and 5 sensitivity seeds (500001–500005); the three sets are disjoint |
| `paper/config/archive/` | Superseded matrix versions (v1.1.0), kept unchanged |

`npm run paper:matrix` regenerates the matrix from the presets and refuses to overwrite it without `--force`. Changing the matrix means a new `matrixVersion` with a revision entry; the previous file is archived automatically.

**Revision v1.1.0 → v2.0.0.** Engine v4 moved supply disruptions from warehouse dispatch to suppliers. With the old 20-day warehouse buffer, a 30-day shock hitting a single mechanism was absorbed completely: no policy had any shortage. This was checked on non-reporting seeds 1–3. The base warehouse buffer was therefore set to 10 days, below the 18-demand-day deficit of a 30-day primary outage at 60% net loss. The same buffer applies to every policy. The change was made before any calibration- or test-seed run and was not chosen to favour any policy.

## 2. Horizon and scenarios

The default horizon is 120 days: warm-up days 1–30, shock days 31–60, recovery days 61–120. Every event in M2–M9 is active on days 31–60.

| Key | Content |
|---|---|
| M1-normal | no events (control) |
| M2-demand-surge | demand ×1.6, all regions |
| M3-supply-disruption | all primary suppliers down |
| M4-transport-disruption | rural transit ×2.5, suburban ×1.5 |
| M5-compound | surge ×1.6 + primary suppliers ×0.5 + rural transit ×2.0 (**default scenario**) |
| M6-long-lead | M5 with primary lead 5 d, backup 12 d, SKU lead times ×2.5 |
| M7-tight-warehouse | M5 with 4 days of warehouse stock |
| M8-tight-transport | M5 with dispatch and truck capacity at 1.1 × baseline demand |
| M9-extreme | surge ×2.2, all suppliers ×0.4, rural transit ×2.5, lead ×2.0, capacity ×0.8 |

The full parameters are in `paper/tables/scenarios.md` and `parameters.md`.

## 3. Policies

These five policies are compared. They share one scenario JSON, the same network mechanisms and the same seeds:

1. fixed-allocation (`fixed-allocation`)
2. tuned-sQ (`reorder-point`): \((z, q_{scale})\) per SKU × region type, calibrated per scenario on calibration seeds only ([model-specification §10](model-specification.md))
3. cost-only (`cost-first`)
4. weighted-equity (`equity-aware`)
5. ERRRA allocation heuristic (`equity-constrained-rolling-horizon`): defaults fixed a priori and never tuned on any seed set

No policy parameter was chosen by looking at test-seed results.

## 4. Design

| Stage | Design | Seeds | Output |
|---|---|---|---|
| calibrate | tuned-sQ grid per scenario | 20 calibration | `results/calibration/`, `tables/calibration.md` |
| main | 9 scenarios × 5 policies | 100 test | `results/main/`, `tables/main.md`, figures |
| ablation | 6 scenarios (M2, M3, M4, M5, M8, M9) × (ERRRA + 7 ablations) | 100 test | `results/ablation/`, `tables/ablation.md` |
| sensitivity | LHS, N = 256 over 8 factors on M5; ERRRA, cost-only and weighted-equity | 5 sensitivity per sample | `results/sensitivity/`, `tables/sensitivity.md` |
| stress | 5 × 5 grid of surge (×1–×3) × primary supply (1–0) on the M5 structure | first 20 test | `results/stress/`, `tables/stress.md` |
| ciStability | first n = 10…100 test seeds for ERRRA − cost-only | test | `tables/ci-stability.md` |
| crossModel | ERRRA stage 1 vs exhaustive enumeration, 500 random instances per configuration | fixed | `tables/cross-model.md` |

Ablations remove one component each: minimum service floor, vulnerability weights, rolling-horizon adaptation, essential-medicine priority, compound-disruption awareness, lateral transfers and supplier redundancy.

Sensitivity factors (ranges):

| Factor | Range |
|---|---|
| demand-surge magnitude | 1.0–2.2 |
| disruption duration | 10–45 days |
| primary supplier lead time | 1–6 days (backup = primary + 3) |
| warehouse initial stock | 4–20 days |
| transport capacity | 1.0–2.0 × demand |
| ERRRA minimum service floor | 0.8–1.0 |
| rural vulnerability weight | 1.0–3.0 |
| transfer cost | 0–3 per unit |

The method is LHS + PRCC only; no second global method is run.

## 5. Statistics

### Pre-registered primary analysis

| Item | Value |
|---|---|
| Primary scenario | **M5-compound** |
| Primary comparison | **ERRRA** (`equity-constrained-rolling-horizon`) **vs cost-only** (`cost-first`) |
| Primary outcome | **`worstRegionEssentialFillRate`** |
| Key secondary outcomes | `totalCost`, `cumulativeUnmetDemand`, `p95WaitingTime` |
| Minimum important difference (worst-region fill) | **1.0 percentage point** |

Only this comparison on the primary outcome in M5 is labelled **primary inference** in `tables/main.md` (* = 95% bootstrap CI excludes 0). Gains below 1 pp with a CI excluding 0 are reported as exploratory / below MID.

### Exploratory comparisons

- **Per cell:** mean, SD and a 95% t-interval over the 100 test seeds.
- **All other policy pairs, scenarios and metrics** are **exploratory**. Paired differences use the same bootstrap (2000 resamples, seed 20240901). Holm step-down adjusted p-values are computed across exploratory pairs only († in tables when adjusted p ≤ 0.05). Effect sizes and 95% CIs are always reported.
- **Price of Equity** relative to cost-only: \(\text{PoE} = \overline{(C_A - C_{\text{cost-only}})/C_{\text{cost-only}}}\) (paired per seed, bootstrap CI).
- **Cost per percentage point** of worst-region essential fill gained: \(\Delta C / (100\,\Delta\text{worst})\), reported only when both the gain and the extra cost are positive.
- **Pareto efficiency** on (mean cost ↓, mean worst-region essential fill ↑, mean cumulative unmet ↓) within a scenario.
- **Recovery times:** sustained 7-day smoothed essential fill at \(p \cdot B\) starting only after shock end; `timeToRecovery{p}` is null if censored; `restrictedRecoveryTime{p}` uses the horizon cap for censored runs. Report `recovered{p}Share`, Kaplan–Meier median and RMTR where applicable.

## 6. Integrity rules

- Every run passes the mandatory inventory audit, or the pipeline stops. The manifest records the number of audited runs per stage.
- `paper/results/manifest.json` records engine version, matrix and seed SHA-256, git commit and its source, Node version, bootstrap settings, ERRRA parameters and stage timings.
- Experiments stored through the API record scenario hash, engine version, commit, package-lock hash and Node version. `npm run research:reproduce` re-runs a stored group and requires every metric to match exactly.
- Results that go against ERRRA (worse metrics, failure regions, null ablations) are reported in the same tables as favourable ones.
