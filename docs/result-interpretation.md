# Result interpretation (engine v4, matrix v2.0.0)

All numbers come from `paper/tables/*.md` (100 common-random-number test seeds; paired bootstrap 95% CIs). They describe computational experiments under synthetic scenario assumptions (合成场景假设). They hold only within the predefined simulation scenarios (在预定义仿真场景中) and cannot be read as effects of real policies.

## 1. How to read the tables

- **A difference counts only when its paired 95% CI excludes 0** (marked *). With 100 seeds, even differences that are tiny in practice (for example 0.001 in fill rate) can be significant. Always check the size of the effect as well.
- **No multiplicity correction** is applied across the 9 scenarios × 10 pairs × 15 metrics. Treat isolated significant results with care.
- **Direction:** every metric has a stated better direction. A positive Δ is an improvement only for "higher better" metrics.
- **Recovery times** are censored at 60 days. A value of 60 means "did not recover", not "recovered on day 60".
- **Waiting times** include censored waits for units still backordered at the horizon, so they are lower bounds when horizon-end unmet > 0. That is the case only for fixed-allocation in M5 and in the harder scenarios.
- **Same-day unfilled ≠ never served.** `cumulativeUnmetDemand` counts units not available on the day demanded. Most of them are filled later (late-filled); horizon-end unmet is the part never served within the horizon.

## 2. What the results show

**ERRRA versus cost-only.** In every disrupted scenario (M2–M9), ERRRA has a higher worst-region essential fill and a smaller regional gap:

| Scenario | Worst-region essential fill gain | Relative extra cost (PoE) |
|---|---|---|
| M2 | +0.14 pp [0.11, 0.17] | 0.36% |
| M3 | +8.0 pp [7.8, 8.2] | 2.15% |
| M4 | +0.46 pp [0.38, 0.54] | 0.24% |
| M5 | +11.4 pp [10.9, 11.8] | 1.80% [1.70, 1.89] |
| M6 | +10.0 pp [9.7, 10.4] | 3.59% |
| M7 | +10.0 pp [9.3, 10.6] | 4.72% |
| M8 | +0.79 pp [0.66, 0.93] | 0.32% |
| M9 | +15.8 pp [15.5, 16.1] | 3.01% |

The gain is large in M3, M5, M6, M7 and M9. It is negligible in M2, M4 and M8, where cost-only already reaches ≈ 0.96–0.99.

This comes at a price:

- The p95 waiting time is longer in M2, M5, M6 and M9 (M5: +3.1 days).
- Cumulative unmet demand is higher in M2 (+1,142) and M7 (+530).
- The regional floor diverts stock to the worst region, while the other regions wait longer.

**ERRRA versus tuned-sQ.** tuned-sQ is calibrated per scenario. In M3 and M5–M9 the calibration picks high safety factors (best uniform z = 7–50), i.e. it stockpiles.

- **M2–M7:** tuned-sQ beats ERRRA on worst-region essential fill (M5: 0.974 vs 0.962), cumulative unmet, waiting times and recovery.
  - In M2 and M4 its extra cost over cost-only is small: PoE 2.4% and 0.5%.
  - In M3 and M5–M7 its extra cost is large: PoE 13–30%, against ERRRA's 1.8–4.7%.
- **M8 and M9 (capacity-limited):** tuned-sQ's worst-region essential fill (0.37 and 0.27) falls far below ERRRA's (0.97 and 0.63), and it is 37–39% more expensive than cost-only. With binding truck capacity, its large batch orders are rationed proportionally, and nothing in the rule protects the worst-served region.

In M3 and M5–M7, tuned-sQ's advantage comes from buying much more stock, not from allocating it differently. It is still Pareto-efficient in M1–M7, so a decision-maker who accepts its cost would prefer it there.

**Weighted-equity versus ERRRA.** In M5, weighted-equity closes part of the gap at no significant extra cost: +5.0 pp worst-region, PoE 0.01% [−0.08, 0.11]. It also has lower cumulative unmet demand than ERRRA in M2–M7, and a shorter p95 wait in M2, M3 and M5–M7. It fails badly under tight transport (M8: −13 pp vs cost-only) and does not protect the worst region in M9. ERRRA's hard floor is what keeps the worst region up when capacity is binding.

**Pareto sets.** ERRRA and weighted-equity are Pareto-efficient in every scenario. tuned-sQ is efficient in M1–M7, and cost-only in every scenario except M3 and M6. Fixed-allocation is never efficient. A "best" policy exists only relative to how cost, worst-region service and total unmet demand are weighted.

## 3. Mechanisms (ablation, ablated − full ERRRA)

- **Supplier redundancy** dominates everything in scenarios with a primary outage: −0.48 to −0.51 in worst-region fill in M3 and M5. This is a network mechanism available to every policy in the main comparison, so it is **not** evidence for ERRRA's allocation rule.
- **Essential-medicine priority, rolling-horizon adaptation and compound awareness** each contribute 5–10 pp of worst-region fill in M5, with CIs excluding 0. Without essential priority, the M2 cost rises by 39k: stage 1 then orders for all SKUs.
- **Service floor:** removing it costs 0.8 pp of worst-region fill in M5 and lowers cost. The effect is small because stage 2's gap bound still equalizes.
- **Vulnerability tilt** (β = 0.05) has no measurable effect in M2, M3, M4 and M8, and ≤ 0.1 pp elsewhere. It is a tie-breaker, not a driver, and should be reported as a null result.
- **Lateral transfers:** ≤ 0.5 pp of worst-region fill and a small cost saving when switched off. With the default transfer costs and anti-cycling rules they are a minor mechanism.

## 4. Sensitivity and failure regions

- **LHS + PRCC** (N = 256, on M5): the ERRRA − cost-only worst-region gain increases with surge magnitude (PRCC 0.69), disruption duration (0.44) and transport capacity (0.20). It decreases with warehouse stock (−0.46). ERRRA's floor φ within 0.8–1.0, the rural vulnerability weight and the transfer cost have no significant PRCC. The gain was worse than cost-only (beyond ±0.01) in **0 / 256** samples and a tie in 124 / 256.
- **Stress grid:** ERRRA has the best worst-region fill once the surge is ≥ ×2. Below that, tuned-sQ is best. **Failure region** (every policy's worst-region fill < 0.5): surge ×3 with primary supply ≤ 0.7; surge ≥ ×2.5 with primary supply ≤ 0.3; surge ≥ ×2 with primary supply 0. No allocation rule compensates for missing supply there.
- **Convergence:** the M5 and M9 ERRRA − cost-only differences keep their sign and significance from n = 10 to n = 100. The CI half-width shrinks roughly as 1/√n.

## 5. What cannot be concluded

- Nothing about real pharmacies, suppliers, patients or policies.
- That ERRRA is optimal: stage 1 is exact only for one shared capacity (86–91% exact with two warehouses), and stage 2 is greedy.
- That equity comes for free: it costs waiting-time tails, sometimes total unmet demand, and 0.2–4.7% extra cost.
- That ERRRA dominates a stockpiling baseline: calibrated tuned-sQ has the higher worst-region essential fill in six of nine scenarios (M2–M7), at a much higher cost in four of them.
