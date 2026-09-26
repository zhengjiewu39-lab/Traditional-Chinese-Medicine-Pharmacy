# 面向复合公共卫生扰动的社区药房基本药品公平可及性与供应韧性仿真

*Equitable access to essential medicines and supply resilience in community pharmacy networks under compound public-health disruptions — a synthetic simulation study.*

> **Disclaimer.** All data are **synthetic**. The repository contains no real patient, prescription, pharmacy or epidemic data, and results cannot be used to infer real policy effects. All conclusions hold only 在预定义仿真场景中 (in the predefined simulation scenarios). This is not a clinical, dispensing or resource-allocation tool.

**Research question.** Under compound disruptions (demand surge + upstream supply cut + rural road delay + longer lead times), how much worst-region essential-medicine service can a capacity-aware allocation rule protect compared with cost-driven and practice-style replenishment? What does that cost, and where does it fail?

**Method.**
- **Model:** a daily discrete-event model of warehouses and community pharmacies across urban, suburban and rural regions. Replenishment uses the inventory position (on hand + on order − backlog). Backorders, dispatch and truck caps, and upstream inbound are modelled explicitly, with conservation checked every day.
- **Policies compared:**
  - fixed allocation
  - tuned (s,Q)
  - cost-first net-benefit
  - an equity-weighted heuristic
  - **ERRRA** (Equity-constrained Resilient Rolling-horizon Allocation), a two-stage heuristic: a max–min essential service floor, then cost-aware additions under a regional gap bound. It uses no future demand and is not AI.
- **Experiments:**
  - frozen 14-scenario matrix (30 + 30 + 60 days); 100 common-random-number test seeds, disjoint from the calibration seeds
  - ablation, LHS sensitivity (N = 256) and a 5 × 5 stress grid
  - cross-check against exhaustive enumeration

**Reproduce.**

```bash
cd chinese-medicine-pharmacy
npm ci
npm run simulation:test   # unit, hand-calculated, extreme, conservation, cross-model tests
npm run paper:all         # all tables and figures → paper/tables, paper/figures (about 6–8 min)
npm run paper:quick       # fast smoke run (used in CI)
```

Main outputs:
- `paper/tables/main.md`, `ablation.md`, `sensitivity.md`, `stress.md`, `ci-stability.md`, `cross-model.md`, `calibration.md`, `scenarios.md`, `parameters.md`
- `paper/figures/*.svg`

See also [algorithm](docs/algorithm.md), [metrics](docs/metrics.md), [validation report](docs/validation-report.md), [model card](MODEL_CARD.md) and [limitations](docs/limitations.md).

---

**English name:** Community Pharmacy Access and Supply Resilience Simulator (社区药房药品可及性与供应韧性仿真平台).

The legacy ERP, prescription CDSS and CRM features are frozen at tag `legacy-cdss-v1`. They are lazy-loaded under `/legacy/*` only and are not part of the research.

## Default navigation

| Page | Route |
|------|--------|
| Overview | `/simulation/overview` |
| Scenario Configuration | `/simulation/scenario` |
| Strategies | `/simulation/strategies` |
| Run Simulation | `/simulation/run` |
| Results | `/simulation/results` |
| Experiment Archive | `/simulation/archive` |
| Reproducibility | `/simulation/reproducibility` |
| Documentation | `/simulation/documentation` |
| Legacy Demo | `/legacy/dashboard` |

## Quick start

```bash
cd chinese-medicine-pharmacy
npm install
npm run dev          # API :3002 + React :3000
```

Demo login: `admin` / `admin123`

## Research commands

```bash
npm run simulation:demo       # all five policies, synthetic 14-day run
npm run lint                  # ESLint, zero warnings allowed
npm run simulation:test       # server + simulation unit tests
npm run research:reproduce    # default scenario, 30 replicates, equity-aware
npm run simulation:export     # export latest experiment JSON/CSV
npm run verify:simulation     # API smoke test
```

Legacy prescription ablation (not for supply-resilience papers):

```bash
npm run evaluate:ablation
```

## Policies (algorithm names)

- `fixed-allocation`: periodic order-up-to on prior demand (practice-style baseline)
- `reorder-point`: (s, Q), tuned per scenario on calibration seeds
- `cost-first`: newsvendor (s, S); orders only lines with positive net benefit
- `equity-aware`: weighted heuristic using the regional deficit signal
- `equity-constrained-rolling-horizon`: **ERRRA heuristic** (see [algorithm.md](docs/algorithm.md))

## Documentation

- [methodology.md](docs/methodology.md) · [algorithm.md](docs/algorithm.md) · [metrics.md](docs/metrics.md) · [model-validation.md](docs/model-validation.md) · [validation-report.md](docs/validation-report.md)
- [assumptions.md](docs/assumptions.md) · [reproducibility.md](docs/reproducibility.md) · [limitations.md](docs/limitations.md) · [simulate-checklist.md](docs/simulate-checklist.md) · [stress-checklist.md](docs/stress-checklist.md) · [vite-evaluation.md](docs/vite-evaluation.md)
- [MODEL_CARD.md](MODEL_CARD.md) · [CHANGELOG.md](CHANGELOG.md) · [CITATION.cff](CITATION.cff) · [legacy-cdss.md](docs/legacy-cdss.md) · [paper-outline.md](docs/paper-outline.md)

## Troubleshooting

If simulation API returns 404, restart the backend: `npm run restart:server`. Frontend should use `REACT_APP_API_BASE_URL=http://localhost:3002/api` (see `.env.development`).
