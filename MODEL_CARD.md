# Model card — Community pharmacy supply simulation and the ERRRA allocation heuristic

| | |
|---|---|
| Software release | **1.0.0-research** (tag `v1.0.0-research`; frozen paper results commit separate from source) |
| Model | Daily simulation of a synthetic supplier → warehouse → community pharmacy network (`simulation-engine-v4.0.0`) and the allocation policies it evaluates |
| Proposed method | **ERRRA allocation heuristic** (Equity-constrained Resilient Rolling-horizon Allocation, id `equity-constrained-rolling-horizon`, v2.0.0) |
| Type | Deterministic, rule-based operations-research heuristic. Not machine learning, not AI, not an optimizer; no trained parameters |
| Data | **Synthetic only.** Every parameter is a synthetic scenario assumption (合成场景假设). No patient, prescription, pharmacy, supplier or epidemic data |
| Scope of conclusions | Only within the predefined simulation scenarios (在预定义仿真场景中): the nine frozen scenarios of `paper/config/scenario-matrix.json` v2.0.0 and the LHS and stress ranges in `docs/experiment-protocol.md` |

## Intended use

- Methodological research on replenishment and allocation rules in stylized pharmacy networks: equity, resilience and cost trade-offs, failure regions, ablations.
- Teaching and reproducible comparison of heuristics under common random numbers.

## Out of scope and prohibited use

- Clinical decisions, dispensing, prescribing or patient triage.
- Real procurement, allocation or emergency planning, and any claim about real policy effects.
- Describing ERRRA as optimal, as an optimizer, as AI, or as validated on real data.

## Inputs and outputs

- **Inputs:** a scenario JSON (network, suppliers, regions, SKUs, logistics, events) and a seed. Policies see only:
  - the current state (on hand, on order, backlog)
  - demand history and regional service signals from the last 7 days
  - observed supply-side event factors

  They never see future demand or the true demand-surge multiplier.
- **Outputs:**
  - daily logs
  - orders with `priorityScore`, `policyRank` and `priorityReason`, plus the rejection reason for every unselected line
  - supplier and transfer logs, the inventory audit, and the metrics in `docs/metrics.md`

## Evaluation

- Main comparison: 100 test seeds × 9 scenarios × 5 policies. Paired bootstrap 95% CIs for all policy pairs and 15 metrics; Price of Equity; Pareto sets.
- tuned-sQ is calibrated per SKU × region type on 20 disjoint calibration seeds. ERRRA's defaults were fixed a priori.
- 7 ablations over 6 scenarios; LHS + PRCC (N = 256, 8 factors); 5 × 5 stress grid; CI stability (n = 10…100); stage-1 check against exhaustive enumeration.
- 29,500 simulation runs, all passing the mandatory inventory audit.
- Results are in `paper/tables/*.md`, summarized in `FINAL_VALIDATION_REPORT.md` and `docs/result-interpretation.md`.

## Known limitations and failure modes

See `docs/limitations.md`. Main points:

1. A calibrated stockpiling (s,Q) baseline reaches higher worst-region essential fill than ERRRA in six of nine scenarios (M2–M7), at up to 30% extra cost. ERRRA is better under tight transport and in the extreme scenario.
2. ERRRA has a longer waiting-time tail than cost-only in several scenarios, and higher cumulative unmet demand in M2 and M7.
3. Failure region: with very large surges and deep primary-supplier loss, every policy has worst-region essential fill < 0.5.
4. Stage 1 is exact only with a single shared capacity. The vulnerability tilt has a negligible effect.
5. The model has not been reviewed by domain experts (face validation is planned).

## Ethics

Equity is measured between synthetic regions with synthetic vulnerability weights. The weights are modelling choices, not statements about real populations.
