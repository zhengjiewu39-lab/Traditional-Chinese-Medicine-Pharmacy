# Global sensitivity (Latin hypercube, N = 256, base S10-surge-supply-road, sensitivity seeds 500001, 500002, 500003, 500004, 500005)

Importance = Spearman rank correlation between each factor and the outcome across LHS samples (|ρ| ranks importance; sign gives direction).

| Factor | Range | ρ Δworst | ρ Δunmet | ρ Δcost | ρ ERRRA worst |
| --- | --- | --- | --- | --- | --- |
| Supply factor during disruption | 0.2–1 | -0.51 | 0.14 | -0.40 | 0.31 |
| Demand surge magnitude | 1–2.2 | 0.48 | -0.18 | 0.46 | -0.67 |
| Dispatch/truck capacity multiplier | 0.6–1.4 | -0.17 | 0.18 | -0.05 | -0.01 |
| Disruption duration (days) | 10–45 | 0.15 | 0.21 | 0.31 | -0.21 |
| Demand volatility scale | 0.5–1.5 | 0.14 | 0.01 | 0.04 | 0.04 |
| Lead-time extension (rural, suburban) | 1–2.5 | 0.10 | -0.18 | 0.03 | -0.04 |
| Rural road delay factor | 1–2.5 | 0.09 | -0.02 | 0.10 | -0.38 |
| Upstream inbound coverage | 1–1.4 | -0.07 | -0.15 | -0.24 | 0.19 |
| Warehouse initial stock (days) | 5–30 | -0.04 | -0.21 | -0.28 | 0.22 |
| Rural vulnerability weight | 1–2 | 0.00 | 0.07 | 0.07 | -0.06 |

## Where ERRRA does better or worse than cost-first (worst-region essential fill, tolerance ±0.01)

Better: 144/256; worse: 0/256; tie: 112/256. ERRRA absolute failure (worst-region essential fill < 0.5): 40/256.

No LHS sample met "ERRRA worse than cost-first on worst-region essential fill".

ERRRA has more unmet essential demand than cost-first in 41/256 samples. Best single split for "ERRRA more unmet essential demand than cost-first": **Supply factor during disruption ≤ 0.49** → rate 34% (n=92); above → 6% (n=164).

Best single split for "ERRRA worst-region fill < 0.5": **Supply factor during disruption ≤ 0.49** → rate 34% (n=92); above → 5% (n=164).

### Mean Δ worst-region essential fill by factor quintile (Q1 = lowest values)

| Factor | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | --- | --- | --- | --- | --- |
| Demand surge magnitude | 0.025 | 0.061 | 0.078 | 0.085 | 0.101 |
| Supply factor during disruption | 0.120 | 0.103 | 0.073 | 0.030 | 0.026 |
| Rural road delay factor | 0.055 | 0.071 | 0.071 | 0.075 | 0.079 |
| Lead-time extension (rural, suburban) | 0.052 | 0.072 | 0.081 | 0.061 | 0.084 |
| Disruption duration (days) | 0.040 | 0.075 | 0.080 | 0.072 | 0.084 |
| Dispatch/truck capacity multiplier | 0.098 | 0.083 | 0.059 | 0.061 | 0.050 |
| Upstream inbound coverage | 0.072 | 0.081 | 0.083 | 0.058 | 0.057 |
| Warehouse initial stock (days) | 0.073 | 0.082 | 0.056 | 0.076 | 0.065 |
| Rural vulnerability weight | 0.061 | 0.079 | 0.065 | 0.080 | 0.067 |
| Demand volatility scale | 0.057 | 0.081 | 0.061 | 0.087 | 0.065 |
