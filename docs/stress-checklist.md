# Stress-test checklist

Use before claiming any result about behaviour under disruption. All scenarios are synthetic.

## Automated (must pass)

- [ ] `npm run simulation:test` — includes the extreme-condition and conservation tests:
  - [ ] zero demand → no stockouts or backlog (all 10 policy variants)
  - [ ] unlimited stock and capacity → fill ≥ 99.9%
  - [ ] zero dispatch and truck capacity → nothing ships and no shipment costs
  - [ ] complete supply cut → no shipments during the cut
  - [ ] daily conservation identities in S10, S12, S14 for all policies and ablations
- [ ] `npm run paper:all` stress stage — 5 × 5 grid of surge (×1.0–×3.0) × supply factor (1.0–0.1) on the S10 structure, 20 test seeds per cell, all five policies → `paper/tables/stress.md`, `paper/figures/stress-dworst-heatmap.svg`

## Review

- [ ] Identify the **failure region** (every policy has worst-region essential fill < 0.5) and state it explicitly.
- [ ] Identify cells where ERRRA is worse than cost-first on any headline metric (worst-region fill, unmet essential, cost), not only on the metric it targets.
- [ ] Check S12 (5-day warehouse stock, no upstream headroom) and S14 (extreme compound): the gap falls but unmet essential demand rises — report both.
- [ ] Check backlog at horizon: if it is positive, recovery is incomplete and recovery times are censored.
- [ ] Confirm LHS "worse" and "absolute failure" splits in `paper/tables/sensitivity.md`.
- [ ] State that stress results hold only 在预定义仿真场景中.
