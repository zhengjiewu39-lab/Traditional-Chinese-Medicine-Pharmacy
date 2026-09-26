# Community Pharmacy Access and Supply Resilience Simulator

**中文：** 社区药房药品可及性与供应韧性仿真平台  

**Research positioning:** Simulation-based study of **equitable medicine access** and **supply resilience** in **community pharmacy networks** under **synthetic public-health disturbances** (demand surges, supply interruptions, delivery constraints).

**Working title:** *Simulation-based optimisation of equitable medicine access and supply resilience in community pharmacy networks during public health disruptions.*

> **Synthetic simulation research platform.** No real patient, prescription, pharmacy transaction, or clinical outcome data. Not for clinical decision-making, dispensing, or real-world resource allocation.

Legacy ERP / prescription CDSS / CRM features remain as **Legacy Demo** under `/legacy/*` only.

## Research question

When demand surges, supply breaks, or delivery is constrained in **simulated** scenarios, can inventory–distribution policies reduce essential-medicine stockouts, shorten **simulated** access delays, and narrow urban–suburban–rural service gaps?

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
npm run simulation:demo       # four policies, synthetic 14-day run
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

- `fixed-allocation` — fixed allocation baseline  
- `reorder-point` — (s, Q) baseline  
- `cost-first` — cost-first heuristic  
- `equity-aware` — multi-objective penalty heuristic (cost + stockout + wait + inequity)

## Documentation

- [methodology.md](docs/methodology.md) · [assumptions.md](docs/assumptions.md) · [reproducibility.md](docs/reproducibility.md) · [limitations.md](docs/limitations.md) · [legacy-cdss.md](docs/legacy-cdss.md) · [paper-outline.md](docs/paper-outline.md)

## Troubleshooting

If simulation API returns 404, restart the backend: `npm run restart:server`. Frontend should use `REACT_APP_API_BASE_URL=http://localhost:3002/api` (see `.env.development`).
