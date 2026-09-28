# Simulation run checklist (reproducible paper results)

1. **Environment**
   - [ ] Node ≥ 20, `npm ci` (lockfile unchanged)
   - [ ] `npm run lint`, `npm run simulation:test` pass
2. **Frozen inputs**
   - [ ] `paper/config/scenario-matrix.json` and `paper/config/seeds.json` unchanged (compare SHA-256 with `paper/results/manifest.json`)
   - [ ] Never regenerate the matrix to "fix" results; any change needs a new `matrixVersion` with a recorded reason
3. **Run**
   - [ ] `npm run paper:all` (≈ 6 min on one core; deterministic)
   - [ ] Outputs: `paper/results/**` (CSV/JSON), `paper/tables/*.md`, `paper/figures/*.svg`, `paper/results/manifest.json`
   - [ ] Manifest: 0 audit failures; audited-run count per stage
4. **Checks before writing**
   - [ ] Calibration table: note scenarios where the tuned-sQ optimum is still at the grid edge (M7)
   - [ ] Main table: all 9 scenarios (M1–M9) × 5 policies × 100 seeds present
   - [ ] Paired table: report CI and higher/lower counts; do not report means alone; there is no multiplicity correction
   - [ ] Price of Equity: report the "worst region loss", "gain not significant" and "gain at lower cost" cases as they are
   - [ ] Ablation, sensitivity (LHS + PRCC), stress, CI-stability and cross-model tables produced
   - [ ] CI stability: conclusions keep their sign from n = 10 to n = 100
5. **Reporting**
   - [ ] Say "synthetic" and "在预定义仿真场景中" wherever results are stated
   - [ ] Call ERRRA an allocation heuristic and weighted-equity a weighted heuristic; never "AI", "optimal" or "optimizer"
   - [ ] Include limitations (`docs/limitations.md`, `MODEL_CARD.md`)
