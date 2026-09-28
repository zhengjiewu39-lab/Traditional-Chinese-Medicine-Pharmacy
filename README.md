# 面向复合公共卫生扰动的社区药房基本药品公平可及性与供应韧性仿真

*Equitable access to essential medicines and supply resilience in community pharmacy networks under compound public-health disruptions — a synthetic simulation study.*

> **Disclaimer.** All data are **synthetic**. The repository contains no real patient, prescription, pharmacy or epidemic data, and results cannot be used to infer real policy effects. All conclusions hold only 在预定义仿真场景中 (in the predefined simulation scenarios). This is not a clinical, dispensing or resource-allocation tool.

**Research question.** Under compound disruptions (demand surge + upstream supply cut + rural road delay + longer lead times), how much worst-region essential-medicine service can a capacity-aware allocation rule protect compared with cost-driven and practice-style replenishment? What does that cost, and where does it fail?

**Method.**
- **Model** (engine v4, [model-specification](docs/model-specification.md)): a daily model of suppliers (primary and backup) → regional warehouses → community pharmacies in urban, suburban and rural regions.
  - Replenishment uses the inventory position (on hand + on order − backlog), with FIFO backorders and waiting times.
  - Supplier disruptions act on suppliers only. Warehouse capacity is in standard units; dispatch and truck caps and lateral emergency transfers are modelled.
  - A mandatory stock-balance audit runs at the end of every run.
- **Policies compared:**
  - fixed-allocation
  - tuned-sQ, calibrated per SKU × region type on separate seeds
  - cost-only
  - weighted-equity
  - **ERRRA** (Equity-constrained Resilient Rolling-horizon Allocation), a two-stage allocation heuristic: a max–min essential service floor, then cost-aware additions under a regional gap bound. It uses no future demand, is not AI, and is not an optimizer.
- **Experiments** ([protocol](docs/experiment-protocol.md)):
  - frozen nine-scenario matrix M1–M9, 120 days (30 + 30 + 60)
  - 100 common-random-number test seeds; paired bootstrap 95% CIs for every policy pair
  - Price of Equity; 7 ablations; LHS + PRCC sensitivity (N = 256); 5 × 5 stress grid
  - cross-check against exhaustive enumeration

**Main finding (synthetic, [interpretation](docs/result-interpretation.md)).** In the compound scenario M5, ERRRA raises worst-region essential fill over cost-only by 11.4 pp [10.9, 11.8] at 1.8% extra cost. It also has a longer p95 wait. A calibrated stockpiling (s,Q) baseline reaches higher worst-region fill in M2–M7, at up to 30% extra cost, but collapses under tight transport (M8, M9). No policy avoids the failure region of very large surges combined with deep supply loss.

**Reproduce.**

```bash
cd chinese-medicine-pharmacy
npm ci
npm run simulation:test   # unit, hand-calculated, extreme, conservation, cross-model tests
npm run paper:all         # all tables and figures → paper/tables, paper/figures (about 6 min, 29,500 audited runs)
npm run paper:quick       # fast smoke run (used in CI)
```

Main outputs:
- `paper/tables/main.md`, `ablation.md`, `sensitivity.md`, `stress.md`, `ci-stability.md`, `cross-model.md`, `calibration.md`, `scenarios.md`, `parameters.md`
- `paper/figures/*.svg`

See also [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md), [model specification](docs/model-specification.md), [metrics](docs/metrics.md), [verification and validation](docs/verification-validation.md), [model card](MODEL_CARD.md) and [limitations](docs/limitations.md).

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
npm run simulation:demo       # all five policies on the default scenario
npm run lint                  # ESLint, zero warnings allowed
npm run simulation:test       # server + simulation tests (141)
npm run research:reproduce    # five policies × 30 replicates, stored, re-run, exact match required
npm run simulation:export     # export latest experiment JSON/CSV
npm run verify:simulation     # API smoke test
```

Legacy prescription ablation (not for supply-resilience papers):

```bash
npm run evaluate:ablation
```

## Policies (algorithm names)

| Name | Id | Rule |
|---|---|---|
| fixed-allocation | `fixed-allocation` | periodic order-up-to on prior demand (practice-style baseline) |
| tuned-sQ | `reorder-point` (alias `tuned-sQ`) | (s, Q), z and qScale per SKU × region type, calibrated on calibration seeds |
| cost-only | `cost-first` (alias `cost-only`) | newsvendor (s, S); orders only lines with positive expected net benefit |
| weighted-equity | `equity-aware` (alias `weighted-equity`) | weighted score with a multiplicative regional need term |
| ERRRA | `equity-constrained-rolling-horizon` (alias `ERRRA`) | two-stage allocation heuristic ([algorithm.md](docs/algorithm.md)) |

## Documentation

- [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md) · [model-specification.md](docs/model-specification.md) · [verification-validation.md](docs/verification-validation.md) · [experiment-protocol.md](docs/experiment-protocol.md) · [result-interpretation.md](docs/result-interpretation.md) · [data-dictionary.md](docs/data-dictionary.md)
- [methodology.md](docs/methodology.md) · [algorithm.md](docs/algorithm.md) · [metrics.md](docs/metrics.md) · [assumptions.md](docs/assumptions.md) · [reproducibility.md](docs/reproducibility.md) · [limitations.md](docs/limitations.md) · [stress-checklist.md](docs/stress-checklist.md) · [simulate-checklist.md](docs/simulate-checklist.md) · [vite-evaluation.md](docs/vite-evaluation.md)
- Parameter table: `paper/tables/parameters.md`; scenario table: `paper/tables/scenarios.md`
- [MODEL_CARD.md](MODEL_CARD.md) · [CHANGELOG.md](CHANGELOG.md) · [CITATION.cff](CITATION.cff) · [legacy-cdss.md](docs/legacy-cdss.md) · [paper-outline.md](docs/paper-outline.md) · v3 reports: `docs/archive/v3/`

## Troubleshooting

If simulation API returns 404, restart the backend: `npm run restart:server`. Frontend should use `REACT_APP_API_BASE_URL=http://localhost:3002/api` (see `.env.development`).
