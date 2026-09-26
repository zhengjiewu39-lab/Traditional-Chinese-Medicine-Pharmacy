# Community pharmacy supply resilience simulation platform

**Research positioning:** A reproducible **simulation** platform for studying inventory–distribution policies in **community pharmacy networks** under public-health-style disturbances (demand surges, supply interruptions, delivery constraints).

**Not** a production pharmacy ERP, **not** clinical decision support, **not** validated on real patient or transaction data.

> **Disclaimer:** This platform uses **synthetic data** for simulation research only. It does not provide clinical advice and must not be used for real-world dispensing or patient care.

## Research question

Under simulated disturbances, can coordinated inventory and distribution policies reduce **synthetic** essential-medicine stockouts, shorten **simulated** access delays, and improve **regional equity** of service coverage — compared to baselines?

## Primary UI (6 pages)

| Page | Route |
|------|--------|
| Overview | `/simulation/overview` |
| Scenario Configuration | `/simulation/scenario` |
| Strategy Comparison | `/simulation/strategies` |
| Simulation Run | `/simulation/run` |
| Results | `/simulation/results` |
| Reproducibility | `/simulation/reproducibility` |

Legacy demo modules (prescription CDSS, CRM, patients, etc.) remain under `/legacy/*` — see `docs/refactor-mapping.md`.

## Quick start

```bash
cd chinese-medicine-pharmacy
npm install
npm run dev          # API :3002 + React :3000
# or
npm run server       # API only
npm start            # frontend only
```

Demo login (development): `admin` / `admin123`

### Troubleshooting 404 on simulation pages

1. Run commands **inside** `chinese-medicine-pharmacy` (not the parent folder only).
2. Restart API so `/api/health` lists `supply-simulation-v1`: `npm run restart:server`
3. Ensure `.env.development` sets `REACT_APP_API_BASE_URL=http://localhost:3002/api` (committed in repo).
4. Do **not** add `"proxy"` to `package.json` — it breaks `react-scripts start` on some Node versions.
5. Smoke test: `npm run verify:simulation`

## Backend architecture

| Module | Path |
|--------|------|
| Scenario schema & default emergency scenario | `server/simulation/scenarioSchema.js` |
| Seeded RNG | `server/simulation/rng.js` |
| Scenario generator | `server/simulation/scenarioGenerator.js` |
| Inventory | `server/simulation/inventoryEngine.js` |
| Distribution | `server/simulation/distributionEngine.js` |
| Policies | `server/simulation/policyEngine.js` |
| Simulation runner | `server/simulation/simulationEngine.js` |
| Metrics & equity | `server/simulation/metricsEngine.js` |
| Experiment store | `server/simulation/experimentRepository.js` |
| Export | `server/simulation/exportService.js` |
| REST API | `server/routes/simulation.js` |

API prefix: `/api/simulation/*`

## Policies (explicit algorithm names)

- `fixed-allocation-v1` — fixed allocation baseline  
- `reorder-point-v1` — (s, Q) reorder point  
- `cost-first-v1` — cost-first heuristic  
- `equity-aware-v1` — multi-objective with stockout, wait, and inequity penalties  

## Tests & reproducibility

```bash
npm run test:server    # includes simulation determinism & metrics tests
npm run build
```

Same scenario JSON + `randomSeed` → identical key metrics (see `server/simulation/__tests__/simulation.test.js`).

Methodology: [`docs/methodology.md`](docs/methodology.md)  
Refactor mapping: [`docs/refactor-mapping.md`](docs/refactor-mapping.md)

## Limitations

- Simplified daily time step; no individual patient agents.
- Costs and demands are synthetic, not econometrically calibrated.
- Legacy modules may still display old marketing copy; they are not part of the research workflow.

---

## Legacy stack (preserved, not deleted)

The repository retains the original React + Express TCM chain pharmacy demo (prescription review, billing, patients, etc.) under `/legacy/*` routes and original API routes. That code is **legacy demo only** and uses **synthetic/demo** datasets where applicable.

For prescription CDSS benchmarks and `npm run evaluate`, see historical sections in git history or `benchmarks/` — separate from the supply simulation study.
