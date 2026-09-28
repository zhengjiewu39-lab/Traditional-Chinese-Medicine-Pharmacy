# Main results (synthetic scenarios; frozen matrix; test seeds)

All values from 100 common-random-number test seeds per cell. Paired differences use a percentile bootstrap over seeds (2000 resamples, fixed bootstrap seed 20240901). **Primary inference** (pre-registered): scenario M5-compound, ERRRA vs Cost-only, outcome worstRegionEssentialFillRate; * marks a 95% CI excluding 0. All other policy × scenario × metric cells are **exploratory**; † marks Holm-adjusted p ≤ 0.05 among exploratory pairs only. Minimum important difference for worst-region essential fill: 1 pp. Recovery: sustained 7-day smoothed essential fill at p·baseline starting only after shock end; null if censored; restricted recovery time uses the horizon cap for censored runs (not “recovered on day 60”). Results describe synthetic scenario assumptions (合成场景假设) only.

## Default scenario M5-compound: mean (SD) [95% CI]

| Metric | Fixed allocation | Tuned (s,Q) | Cost-only | Weighted-equity heuristic | ERRRA |
| --- | --- | --- | --- | --- | --- |
| Overall fill (higher better; fraction [0,1]) | 0.564 (0.012) [0.561, 0.566] | 0.982 (0.012) [0.979, 0.984] | 0.794 (0.015) [0.791, 0.797] | 0.841 (0.021) [0.836, 0.845] | 0.822 (0.013) [0.819, 0.825] |
| Essential fill (higher better; fraction [0,1]) | 0.569 (0.014) [0.567, 0.572] | 0.983 (0.015) [0.980, 0.986] | 0.892 (0.018) [0.888, 0.895] | 0.931 (0.020) [0.927, 0.935] | 0.990 (0.011) [0.988, 0.992] |
| Worst-region essential fill (higher better; fraction [0,1]) | 0.528 (0.019) [0.524, 0.531] | 0.975 (0.021) [0.971, 0.979] | 0.847 (0.026) [0.842, 0.853] | 0.899 (0.020) [0.895, 0.903] | 0.962 (0.014) [0.959, 0.965] |
| Regional service gap (lower better; fraction [0,1]) | 0.152 (0.022) [0.148, 0.156] | 0.025 (0.021) [0.021, 0.029] | 0.152 (0.026) [0.147, 0.158] | 0.047 (0.012) [0.045, 0.049] | 0.034 (0.012) [0.032, 0.036] |
| Cumulative unmet demand (lower better; units) | 32,342 (900) [32,164, 32,521] | 1,351 (907) [1,171, 1,531] | 15,243 (1,133) [15,018, 15,468] | 11,817 (1,586) [11,502, 12,131] | 13,191 (972) [12,998, 13,383] |
| Backlog area (lower better; unit·days) | 224,840 (17,979) [221,272, 228,407] | 2,974 (2,556) [2,467, 3,481] | 106,374 (14,855) [103,426, 109,321] | 58,476 (9,066) [56,677, 60,275] | 124,694 (14,665) [121,785, 127,604] |
| Stockout incident rate (lower better; fraction of demand lines) | 0.393 (0.011) [0.391, 0.395] | 0.012 (0.007) [0.011, 0.013] | 0.123 (0.008) [0.121, 0.125] | 0.205 (0.019) [0.201, 0.208] | 0.120 (0.008) [0.119, 0.122] |
| Horizon-end unmet rate (lower better; fraction of demand) | 0.0177 (0.0038) [0.0169, 0.0184] | 0.0000 (0.0000) [0.0000, 0.0000] | 0.0000 (0.0001) [0.0000, 0.0000] | 0.0000 (0.0000) [0.0000, 0.0000] | 0.0000 (0.0000) [0.0000, 0.0000] |
| Mean waiting time (lower better; days) | 3.03 (0.24) [2.99, 3.08] | 0.04 (0.03) [0.03, 0.05] | 1.44 (0.20) [1.40, 1.48] | 0.79 (0.12) [0.76, 0.81] | 1.68 (0.20) [1.64, 1.72] |
| P95 waiting time (lower better; days) | 12.5 (0.9) [12.3, 12.7] | 0.0 (0.2) [0.0, 0.1] | 9.8 (1.2) [9.6, 10.0] | 5.4 (0.9) [5.2, 5.6] | 13.0 (1.3) [12.7, 13.2] |
| Recovery time 95% (observed) (lower better; days after shock end; null if censored) | n/a | 8.9 (5.1) [7.9, 10.0] | 18.5 (1.7) [18.2, 18.8] | 16.1 (2.3) [15.6, 16.5] | 4.9 (5.1) [3.9, 5.9] |
| Restricted recovery time 95% (lower better; days after shock end; horizon cap if censored) | 60.0 (0.0) [60.0, 60.0] | 8.9 (5.1) [7.9, 10.0] | 18.5 (1.7) [18.2, 18.8] | 16.1 (2.3) [15.6, 16.5] | 4.9 (5.1) [3.9, 5.9] |
| Service-loss AUC (lower better; fill-rate·days) | 50.06 (1.82) [49.70, 50.42] | 2.04 (1.76) [1.69, 2.39] | 11.95 (1.95) [11.56, 12.34] | 7.67 (2.14) [7.25, 8.10] | 1.10 (1.36) [0.83, 1.37] |
| Total cost (lower better; synthetic currency) | 367,172 (1,189) [366,936, 367,408] | 369,559 (4,546) [368,657, 370,461] | 323,194 (1,269) [322,943, 323,446] | 323,079 (1,222) [322,836, 323,322] | 329,059 (1,681) [328,725, 329,393] |

## Scenario matrix (mean ± 95% CI half-width)

| Scenario | Policy | Worst-region essential fill | Regional service gap | Cumulative unmet demand | P95 waiting time | Restricted recovery time 95% | Total cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1-normal | Fixed allocation | 0.995 ± 0.000 | 0.005 ± 0.000 | 35 ± 1 | 0.0 ± 0.0 | n/a | 340,813 ± 119 |
| M1-normal | Tuned (s,Q) | 0.997 ± 0.000 | 0.003 ± 0.000 | 15 ± 1 | 0.0 ± 0.0 | n/a | 278,040 ± 177 |
| M1-normal | Cost-only | 0.999 ± 0.000 | 0.001 ± 0.000 | 832 ± 19 | 0.0 ± 0.0 | n/a | 279,735 ± 240 |
| M1-normal | Weighted-equity heuristic | 0.999 ± 0.000 | 0.001 ± 0.000 | 642 ± 17 | 0.0 ± 0.0 | n/a | 280,539 ± 256 |
| M1-normal | ERRRA | 0.999 ± 0.000 | 0.001 ± 0.000 | 775 ± 22 | 0.0 ± 0.0 | n/a | 280,310 ± 223 |
| M2-demand-surge | Fixed allocation | 0.598 ± 0.003 | 0.153 ± 0.004 | 28,951 ± 154 | 8.7 ± 0.1 | 59.1 ± 0.5 | 371,185 ± 156 |
| M2-demand-surge | Tuned (s,Q) | 0.998 ± 0.000 | 0.002 ± 0.000 | 22 ± 2 | 0.0 ± 0.0 | 0.0 ± 0.0 | 325,964 ± 492 |
| M2-demand-surge | Cost-only | 0.994 ± 0.001 | 0.006 ± 0.001 | 7,091 ± 101 | 6.7 ± 0.2 | 0.0 ± 0.0 | 317,809 ± 255 |
| M2-demand-surge | Weighted-equity heuristic | 0.973 ± 0.002 | 0.027 ± 0.002 | 5,168 ± 121 | 2.0 ± 0.1 | 0.0 ± 0.0 | 317,071 ± 253 |
| M2-demand-surge | ERRRA | 0.995 ± 0.001 | 0.005 ± 0.001 | 8,223 ± 92 | 10.6 ± 0.3 | 0.0 ± 0.0 | 318,801 ± 246 |
| M3-supply-disruption | Fixed allocation | 0.592 ± 0.004 | 0.249 ± 0.004 | 23,557 ± 181 | 9.1 ± 0.1 | 60.0 ± 0.0 | 334,767 ± 293 |
| M3-supply-disruption | Tuned (s,Q) | 0.988 ± 0.003 | 0.012 ± 0.003 | 619 ± 73 | 0.0 ± 0.0 | 2.3 ± 1.2 | 325,465 ± 661 |
| M3-supply-disruption | Cost-only | 0.852 ± 0.004 | 0.147 ± 0.004 | 8,282 ± 194 | 5.5 ± 0.2 | 22.3 ± 0.5 | 287,584 ± 222 |
| M3-supply-disruption | Weighted-equity heuristic | 0.905 ± 0.004 | 0.027 ± 0.002 | 6,234 ± 226 | 2.4 ± 0.1 | 26.5 ± 0.4 | 287,084 ± 265 |
| M3-supply-disruption | ERRRA | 0.934 ± 0.004 | 0.054 ± 0.004 | 7,335 ± 225 | 4.3 ± 0.2 | 14.5 ± 0.4 | 293,390 ± 293 |
| M4-transport-disruption | Fixed allocation | 0.757 ± 0.001 | 0.243 ± 0.001 | 1,170 ± 4 | 0.0 ± 0.0 | 14.7 ± 0.1 | 340,567 ± 119 |
| M4-transport-disruption | Tuned (s,Q) | 0.997 ± 0.000 | 0.003 ± 0.000 | 44 ± 3 | 0.0 ± 0.0 | 0.0 ± 0.0 | 281,733 ± 245 |
| M4-transport-disruption | Cost-only | 0.979 ± 0.002 | 0.021 ± 0.002 | 967 ± 22 | 0.0 ± 0.0 | 0.0 ± 0.0 | 280,134 ± 241 |
| M4-transport-disruption | Weighted-equity heuristic | 0.976 ± 0.002 | 0.024 ± 0.002 | 806 ± 19 | 0.0 ± 0.0 | 0.0 ± 0.0 | 281,005 ± 285 |
| M4-transport-disruption | ERRRA | 0.983 ± 0.001 | 0.017 ± 0.001 | 927 ± 25 | 0.0 ± 0.0 | 0.0 ± 0.0 | 280,782 ± 239 |
| M5-compound | Fixed allocation | 0.528 ± 0.004 | 0.152 ± 0.004 | 32,342 ± 179 | 12.5 ± 0.2 | 60.0 ± 0.0 | 367,172 ± 236 |
| M5-compound | Tuned (s,Q) | 0.975 ± 0.004 | 0.025 ± 0.004 | 1,351 ± 180 | 0.0 ± 0.0 | 8.9 ± 1.0 | 369,559 ± 902 |
| M5-compound | Cost-only | 0.847 ± 0.005 | 0.152 ± 0.005 | 15,243 ± 225 | 9.8 ± 0.2 | 18.5 ± 0.3 | 323,194 ± 252 |
| M5-compound | Weighted-equity heuristic | 0.899 ± 0.004 | 0.047 ± 0.002 | 11,817 ± 315 | 5.4 ± 0.2 | 16.1 ± 0.5 | 323,079 ± 243 |
| M5-compound | ERRRA | 0.962 ± 0.003 | 0.034 ± 0.002 | 13,191 ± 193 | 13.0 ± 0.3 | 4.9 ± 1.0 | 329,059 ± 334 |
| M6-long-lead | Fixed allocation | 0.433 ± 0.004 | 0.227 ± 0.004 | 37,966 ± 204 | 18.7 ± 0.2 | 60.0 ± 0.0 | 354,819 ± 223 |
| M6-long-lead | Tuned (s,Q) | 0.805 ± 0.007 | 0.190 ± 0.007 | 13,378 ± 263 | 6.6 ± 0.2 | 28.5 ± 0.6 | 388,941 ± 656 |
| M6-long-lead | Cost-only | 0.618 ± 0.005 | 0.381 ± 0.005 | 23,346 ± 208 | 14.6 ± 0.2 | 34.6 ± 0.5 | 324,660 ± 240 |
| M6-long-lead | Weighted-equity heuristic | 0.704 ± 0.005 | 0.077 ± 0.006 | 21,718 ± 291 | 9.8 ± 0.3 | 35.9 ± 0.5 | 323,185 ± 222 |
| M6-long-lead | ERRRA | 0.723 ± 0.005 | 0.112 ± 0.007 | 22,860 ± 221 | 14.8 ± 0.2 | 28.9 ± 0.5 | 336,583 ± 295 |
| M7-tight-warehouse | Fixed allocation | 0.385 ± 0.004 | 0.269 ± 0.005 | 39,358 ± 208 | 20.1 ± 0.2 | 60.0 ± 0.0 | 348,856 ± 234 |
| M7-tight-warehouse | Tuned (s,Q) | 0.801 ± 0.007 | 0.199 ± 0.007 | 11,046 ± 257 | 6.1 ± 0.2 | 22.4 ± 0.6 | 407,745 ± 510 |
| M7-tight-warehouse | Cost-only | 0.542 ± 0.006 | 0.457 ± 0.006 | 26,033 ± 233 | 16.7 ± 0.2 | 38.2 ± 0.6 | 320,021 ± 250 |
| M7-tight-warehouse | Weighted-equity heuristic | 0.624 ± 0.005 | 0.069 ± 0.005 | 26,016 ± 263 | 12.4 ± 0.3 | 37.2 ± 0.5 | 317,724 ± 230 |
| M7-tight-warehouse | ERRRA | 0.641 ± 0.005 | 0.090 ± 0.007 | 26,502 ± 240 | 16.5 ± 0.2 | 32.8 ± 0.5 | 334,740 ± 289 |
| M8-tight-transport | Fixed allocation | 0.264 ± 0.001 | 0.362 ± 0.001 | 47,326 ± 53 | 31.8 ± 0.2 | 60.0 ± 0.0 | 321,365 ± 119 |
| M8-tight-transport | Tuned (s,Q) | 0.388 ± 0.008 | 0.612 ± 0.008 | 30,630 ± 218 | 10.4 ± 0.1 | 60.0 ± 0.0 | 409,903 ± 351 |
| M8-tight-transport | Cost-only | 0.959 ± 0.002 | 0.041 ± 0.002 | 20,139 ± 137 | 50.3 ± 0.4 | 0.2 ± 0.3 | 297,942 ± 156 |
| M8-tight-transport | Weighted-equity heuristic | 0.825 ± 0.005 | 0.170 ± 0.005 | 26,563 ± 149 | 22.5 ± 0.2 | 5.2 ± 1.2 | 291,742 ± 172 |
| M8-tight-transport | ERRRA | 0.965 ± 0.002 | 0.035 ± 0.002 | 20,090 ± 136 | 49.0 ± 0.4 | 0.0 ± 0.0 | 298,863 ± 180 |
| M9-extreme | Fixed allocation | 0.240 ± 0.000 | 0.243 ± 0.002 | 58,847 ± 51 | 47.6 ± 0.2 | 60.0 ± 0.0 | 324,324 ± 168 |
| M9-extreme | Tuned (s,Q) | 0.305 ± 0.002 | 0.694 ± 0.002 | 44,690 ± 77 | 35.4 ± 0.1 | 60.0 ± 0.0 | 429,546 ± 255 |
| M9-extreme | Cost-only | 0.476 ± 0.003 | 0.499 ± 0.003 | 43,268 ± 101 | 69.0 ± 0.2 | 33.8 ± 0.3 | 308,058 ± 201 |
| M9-extreme | Weighted-equity heuristic | 0.458 ± 0.005 | 0.064 ± 0.005 | 52,618 ± 129 | 47.8 ± 0.2 | 60.0 ± 0.0 | 295,825 ± 250 |
| M9-extreme | ERRRA | 0.634 ± 0.004 | 0.133 ± 0.010 | 43,385 ± 142 | 71.1 ± 0.2 | 32.4 ± 0.3 | 317,080 ± 197 |

## Paired differences (A − B, bootstrap 95% CI); all 10 policy pairs × 15 metrics are in results/main/paired-all-pairs.csv

### ERRRA − Cost-only

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | -57 [-75, -39]† | 0.0 [0.0, 0.0] | 575 [352, 801]† |
| M2-demand-surge | 0.001 [0.001, 0.002]† | -0.001 [-0.002, -0.001]† | 1,132 [1,059, 1,207]† | 3.9 [3.7, 4.1]† | 993 [755, 1,222]† |
| M3-supply-disruption | 0.081 [0.079, 0.084]† | -0.094 [-0.097, -0.090]† | -946 [-1,082, -812]† | -1.2 [-1.4, -1.0]† | 5,806 [5,509, 6,074]† |
| M4-transport-disruption | 0.003 [0.002, 0.004]† | -0.003 [-0.004, -0.002]† | -39 [-59, -21]† | 0.0 [0.0, 0.0] | 649 [365, 932]† |
| M5-compound | 0.115 [0.110, 0.120]* | -0.119 [-0.124, -0.113]† | -2,053 [-2,193, -1,916]† | 3.2 [2.9, 3.4]† | 5,865 [5,545, 6,161]† |
| M6-long-lead | 0.104 [0.100, 0.109]† | -0.268 [-0.276, -0.260]† | -486 [-642, -313]† | 0.1 [-0.1, 0.3] | 11,922 [11,656, 12,182]† |
| M7-tight-warehouse | 0.099 [0.094, 0.104]† | -0.367 [-0.376, -0.358]† | 469 [294, 629]† | -0.2 [-0.3, 0.0] | 14,719 [14,437, 14,992]† |
| M8-tight-transport | 0.006 [0.005, 0.007]† | -0.006 [-0.007, -0.005]† | -48 [-188, 96] | -1.3 [-1.7, -0.9]† | 921 [764, 1,076]† |
| M9-extreme | 0.158 [0.154, 0.161]† | -0.366 [-0.376, -0.356]† | 117 [6, 224] | 2.1 [1.9, 2.3]† | 9,022 [8,832, 9,209]† |

### ERRRA − Weighted-equity heuristic

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.001 [0.000, 0.001]† | -0.001 [-0.001, 0.000]† | 133 [113, 154]† | 0.0 [0.0, 0.0] | -229 [-504, 14] |
| M2-demand-surge | 0.023 [0.020, 0.025]† | -0.023 [-0.025, -0.020]† | 3,055 [2,937, 3,182]† | 8.6 [8.4, 8.9]† | 1,730 [1,480, 1,979]† |
| M3-supply-disruption | 0.029 [0.026, 0.032]† | 0.027 [0.023, 0.030]† | 1,101 [910, 1,304]† | 2.0 [1.8, 2.2]† | 6,306 [5,976, 6,647]† |
| M4-transport-disruption | 0.006 [0.005, 0.008]† | -0.006 [-0.008, -0.005]† | 121 [96, 146]† | 0.0 [0.0, 0.0] | -222 [-508, 49] |
| M5-compound | 0.063 [0.059, 0.067]† | -0.013 [-0.017, -0.010]† | 1,374 [1,118, 1,631]† | 7.6 [7.3, 7.9]† | 5,980 [5,631, 6,300]† |
| M6-long-lead | 0.019 [0.014, 0.023]† | 0.035 [0.027, 0.043]† | 1,143 [896, 1,377]† | 5.0 [4.7, 5.3]† | 13,397 [13,064, 13,711]† |
| M7-tight-warehouse | 0.017 [0.012, 0.022]† | 0.021 [0.013, 0.029]† | 486 [303, 666]† | 4.1 [3.9, 4.3]† | 17,016 [16,751, 17,303]† |
| M8-tight-transport | 0.140 [0.135, 0.145]† | -0.135 [-0.140, -0.130]† | -6,473 [-6,639, -6,304]† | 26.5 [26.1, 26.8]† | 7,121 [6,912, 7,337]† |
| M9-extreme | 0.176 [0.170, 0.181]† | 0.069 [0.058, 0.079]† | -9,233 [-9,358, -9,114]† | 23.2 [23.0, 23.5]† | 21,255 [21,002, 21,527]† |

### ERRRA − Tuned (s,Q)

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.002 [0.002, 0.003]† | -0.002 [-0.003, -0.002]† | 760 [739, 783]† | 0.0 [0.0, 0.0] | 2,270 [2,035, 2,506]† |
| M2-demand-surge | -0.002 [-0.003, -0.002]† | 0.002 [0.002, 0.003]† | 8,201 [8,112, 8,289]† | 10.6 [10.4, 10.9]† | -7,163 [-7,621, -6,701]† |
| M3-supply-disruption | -0.054 [-0.059, -0.050]† | 0.042 [0.037, 0.046]† | 6,717 [6,499, 6,922]† | 4.3 [4.1, 4.6]† | -32,075 [-32,747, -31,436]† |
| M4-transport-disruption | -0.014 [-0.016, -0.013]† | 0.014 [0.013, 0.016]† | 883 [859, 907]† | 0.0 [0.0, 0.0] | -951 [-1,241, -672]† |
| M5-compound | -0.013 [-0.017, -0.008]† | 0.009 [0.004, 0.014]† | 11,840 [11,647, 12,025]† | 12.9 [12.7, 13.2]† | -40,500 [-41,383, -39,609]† |
| M6-long-lead | -0.082 [-0.089, -0.074]† | -0.078 [-0.087, -0.068]† | 9,482 [9,215, 9,728]† | 8.2 [8.0, 8.3]† | -52,359 [-52,998, -51,745]† |
| M7-tight-warehouse | -0.159 [-0.166, -0.152]† | -0.110 [-0.119, -0.100]† | 15,456 [15,254, 15,658]† | 10.4 [10.2, 10.6]† | -73,005 [-73,445, -72,542]† |
| M8-tight-transport | 0.578 [0.569, 0.586]† | -0.578 [-0.586, -0.569]† | -10,539 [-10,759, -10,308]† | 38.6 [38.2, 39.0]† | -111,039 [-111,384, -110,681]† |
| M9-extreme | 0.329 [0.325, 0.332]† | -0.561 [-0.570, -0.551]† | -1,306 [-1,431, -1,184]† | 35.7 [35.5, 35.9]† | -112,466 [-112,720, -112,205]† |

### Weighted-equity heuristic − Cost-only

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | -0.001 [-0.001, 0.000]† | 0.001 [0.000, 0.001]† | -190 [-209, -172]† | 0.0 [0.0, 0.0] | 805 [550, 1,065]† |
| M2-demand-surge | -0.021 [-0.024, -0.019]† | 0.021 [0.019, 0.024]† | -1,923 [-2,045, -1,805]† | -4.7 [-4.9, -4.5]† | -737 [-980, -508]† |
| M3-supply-disruption | 0.053 [0.049, 0.056]† | -0.120 [-0.125, -0.116]† | -2,047 [-2,220, -1,882]† | -3.2 [-3.3, -3.0]† | -500 [-809, -193] |
| M4-transport-disruption | -0.003 [-0.004, -0.002]† | 0.003 [0.002, 0.004]† | -161 [-184, -139]† | 0.0 [0.0, 0.0] | 871 [594, 1,140]† |
| M5-compound | 0.052 [0.049, 0.055]† | -0.105 [-0.111, -0.100]† | -3,427 [-3,682, -3,192]† | -4.4 [-4.6, -4.2]† | -115 [-440, 185] |
| M6-long-lead | 0.086 [0.082, 0.090]† | -0.303 [-0.311, -0.295]† | -1,628 [-1,859, -1,385]† | -4.9 [-5.2, -4.6]† | -1,475 [-1,765, -1,176]† |
| M7-tight-warehouse | 0.082 [0.076, 0.088]† | -0.388 [-0.396, -0.380]† | -17 [-235, 179] | -4.3 [-4.5, -4.1]† | -2,297 [-2,503, -2,079]† |
| M8-tight-transport | -0.134 [-0.139, -0.129]† | 0.129 [0.124, 0.134]† | 6,424 [6,240, 6,623]† | -27.8 [-28.1, -27.4]† | -6,200 [-6,409, -5,996]† |
| M9-extreme | -0.018 [-0.024, -0.013]† | -0.435 [-0.441, -0.429]† | 9,350 [9,235, 9,468]† | -21.1 [-21.4, -20.9]† | -12,234 [-12,492, -11,973]† |

## Price of Equity relative to cost-only

PoE = mean over seeds of (C_policy − C_cost-only) / C_cost-only, bootstrap 95% CI. "Cost per pp" = Δ total cost per percentage point of worst-region essential fill gained over cost-only, computed only when both the gain and the extra cost have 95% CIs above 0; otherwise the reason is shown.

| Scenario | Policy | PoE [95% CI] | Δ worst-region ess. fill, pp [95% CI] | Cost per pp |
| --- | --- | --- | --- | --- |
| M1-normal | Fixed allocation | 21.84% [21.75, 21.93] | -0.48 [-0.51, -0.44] | worst region loss |
| M1-normal | Tuned (s,Q) | -0.60% [-0.69, -0.52] | -0.24 [-0.28, -0.20] | worst region loss |
| M1-normal | Weighted-equity heuristic | 0.29% [0.20, 0.38] | -0.06 [-0.08, -0.04] | worst region loss |
| M1-normal | ERRRA | 0.21% [0.13, 0.29] | 0.00 [0.00, 0.01] | gain not significant |
| M2-demand-surge | Fixed allocation | 16.80% [16.70, 16.89] | -39.57 [-39.84, -39.29] | worst region loss |
| M2-demand-surge | Tuned (s,Q) | 2.57% [2.43, 2.70] | 0.37 [0.31, 0.44] | gain below mid |
| M2-demand-surge | Weighted-equity heuristic | -0.23% [-0.31, -0.16] | -2.12 [-2.35, -1.89] | worst region loss |
| M2-demand-surge | ERRRA | 0.31% [0.24, 0.39] | 0.13 [0.10, 0.16] | gain below mid |
| M3-supply-disruption | Fixed allocation | 16.41% [16.29, 16.53] | -26.01 [-26.42, -25.61] | worst region loss |
| M3-supply-disruption | Tuned (s,Q) | 13.17% [12.96, 13.40] | 13.55 [13.07, 14.00] | 2,795 |
| M3-supply-disruption | Weighted-equity heuristic | -0.17% [-0.28, -0.07] | 5.27 [4.94, 5.59] | gain at lower cost |
| M3-supply-disruption | ERRRA | 2.02% [1.92, 2.11] | 8.12 [7.86, 8.39] | 715 |
| M4-transport-disruption | Fixed allocation | 21.57% [21.48, 21.66] | -22.23 [-22.43, -22.02] | worst region loss |
| M4-transport-disruption | Tuned (s,Q) | 0.57% [0.48, 0.67] | 1.75 [1.59, 1.91] | 913 |
| M4-transport-disruption | Weighted-equity heuristic | 0.31% [0.21, 0.41] | -0.29 [-0.42, -0.16] | worst region loss |
| M4-transport-disruption | ERRRA | 0.23% [0.13, 0.33] | 0.33 [0.25, 0.42] | gain below mid |
| M5-compound | Fixed allocation | 13.61% [13.49, 13.72] | -31.98 [-32.37, -31.57] | worst region loss |
| M5-compound | Tuned (s,Q) | 14.35% [14.07, 14.62] | 12.77 [12.27, 13.25] | 3,632 |
| M5-compound | Weighted-equity heuristic | -0.03% [-0.13, 0.06] | 5.17 [4.86, 5.51] | extra cost not significant |
| M5-compound | ERRRA | 1.82% [1.72, 1.91] | 11.49 [11.00, 11.98] | 511 |
| M6-long-lead | Fixed allocation | 9.29% [9.19, 9.39] | -18.52 [-19.01, -18.03] | worst region loss |
| M6-long-lead | Tuned (s,Q) | 19.80% [19.61, 20.00] | 18.65 [17.91, 19.36] | 3,447 |
| M6-long-lead | Weighted-equity heuristic | -0.45% [-0.54, -0.36] | 8.58 [8.16, 9.00] | gain at lower cost |
| M6-long-lead | ERRRA | 3.67% [3.59, 3.75] | 10.43 [10.05, 10.89] | 1,143 |
| M7-tight-warehouse | Fixed allocation | 9.01% [8.90, 9.12] | -15.74 [-16.30, -15.14] | worst region loss |
| M7-tight-warehouse | Tuned (s,Q) | 27.41% [27.25, 27.56] | 25.83 [25.09, 26.62] | 3,397 |
| M7-tight-warehouse | Weighted-equity heuristic | -0.72% [-0.78, -0.65] | 8.21 [7.58, 8.84] | gain at lower cost |
| M7-tight-warehouse | ERRRA | 4.60% [4.51, 4.69] | 9.89 [9.42, 10.45] | 1,488 |
| M8-tight-transport | Fixed allocation | 7.86% [7.80, 7.93] | -69.52 [-69.77, -69.29] | worst region loss |
| M8-tight-transport | Tuned (s,Q) | 37.58% [37.44, 37.72] | -57.17 [-58.00, -56.36] | worst region loss |
| M8-tight-transport | Weighted-equity heuristic | -2.08% [-2.15, -2.01] | -13.40 [-13.93, -12.87] | worst region loss |
| M8-tight-transport | ERRRA | 0.31% [0.26, 0.36] | 0.60 [0.47, 0.74] | gain below mid |
| M9-extreme | Fixed allocation | 5.28% [5.21, 5.35] | -23.60 [-23.86, -23.35] | worst region loss |
| M9-extreme | Tuned (s,Q) | 39.44% [39.34, 39.54] | -17.13 [-17.43, -16.83] | worst region loss |
| M9-extreme | Weighted-equity heuristic | -3.97% [-4.05, -3.89] | -1.83 [-2.36, -1.27] | worst region loss |
| M9-extreme | ERRRA | 2.93% [2.87, 2.99] | 15.77 [15.45, 16.08] | 572 |

## Pareto-efficient policies (cost ↓, worst-region essential fill ↑, cumulative unmet ↓)

| Scenario | Efficient policies |
| --- | --- |
| M1-normal | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M2-demand-surge | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M3-supply-disruption | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M4-transport-disruption | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M5-compound | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M6-long-lead | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M7-tight-warehouse | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M8-tight-transport | Cost-only, Weighted-equity heuristic, ERRRA |
| M9-extreme | Cost-only, Weighted-equity heuristic, ERRRA |
