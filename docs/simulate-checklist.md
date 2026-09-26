# Simulation run checklist (reproducible paper results)

1. **Environment**
   - [ ] Node ≥ 20, `npm ci` (lockfile unchanged)
   - [ ] `npm run lint`, `npm run simulation:test` pass
2. **Frozen inputs**
   - [ ] `paper/config/scenario-matrix.json` and `paper/config/seeds.json` unchanged (compare SHA-256 with `paper/results/manifest.json`)
   - [ ] Never regenerate the matrix to "fix" results; any change needs a new `matrixVersion` with a recorded reason
3. **Run**
   - [ ] `npm run paper:all` (≈ 6–8 min on one core; deterministic)
   - [ ] Outputs: `paper/results/**` (CSV/JSON), `paper/tables/*.md`, `paper/figures/*.svg`, `paper/results/manifest.json`
4. **Checks before writing**
   - [ ] Calibration table: note scenarios where the reorder-point optimum is at the grid edge
   - [ ] Main table: all 14 scenarios × 5 policies × 100 seeds present
   - [ ] Paired table: report CI and win/loss counts; do not report means alone
   - [ ] Price of Equity: report "no_gap_reduction" and "dominant" cases as they are
   - [ ] Ablation, sensitivity, stress, CI-stability, cross-model tables produced
   - [ ] CI stability: conclusions keep sign for n ≥ 30
5. **Reporting**
   - [ ] Say "synthetic" and "在预定义仿真场景中" wherever results are stated
   - [ ] Call ERRRA a heuristic; call equity-aware a weighted heuristic; never "AI" or "optimal"
   - [ ] Include limitations (`docs/limitations.md`, `MODEL_CARD.md`)
