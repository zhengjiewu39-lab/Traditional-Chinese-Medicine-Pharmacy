# Data dictionary

All files contain **synthetic** data only. Units: "units" means standard units of a SKU, "days" means simulated days, and costs are in synthetic currency.

## Paper pipeline outputs (`paper/results/`)

### `main/records.csv`: one row per scenario × policy × test seed

| Field | Meaning |
|---|---|
| `scenario`, `policy`, `seed` | matrix key (M1–M9), canonical policy id, test seed |
| `overallFillRate` … `totalCost` | the 15 primary metrics ([metrics.md](metrics.md)); recovery times are censored at 60 |
| `recovered95` | 1 if the 95% recovery level was reached within the horizon, 0 if censored, empty in M1 |
| `procurementCost`, `transportCost`, `orderFixedCost`, `holdingCost`, `upstreamSupplyCost`, `lateralTransferCost` | components of totalCost (holding = pharmacy + warehouse) |
| `lateralTransferUnits`, `backupSupplierUnits` | units moved by lateral transfers; units shipped by backup suppliers |
| `cumulativeUnmetEssentialDemand` | same-day unfilled essential units |
| `weightedStockoutPenalty` | \(\sum p_k\) × same-day unfilled units (not in totalCost) |

### `main/summary.csv`: one row per scenario × policy

`n`, then `<metric>_mean`, `<metric>_sd`, `<metric>_ci95Low` and `<metric>_ci95High` (t-interval) for each primary metric, and `recovered95Share`.

### `main/paired-all-pairs.csv`: all 10 policy pairs × 15 metrics × 9 scenarios

| Field | Meaning |
|---|---|
| `policyA`, `policyB`, `metric`, `better` | difference is A − B; `better` = direction of improvement for the metric |
| `meanDiff`, `sd` | mean and SD of per-seed differences |
| `ci95Low`, `ci95High` | paired percentile bootstrap 95% CI (2000 resamples, seed 20240901) |
| `aHigher`, `aLower`, `ties`, `n` | number of seeds with A − B > 0, < 0, = 0; number of pairs |

### `main/price-of-equity.csv`

| Field | Meaning |
|---|---|
| `priceOfEquity`, `priceOfEquityCi95Low`, `priceOfEquityCi95High` | mean per-seed \((C_A - C_{\text{cost-only}})/C_{\text{cost-only}}\) with bootstrap CI |
| `deltaCost`, `deltaWorstRegionEssentialFillPP` | paired mean Δ total cost; Δ worst-region essential fill in percentage points |
| `costPerWorstRegionPP` | Δcost / Δpp when both > 0, otherwise empty |
| `status` | `reference`, `ok`, `no_worst_region_gain` or `no_extra_cost` |

### Other result files

| File | Content |
|---|---|
| `main/pareto.csv` | per scenario × policy: mean cost, mean worst-region essential fill, mean cumulative unmet, `paretoEfficient` |
| `main/daily-essential-fill.json` | `"<scenario>\|<policy>"` → daily essential fill (mean over test seeds) |
| `calibration/grid.csv`, `calibration/reorder-point.json` | every evaluated (z, qScale) and its objective; chosen uniform and per-line parameters per scenario |
| `ablation/records.csv`, `ablation/paired-vs-full-errra.csv` | ablation runs; `<metric>_diff` / `_ci95Low` / `_ci95High` = ablated − full ERRRA |
| `sensitivity/lhs-samples.csv` | one row per LHS sample: the 8 factor values, `errraWorst`, `cfWorst`, `eqWorst`, `dWorst`, `dUnmet`, `dCost`, `dGap` (ERRRA − cost-only, mean over sensitivity seeds) |
| `sensitivity/prcc.csv` | per factor: `prcc_<outcome>` and `p_<outcome>` |
| `stress/grid.csv` | per surge × primary supply × policy: mean worst-region essential fill, cumulative unmet, total cost |
| `ci-stability/paired-ci-by-n.csv` | n, mean Δ, CI half-width, CI-excludes-zero |
| `cross-model/stage1-vs-exhaustive.csv` | instances, exact matches, mean and max gap |
| `manifest.json` | engine and matrix versions, SHA-256 of matrix and seeds, git commit and source, Node, bootstrap settings, ERRRA parameters, audited runs per stage, stage timings |

## Stored experiments (`data/simulation-experiments/exp_<13-digit ms>_<8 hex>.json`)

| Field | Meaning |
|---|---|
| `id`, `startedAt`, `finishedAt` | whitelisted experiment id and timing |
| `scenarioId`, `scenarioVersion`, `scenario`, `scenarioHash` | normalized scenario JSON, schema version and canonical-JSON SHA-256 |
| `policyId`, `policyVersion`, `policyParams` | policy and effective parameters |
| `randomSeed`, `replicateSeeds`, `replicates` | seeds run (common random numbers across a group) |
| `results[]` / `metrics` | per-replicate `{seed, metrics, runLog?}` (multi-replicate) or the single run's metrics |
| `summary` | mean, SD and t-CI per summary key |
| `regionalAggregate`, `dailyAggregate` | per-region and per-day aggregates over replicates |
| `groupSummary.pairedComparisons` | `{referencePolicy, priceOfEquity, pairs[{policyA, policyB, pairedReplicates, metrics{key: {meanDiff, sd, ci95Low, ci95High, n, resamples, bootstrapSeed, wins, losses, ties, excludedPairs}}}]}` (group runs) |
| `engineVersion`, `gitCommitHash`, `gitCommitSource`, `packageLockHash`, `nodeVersion` | provenance; `gitCommitSource` is `env:SOURCE_COMMIT`, `git` or `unknown` |
| `rerunOf`, `sourceScenarioHash` | set on exact re-runs |
| `runLog` | full log for a single run or replicate 0: daily series, orders, transfers, suppliers, inventory audit |

## Order decisions (`runLog.daily[].decisions`, full logs)

| Field | Meaning |
|---|---|
| `pharmacyId`, `warehouseId`, `drugId`, `regionType`, `priority` | line identity |
| `inventoryPosition`, `onHand`, `onOrder`, `backlog` | state at decision time |
| `requestQty` / `qty` | quantity requested by the policy |
| `expectedBenefit` | gate input (benefit; net benefit for cost-only) |
| `priorityScore` (= `policyScore`), `policyRank` | score and rank after the selection gate (rank null if not selected) |
| `priorityReason` | human-readable reason for the score |
| `selected`, `notSelectedReason` | gate result: `zero_request`, `no_expected_benefit`, `score_below_threshold`, `no_serving_warehouse`, `warehouse_out_of_stock`, `no_transport_capacity`, or a policy-specific reason |

Shipment logs add `dispatch_cap` / `warehouse_stock` (warehouse stage) and truck-cap deferrals.
