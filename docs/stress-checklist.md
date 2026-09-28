# Stress-test checklist (engine v4)

Use this before claiming any result about behaviour under disruption. All scenarios are synthetic scenario assumptions (合成场景假设).

## Automated (must pass)

- [ ] `npm run simulation:test`, including:
  - [ ] zero demand → no stockouts or backlog
  - [ ] unlimited stock and capacity → fill ≥ 99.9% for every policy
  - [ ] zero dispatch and truck capacity → nothing ships, no shipment cost
  - [ ] complete supply cut → no upstream supply; pharmacies receive at most the initial warehouse stock
  - [ ] daily stock, pipeline and backlog identities in compound and extreme scenarios
  - [ ] end-of-run inventory audit passes for every policy on M1–M9; a one-unit discrepancy fails it
  - [ ] a disruption on one warehouse's primary supplier leaves the other warehouse and all dispatch capacity untouched
  - [ ] `capacityInStandardUnits` is never exceeded
- [ ] `npm run paper:all` stress stage: 5 × 5 grid of surge (×1.0–×3.0) × primary-supplier capacity (1.0–0.0) on the M5 structure (backup 0.4, rural road ×2); 20 test seeds per cell; all five policies → `paper/tables/stress.md`, `paper/figures/stress-dworst-heatmap.svg`
- [ ] `paper/results/manifest.json` records 0 audit failures and the audited-run count per stage

## Review

- [ ] State the **failure region** (every policy's worst-region essential fill < 0.5) explicitly.
- [ ] List cells and scenarios where ERRRA is worse than a baseline on any primary metric, not only on the metric it targets. Check cumulative unmet, p95 waiting time and cost in particular.
- [ ] Compare against tuned-sQ as well as cost-only: a calibrated stockpiling baseline can beat ERRRA on total unmet and waiting.
- [ ] Check horizon-end unmet and censored waits. If they are positive, recovery is incomplete and recovery times and waits are lower bounds.
- [ ] Report the ablations with null effects (CI including 0) as null, not as support.
- [ ] Confirm the LHS "worse" count in `paper/tables/sensitivity.md`.
- [ ] State that stress results hold only within the predefined simulation scenarios (在预定义仿真场景中).
