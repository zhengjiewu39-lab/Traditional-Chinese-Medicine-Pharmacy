# Verification and validation (engine v4)

Verification asks whether the code implements the model in [model-specification.md](model-specification.md). Validation asks whether the model is fit for its stated purpose: comparing allocation rules under synthetic scenario assumptions (合成场景假设).

The model is **not** validated against real data. No real data exist in this repository, and no result may be read as a real-world policy effect.

Run everything with:

```bash
npm run simulation:test     # all server and simulation tests
npm run paper:quick         # pipeline smoke run, audit enforced on every run
```

## 1. Verification

### 1.1 Stock-flow correctness

| Check | Where | Enforced how |
|---|---|---|
| Mandatory end-of-run audit at pharmacy, warehouse and network level, plus warehouse and transfer pipelines | `inventoryAudit` in `simulationEngine.js` | Throws `ConservationError` in every run; `paper` pipeline aborts on failure and records the audited-run count in `paper/results/manifest.json` |
| Audit passes for every policy and every matrix scenario M1–M9 | `researchQuality.test.js` › inventory audit | test |
| A one-unit discrepancy fails the audit | `researchQuality.test.js` | test |
| Daily stock, pipeline and backlog identities in compound and extreme scenarios | `modelCorrectness.test.js` › conservation | test with `checkConservation: true` |
| A lost unit is detected | `modelCorrectness.test.js` | test |
| Same-day unfilled = late-filled + horizon-end unmet | `researchQuality.test.js` › unmet-demand concepts | test |
| Hand-calculated fills, backorders, costs and arrivals | `handCalculatedScenario.test.js` | test |

### 1.2 Decision logic

| Check | Where |
|---|---|
| Orders use \(IP = I + O - B\): higher backlog never reduces an order, higher on-order reduces it, no duplicate order while a shipment is in transit (every policy) | `modelCorrectness.test.js` › inventory position |
| Emitted quantities are non-negative integers | `modelCorrectness.test.js` |
| Dispatch and truck caps preserve policy rank; units the warehouse cannot issue do not consume capacity; proportional rationing uses integer largest remainders | `modelCorrectness.test.js` › capacity |
| Selection gate: a line whose warehouse has no stock is not selected and the reason is logged; every selected order has qty > 0, benefit > 0, a finite score and a reason; ranks follow score | `researchQuality.test.js` › selection gate |
| Tie-break on exactly equal scores is region, then pharmacy, then SKU | `researchQuality.test.js` |
| Cost-only rejects lines with net benefit ≤ 0; the stockout penalty appears only on the benefit side | `modelCorrectness.test.js` › cost-first economics |
| Equity direction: only the worse-served region gets a deficit; equal regions get none; `needScore` is monotone in unmet share, vulnerability and backlog; with the line fixed, a more severe or more vulnerable region never ranks lower | `modelCorrectness.test.js` › equity |
| With equal projected service, the more vulnerable region is served first | `researchQuality.test.js` › vulnerability |
| ERRRA stage 1 serves the lowest region first and equalizes equal regions; it plans within capacity, so the dispatch cap never cuts its orders | `modelCorrectness.test.js` |
| ERRRA stage 1 matches exhaustive enumeration: exactly optimal on a single shared capacity (300 instances per floor); near-optimal with two capacities | `errraOptimality.test.js`, pipeline stage `crossModel` |
| The five policies produce different decisions | `modelCorrectness.test.js`, `researchQuality.test.js` › differentiation |

### 1.3 Network mechanisms

| Check | Where |
|---|---|
| A disruption on one warehouse's primary supplier reduces only that warehouse's upstream supply and never its dispatch capacity | `researchQuality.test.js` › suppliers |
| Backup suppliers ship only when redundancy is enabled | `researchQuality.test.js` |
| On-hand plus pipeline never exceeds `capacityInStandardUnits` | `researchQuality.test.js` |
| Lateral transfers happen under stress, are essential-only, stay within a region and are costed; no reverse transfer within the cooldown; regional daily capacity respected; disabled by the ablation and by scenario config | `researchQuality.test.js` › lateral transfers |

### 1.4 Extreme conditions

| Condition | Expected | Where |
|---|---|---|
| Zero demand | no stockouts, no backlog | `modelCorrectness.test.js` |
| Unlimited stock and capacity | fill ≥ 99.9% for every policy | same |
| Zero dispatch and truck capacity | nothing ships, no shipment cost | same |
| Complete supply cut | no upstream supply; pharmacies receive at most the initial warehouse stock | same |

### 1.5 Reproducibility

| Check | Where |
|---|---|
| Canonical JSON hash is independent of key order at every level, changes with any nested field, keeps array order, and rejects NaN, Infinity, undefined, functions and cycles | `researchQuality.test.js` › scenario hash |
| `SOURCE_COMMIT` is used for builds without `.git` and is validated | `researchQuality.test.js` |
| Same seed → every metric identical for every policy; different seeds → different demand | `researchQuality.test.js`, `simulation.test.js` |
| Stored experiments re-run exactly (all metrics compared through canonical JSON) | `npm run research:reproduce` (CI, `REPLICATES=10`) and `--latest` |
| Paired bootstrap is deterministic with its fixed seed | `researchQuality.test.js` › statistics |
| The mean converges and the CI narrows as replicates grow | `researchQuality.test.js`; pipeline stage `ciStability` |

### 1.6 API and security

| Check | Where |
|---|---|
| Unknown fields, missing or duplicate policies, and bad replicate counts return 400; ids outside the whitelist are rejected; out-of-range scenarios are invalid (no clamping) | `simulationRoutes.test.js`, `researchQuality.test.js` › validation |
| Group jobs run in a worker thread, report progress, can be cancelled, and store paired bootstrap comparisons | `simulationRoutes.test.js` |
| bcrypt-only password storage; JWT rejects malformed, tampered, re-signed, alg-changed and legacy demo tokens; profile updates cannot change role, id or username; uploads rejected on extension/MIME mismatch, binary content or disguised executables | `auth.test.js` |

## 2. Validation

| Aspect | Evidence | Status |
|---|---|---|
| **Face validity** of mechanisms: backorders, supplier tiers, lateral transfers, dispatch and truck caps | Mechanisms follow standard inventory-theory constructs (base-stock, (s,Q), (s,S), expected shortfall); see model-specification | Review by domain experts **not yet conducted** |
| **Behavioural validity** | Shocks reduce service and recovery follows shock end (daily fill figures). Tighter capacity and longer lead times degrade every policy (scenario matrix). Removing backup suppliers under a primary outage collapses service (ablation) | Checked in `paper/tables/main.md`, `ablation.md` |
| **Structural sensitivity** | LHS + PRCC over eight scenario and design factors; 5 × 5 stress grid | `paper/tables/sensitivity.md`, `stress.md` |
| **Fairness of comparison** | Common random numbers; one frozen matrix; tuned-sQ calibrated per SKU × region on calibration seeds only; ERRRA defaults fixed a priori; the same network mechanisms are available to every policy | `experiment-protocol.md` |
| **Empirical validity** | None: there is no real data | Not claimed |

## 3. What would falsify the main claims

- A matrix scenario where ERRRA's worst-region essential fill is below cost-only's with a paired 95% CI excluding 0. Reported in `main.md` if it occurs.
- Stress cells where ERRRA is worse than cost-only (`stress.md`).
- LHS samples with a negative Δ worst-region fill (`sensitivity.md`, "worse" count).
- An audit failure in any run. The pipeline stops, so no results would be produced.
