# Paper outline (working title)

**Simulation-based optimisation of equitable medicine access and supply resilience in community pharmacy networks during public health disruptions.**

## Introduction

- Research question: under synthetic demand surges, supply interruptions, and delivery constraints, do coordinated inventory–distribution strategies reduce essential stockouts, access delays, and urban–rural service gaps?
- Scope: simulation platform, synthetic networks, no real patient data.

## Methods

- Scenario generator (seeded RNG, regions, drug priorities, events) — see `docs/methodology.md`.
- Daily simulation engine (inventory, distribution, policies).
- Four strategies: `fixed-allocation`, `reorder-point`, `cost-first`, `equity-aware`.
- Objective (equity-aware scoring):  
  `totalCost + stockoutPenalty + waitingTimePenalty + inequityPenalty`
- Metrics: stockouts by priority, regional coverage, inequality index, recovery time.
- Statistics: ≥30 replicates, mean, SD, 95% CI; seeds logged.

## Results

- Report simulation outputs only (tables/figures from Experiment Archive exports).

## Discussion

- Interpret trade-offs between cost and equity in silico.

## Limitations

- See `docs/limitations.md`.

## Data and code availability

- Open-source scenario JSON, experiment records, `npm run research:reproduce`.
