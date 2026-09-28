# Policies and the ERRRA allocation heuristic (engine v4)

The complete model, including every formula used by the policies, is in [model-specification.md](model-specification.md) (§8 selection gate, §9 policies, §10 tuned-sQ calibration). This page gives the ERRRA pseudo-code. All inputs are synthetic.

## ERRRA — Equity-constrained Resilient Rolling-horizon Allocation

ERRRA is a deterministic, rule-based two-stage **allocation heuristic**, re-planned every day with information up to the current day only. It is not an optimizer, not proven optimal, and not AI.

| Parameter | Default (fixed a priori) |
|---|---|
| service floor \(\varphi\) | 0.95 |
| regional gap bound \(\delta\) | 0.10 |
| vulnerability tilt \(\beta\) | 0.05 |
| projection \(z_p\) | 1.0 |
| batch fraction | 0.1 |
| disruption buffer | 2 days |
| surge detection ratio | 1.15 |

```text
ERRRA(t):
  lines ← build_lines(state_t, EWMA forecasts_t (prior if no rolling horizon),
                      observed supply-side factors if compound-aware else neutral)
  for each line l: a_l ← onHand + onOrder;  n_l ← μτ + z_p στ + backlog
  cap_w ← min(dispatchCap_w, truckCap_w);  stock_wk ← warehouse onHand
  # Stage 1: water-filling max–min on essential lines, up to the floor
  while ∃ region r with SR_r < φ and a feasible essential line:
      r* ← argmin_r [min(SR_r, φ) − β(v_r − 1)]      (ties → higher v_r)
      l* ← argmin_{l∈E_r*, room>0} min(a_l+x_l, n_l)/n_l   (ties → lower pharmacy index)
      Δ  ← min(room(l*), ⌈batch·n_l*⌉, units to reach φ)
      x_l* += Δ; cap, stock −= Δ
      score(l*) ← 1 + (1 − SR_r* at first allocation)            ∈ (1, 2]
  # Stage 2: cost-aware additions, tier order, gap constraint
  for c in sort(lines, by tier (essential, chronic-care, routine), then net per unit desc):
      if net(c) ≤ 0: log(c, 'negative_net_benefit'); continue
      q ← min(target_(s,S)(c) − x_c, cap_w, stock_wk)
      if c is essential, region(c) is not the worst, and the worst can still improve:
          q ← min(q, units keeping SR_region(c) ≤ SR_worst + δ)
      x_c += q;  score(c) ← (3 − tier + npu/(1+|npu|))/4                ∈ (0.25, 1)
  emit orders with priorityScore, priorityReason and diagnostics
```

Because stage-1 scores exceed every stage-2 score, the shared ranking and tie-break rule preserves the lexicographic order: the floor comes first, efficiency second.

**Ablation flags** (each removes one component):

| Flag | Effect when false |
|---|---|
| `useServiceFloor` | \(\varphi = 0\) (stage 1 skipped) |
| `useVulnerability` | \(\beta = 0\) |
| `useRollingHorizon` | static prior forecast |
| `useEssentialPriority` | one tier; stage 1 on all SKUs |
| `useCompoundAwareness` | neutral lead and supply factors, no buffer, no surge detection |
| `useLateralTransfers` | no lateral transfers in that run |
| `useSupplierRedundancy` | warehouses use only the primary supplier in that run |

**Exactness.** Stage 1 matches exhaustive enumeration exactly for a single shared capacity with unit steps. With several warehouse capacities it is near-optimal but not exact (`paper/tables/cross-model.md`). Stage 2 is greedy and has no optimality guarantee.
