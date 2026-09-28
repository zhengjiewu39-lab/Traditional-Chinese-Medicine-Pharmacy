# Global sensitivity (LHS + PRCC, N = 256, base M5-compound, sensitivity seeds 500001, 500002, 500003, 500004, 500005)

PRCC = partial rank correlation between a factor and the outcome, controlling for the other seven factors; * = p < 0.05 (t approximation). The floor φ affects ERRRA only; the other factors change the shared scenario.

| Factor | Range | PRCC Δworst | PRCC Δunmet | PRCC Δcost | PRCC ERRRA worst |
| --- | --- | --- | --- | --- | --- |
| Demand surge magnitude | 1–2.2 | 0.69* | -0.20* | 0.61* | -0.84* |
| Disruption duration (days) | 10–45 | 0.44* | 0.00 | 0.57* | -0.45* |
| Warehouse initial stock (days) | 4–20 | -0.43* | -0.07 | -0.69* | 0.63* |
| Transport capacity (× baseline demand) | 1–2 | 0.16* | 0.08 | 0.46* | -0.17* |
| Primary supplier lead time (days) | 1–6 | 0.09 | 0.17* | 0.31* | -0.30* |
| Rural vulnerability weight | 1–3 | 0.06 | -0.03 | 0.07 | 0.00 |
| Lateral transfer cost per unit | 0–3 | 0.05 | 0.01 | -0.03 | 0.00 |
| ERRRA minimum service floor φ | 0.8–1 | 0.00 | 0.05 | 0.04 | -0.03 |

ERRRA − cost-only on worst-region essential fill (tolerance ±0.01): better in 133/256 samples, worse in 0/256, tie in 123/256.
