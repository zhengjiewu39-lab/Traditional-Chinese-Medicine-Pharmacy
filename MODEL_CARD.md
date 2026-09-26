# Model card — Community pharmacy supply simulation and ERRRA heuristic

| | |
|---|---|
| Model | Daily discrete simulation of a synthetic warehouse → community pharmacy network (`simulation-engine-v3.0.0`) and the allocation policies it evaluates |
| Proposed method | **ERRRA heuristic** (Equity-constrained Resilient Rolling-horizon Allocation, policy id `equity-constrained-rolling-horizon`, v1.0.0) |
| Type | Deterministic, rule-based operations-research heuristic. Not machine learning and not AI; no trained parameters |
| Data | **Synthetic only.** Parameters are illustrative (`scenarioSchema.js` `parameterMeta`). No patient, prescription, pharmacy transaction or epidemic data |
| Scope of conclusions | Only 在预定义仿真场景中: the 14 frozen scenarios of `paper/config/scenario-matrix.json` v1.1.0 and the LHS and stress ranges in `docs/validation-report.md` |

## Intended use

- Methodological research on replenishment and allocation rules in stylised pharmacy networks: equity, resilience and cost trade-offs, failure boundaries, ablations.
- Teaching and reproducible comparison of heuristics under common random numbers.

## Out of scope and prohibited use

- Clinical decisions, dispensing, prescribing or patient triage.
- Real procurement, allocation or emergency planning, or any claim about real policy effects.
- Describing ERRRA as optimal, as AI, or as validated on real data.

## Inputs and outputs

- **Inputs:** a scenario JSON (network, regions, SKUs, logistics, events) and a seed. Policies see only the current state (on hand, on order, backlog), demand history, regional service signals from the last 7 days, and observed supply-side event factors. They never see future demand or the true demand-surge multiplier.
- **Outputs:** daily logs, orders with `policyScore`, `policyRank` and `allocationReason`, ERRRA diagnostics, and the metrics defined in `docs/metrics.md`.

## Evaluation

- 100 test seeds × 14 scenarios × 5 policies, paired against cost-first with 95% t-CIs and win/loss counts.
- Reorder-point is tuned per scenario on 20 disjoint calibration seeds.
- Ablation (5 components), LHS sensitivity (N = 256, 10 factors), stress grid (5 × 5), CI stability (n = 10…100), and a cross-check against exhaustive enumeration.
- Results: `paper/tables/*.md`; summary in `docs/validation-report.md`.

## Known limitations and failure modes

See `docs/limitations.md`. Headline points:

1. Under severe scarcity (S12, S14; LHS supply factor ≲ 0.5), ERRRA narrows the regional gap but can increase cumulative unmet essential demand.
2. When supply is very low, worst-region essential fill falls below 0.5 for every policy.
3. Stage 1 is exact only with a single shared capacity.
4. The vulnerability tilt has a negligible effect.
5. The model structure has not been reviewed by domain experts yet (face validation is planned).

## Ethics

Equity is measured between synthetic regions with synthetic vulnerability weights. The weights are modelling choices, not statements about real populations.
