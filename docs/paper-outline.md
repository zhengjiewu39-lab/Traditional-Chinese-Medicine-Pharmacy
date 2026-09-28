# Paper outline (working title)

**Equitable access to essential medicines and supply resilience in community pharmacy networks under compound public-health disruptions: a synthetic simulation comparison of allocation heuristics.**

## 1. Introduction

- Research question: in a synthetic warehouse–pharmacy network facing demand surges, supplier outages and transport delays, how much worst-region essential-medicine service does an equity-constrained allocation heuristic protect? What does that cost relative to cost-driven and practice-style replenishment, and where does it fail?
- Scope: a computational experiment on synthetic networks. No patient, pharmacy or supplier data; no claim about real policy effects.

## 2. Model

The model is specified in [model-specification.md](model-specification.md):

- suppliers (primary and backup) → warehouses (base-stock, capacity in standard units) → pharmacies (FIFO backorders)
- dispatch and truck caps
- lateral emergency transfers
- mandatory stock audit
- scenario events: demand surge, supplier disruption, road disruption, lead-time extension

## 3. Policies

Five policies: fixed-allocation, tuned-sQ (calibrated per SKU × region type on separate seeds), cost-only, weighted-equity, and **ERRRA, a two-stage allocation heuristic** (max–min essential service floor, then cost-aware additions under a regional gap bound). It is described as a heuristic, not as an optimization model or an optimal method.

## 4. Experimental design

[experiment-protocol.md](experiment-protocol.md): frozen matrix M1–M9, 120 days (30 + 30 + 60), 100 common-random-number test seeds, paired bootstrap CIs, Price of Equity, ablations, LHS + PRCC sensitivity, stress grid and CI stability.

## 5. Results

Report from `paper/tables/*.md` only:

- main table (M5) and scenario matrix
- paired differences for ERRRA against each baseline
- Price of Equity and Pareto set
- ablations, including null effects
- sensitivity and stress failure regions

## 6. Discussion

- Trade-offs in silico: worst-region essential fill and regional gap versus total unmet demand, waiting-time tail and cost.
- Where tuned-sQ stockpiling or weighted-equity is better, and why.
- Mechanism contributions (supplier redundancy, transfers) versus allocation-rule contributions.

## 7. Limitations

[limitations.md](limitations.md): synthetic data only, no face validation yet, capacity in standard units, censoring, no multiplicity correction.

## 8. Data and code availability

Repository, `npm run paper:all`, `npm run research:reproduce`, and the manifest hashes.
