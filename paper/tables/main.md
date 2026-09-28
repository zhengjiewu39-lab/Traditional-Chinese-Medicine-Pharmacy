# Main results (synthetic scenarios; frozen matrix; test seeds)

All values from 100 common-random-number test seeds per cell. Paired differences use a percentile bootstrap over seeds (2000 resamples, fixed bootstrap seed 20240901); * marks a 95% CI excluding 0. Recovery times are right-censored at the horizon. Results describe computational experiments under synthetic scenario assumptions (合成场景假设) and cannot be read as effects of real policies.

## Default scenario M5-compound: mean (SD) [95% CI]

| Metric | Fixed allocation | Tuned (s,Q) | Cost-only | Weighted-equity heuristic | ERRRA |
| --- | --- | --- | --- | --- | --- |
| Overall fill (higher better; fraction [0,1]) | 0.563 (0.012) [0.561, 0.565] | 0.981 (0.010) [0.979, 0.983] | 0.795 (0.014) [0.792, 0.797] | 0.843 (0.021) [0.839, 0.847] | 0.822 (0.012) [0.820, 0.825] |
| Essential fill (higher better; fraction [0,1]) | 0.569 (0.015) [0.566, 0.572] | 0.982 (0.014) [0.979, 0.985] | 0.892 (0.018) [0.889, 0.896] | 0.930 (0.018) [0.927, 0.934] | 0.990 (0.012) [0.988, 0.992] |
| Worst-region essential fill (higher better; fraction [0,1]) | 0.527 (0.019) [0.523, 0.531] | 0.974 (0.020) [0.970, 0.978] | 0.848 (0.026) [0.843, 0.854] | 0.899 (0.018) [0.895, 0.902] | 0.962 (0.015) [0.959, 0.965] |
| Regional service gap (lower better; fraction [0,1]) | 0.150 (0.022) [0.146, 0.155] | 0.026 (0.020) [0.022, 0.030] | 0.151 (0.026) [0.146, 0.157] | 0.047 (0.013) [0.044, 0.049] | 0.034 (0.013) [0.031, 0.037] |
| Cumulative unmet demand (lower better; units) | 32,419 (970) [32,226, 32,611] | 1,393 (780) [1,238, 1,548] | 15,244 (1,041) [15,037, 15,451] | 11,678 (1,537) [11,373, 11,983] | 13,198 (923) [13,014, 13,381] |
| Backlog area (lower better; unit·days) | 225,140 (17,818) [221,605, 228,676] | 2,932 (2,045) [2,526, 3,338] | 106,375 (12,849) [103,826, 108,925] | 57,689 (8,762) [55,951, 59,428] | 124,447 (12,655) [121,936, 126,958] |
| Stockout incident rate (lower better; fraction of demand lines) | 0.393 (0.010) [0.391, 0.395] | 0.013 (0.006) [0.011, 0.014] | 0.123 (0.007) [0.121, 0.124] | 0.203 (0.016) [0.199, 0.206] | 0.120 (0.007) [0.119, 0.122] |
| Horizon-end unmet rate (lower better; fraction of demand) | 0.0178 (0.0039) [0.0170, 0.0185] | 0.0000 (0.0000) [0.0000, 0.0000] | 0.0000 (0.0000) [0.0000, 0.0000] | 0.0000 (0.0000) [0.0000, 0.0000] | 0.0000 (0.0000) [0.0000, 0.0000] |
| Mean waiting time (lower better; days) | 3.03 (0.24) [2.99, 3.08] | 0.04 (0.03) [0.03, 0.04] | 1.43 (0.17) [1.40, 1.47] | 0.78 (0.12) [0.75, 0.80] | 1.68 (0.17) [1.64, 1.71] |
| P95 waiting time (lower better; days) | 12.4 (0.9) [12.2, 12.6] | 0.0 (0.1) [0.0, 0.0] | 9.8 (1.0) [9.6, 10.0] | 5.3 (0.9) [5.1, 5.5] | 12.9 (1.2) [12.7, 13.2] |
| Recovery time 90% (lower better; days after shock end (censored)) | 60.0 (0.0) [60.0, 60.0] | 7.9 (4.7) [7.0, 8.8] | 17.3 (1.7) [16.9, 17.6] | 14.2 (1.6) [13.9, 14.5] | 2.8 (4.3) [1.9, 3.6] |
| Recovery time 95% (lower better; days after shock end (censored)) | 60.0 (0.0) [60.0, 60.0] | 9.6 (4.4) [8.7, 10.5] | 18.5 (1.8) [18.1, 18.8] | 15.9 (1.6) [15.6, 16.2] | 4.8 (5.0) [3.8, 5.8] |
| Recovery time 99% (lower better; days after shock end (censored)) | 60.0 (0.0) [60.0, 60.0] | 11.2 (4.7) [10.2, 12.1] | 20.6 (1.9) [20.2, 20.9] | 19.5 (4.3) [18.6, 20.4] | 7.6 (5.9) [6.4, 8.7] |
| Service-loss AUC (lower better; fill-rate·days) | 50.16 (1.86) [49.79, 50.53] | 2.15 (1.66) [1.82, 2.48] | 11.89 (1.95) [11.51, 12.28] | 7.75 (1.92) [7.37, 8.13] | 1.12 (1.38) [0.84, 1.39] |
| Total cost (lower better; synthetic currency) | 367,501 (2,797) [366,946, 368,056] | 370,978 (5,377) [369,911, 372,045] | 323,563 (2,690) [323,029, 324,097] | 323,602 (3,109) [322,985, 324,219] | 329,369 (2,931) [328,787, 329,951] |

## Scenario matrix (mean ± 95% CI half-width)

| Scenario | Policy | Worst-region essential fill | Regional service gap | Cumulative unmet demand | P95 waiting time | Recovery time 95% | Total cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1-normal | Fixed allocation | 0.994 ± 0.000 | 0.006 ± 0.000 | 36 ± 1 | 0.0 ± 0.0 | n/a | 341,154 ± 470 |
| M1-normal | Tuned (s,Q) | 0.997 ± 0.000 | 0.003 ± 0.000 | 14 ± 1 | 0.0 ± 0.0 | n/a | 278,337 ± 497 |
| M1-normal | Cost-only | 0.999 ± 0.000 | 0.001 ± 0.000 | 837 ± 20 | 0.0 ± 0.0 | n/a | 280,006 ± 532 |
| M1-normal | Weighted-equity heuristic | 0.999 ± 0.000 | 0.001 ± 0.000 | 636 ± 15 | 0.0 ± 0.0 | n/a | 280,821 ± 526 |
| M1-normal | ERRRA | 0.999 ± 0.000 | 0.001 ± 0.000 | 777 ± 22 | 0.0 ± 0.0 | n/a | 280,668 ± 492 |
| M2-demand-surge | Fixed allocation | 0.597 ± 0.003 | 0.158 ± 0.005 | 29,010 ± 190 | 8.7 ± 0.1 | 57.5 ± 0.5 | 371,493 ± 515 |
| M2-demand-surge | Tuned (s,Q) | 0.998 ± 0.000 | 0.002 ± 0.000 | 19 ± 1 | 0.0 ± 0.0 | 0.0 ± 0.0 | 325,813 ± 644 |
| M2-demand-surge | Cost-only | 0.994 ± 0.001 | 0.006 ± 0.001 | 7,092 ± 95 | 6.7 ± 0.2 | 0.0 ± 0.0 | 318,129 ± 570 |
| M2-demand-surge | Weighted-equity heuristic | 0.974 ± 0.002 | 0.026 ± 0.002 | 5,086 ± 122 | 2.0 ± 0.1 | 0.0 ± 0.0 | 317,459 ± 602 |
| M2-demand-surge | ERRRA | 0.995 ± 0.001 | 0.005 ± 0.001 | 8,234 ± 78 | 10.6 ± 0.2 | 0.0 ± 0.0 | 319,263 ± 607 |
| M3-supply-disruption | Fixed allocation | 0.593 ± 0.005 | 0.251 ± 0.004 | 23,588 ± 198 | 9.1 ± 0.1 | 59.8 ± 0.1 | 335,051 ± 525 |
| M3-supply-disruption | Tuned (s,Q) | 0.997 ± 0.001 | 0.003 ± 0.001 | 494 ± 65 | 0.0 ± 0.0 | 1.2 ± 0.7 | 326,305 ± 890 |
| M3-supply-disruption | Cost-only | 0.852 ± 0.004 | 0.148 ± 0.004 | 8,238 ± 175 | 5.5 ± 0.2 | 22.4 ± 0.4 | 287,898 ± 514 |
| M3-supply-disruption | Weighted-equity heuristic | 0.905 ± 0.003 | 0.027 ± 0.003 | 6,126 ± 199 | 2.2 ± 0.1 | 24.0 ± 0.8 | 287,497 ± 525 |
| M3-supply-disruption | ERRRA | 0.932 ± 0.004 | 0.054 ± 0.003 | 7,383 ± 198 | 4.3 ± 0.2 | 14.7 ± 0.4 | 294,090 ± 539 |
| M4-transport-disruption | Fixed allocation | 0.758 ± 0.002 | 0.242 ± 0.002 | 1,169 ± 6 | 0.0 ± 0.0 | 14.6 ± 0.2 | 340,907 ± 470 |
| M4-transport-disruption | Tuned (s,Q) | 0.998 ± 0.000 | 0.002 ± 0.000 | 52 ± 4 | 0.0 ± 0.0 | 0.0 ± 0.0 | 281,810 ± 472 |
| M4-transport-disruption | Cost-only | 0.978 ± 0.002 | 0.022 ± 0.002 | 975 ± 22 | 0.0 ± 0.0 | 0.0 ± 0.0 | 280,540 ± 494 |
| M4-transport-disruption | Weighted-equity heuristic | 0.976 ± 0.002 | 0.024 ± 0.002 | 794 ± 18 | 0.0 ± 0.0 | 0.0 ± 0.0 | 281,073 ± 508 |
| M4-transport-disruption | ERRRA | 0.983 ± 0.002 | 0.017 ± 0.002 | 917 ± 23 | 0.0 ± 0.0 | 0.0 ± 0.0 | 281,218 ± 511 |
| M5-compound | Fixed allocation | 0.527 ± 0.004 | 0.150 ± 0.004 | 32,419 ± 192 | 12.4 ± 0.2 | 60.0 ± 0.0 | 367,501 ± 555 |
| M5-compound | Tuned (s,Q) | 0.974 ± 0.004 | 0.026 ± 0.004 | 1,393 ± 155 | 0.0 ± 0.0 | 9.6 ± 0.9 | 370,978 ± 1,067 |
| M5-compound | Cost-only | 0.848 ± 0.005 | 0.151 ± 0.005 | 15,244 ± 207 | 9.8 ± 0.2 | 18.5 ± 0.3 | 323,563 ± 534 |
| M5-compound | Weighted-equity heuristic | 0.899 ± 0.004 | 0.047 ± 0.002 | 11,678 ± 305 | 5.3 ± 0.2 | 15.9 ± 0.3 | 323,602 ± 617 |
| M5-compound | ERRRA | 0.962 ± 0.003 | 0.034 ± 0.003 | 13,198 ± 183 | 12.9 ± 0.2 | 4.8 ± 1.0 | 329,369 ± 582 |
| M6-long-lead | Fixed allocation | 0.433 ± 0.003 | 0.227 ± 0.004 | 38,034 ± 210 | 18.8 ± 0.2 | 60.0 ± 0.0 | 355,127 ± 517 |
| M6-long-lead | Tuned (s,Q) | 0.811 ± 0.008 | 0.179 ± 0.008 | 13,119 ± 306 | 6.9 ± 0.2 | 27.8 ± 0.6 | 388,779 ± 847 |
| M6-long-lead | Cost-only | 0.622 ± 0.005 | 0.377 ± 0.005 | 23,241 ± 203 | 14.6 ± 0.2 | 34.1 ± 0.5 | 325,158 ± 564 |
| M6-long-lead | Weighted-equity heuristic | 0.704 ± 0.005 | 0.072 ± 0.005 | 21,831 ± 279 | 9.7 ± 0.3 | 35.3 ± 0.5 | 323,647 ± 587 |
| M6-long-lead | ERRRA | 0.722 ± 0.005 | 0.115 ± 0.007 | 22,861 ± 236 | 14.8 ± 0.2 | 28.8 ± 0.5 | 336,823 ± 583 |
| M7-tight-warehouse | Fixed allocation | 0.385 ± 0.004 | 0.269 ± 0.004 | 39,422 ± 217 | 20.1 ± 0.2 | 60.0 ± 0.0 | 349,167 ± 508 |
| M7-tight-warehouse | Tuned (s,Q) | 0.807 ± 0.007 | 0.193 ± 0.007 | 10,577 ± 250 | 5.7 ± 0.2 | 22.4 ± 0.7 | 415,689 ± 692 |
| M7-tight-warehouse | Cost-only | 0.541 ± 0.005 | 0.458 ± 0.005 | 25,985 ± 228 | 16.6 ± 0.2 | 38.3 ± 0.6 | 320,252 ± 567 |
| M7-tight-warehouse | Weighted-equity heuristic | 0.624 ± 0.006 | 0.066 ± 0.005 | 26,027 ± 309 | 12.4 ± 0.3 | 37.4 ± 0.5 | 318,075 ± 519 |
| M7-tight-warehouse | ERRRA | 0.641 ± 0.006 | 0.094 ± 0.007 | 26,515 ± 268 | 16.4 ± 0.2 | 32.6 ± 0.5 | 335,360 ± 577 |
| M8-tight-transport | Fixed allocation | 0.264 ± 0.001 | 0.362 ± 0.001 | 47,398 ± 120 | 31.8 ± 0.2 | 60.0 ± 0.0 | 321,596 ± 390 |
| M8-tight-transport | Tuned (s,Q) | 0.365 ± 0.006 | 0.632 ± 0.006 | 27,849 ± 243 | 11.9 ± 0.2 | 60.0 ± 0.0 | 413,695 ± 567 |
| M8-tight-transport | Cost-only | 0.957 ± 0.003 | 0.043 ± 0.003 | 20,257 ± 137 | 49.7 ± 0.4 | 0.1 ± 0.2 | 298,276 ± 536 |
| M8-tight-transport | Weighted-equity heuristic | 0.825 ± 0.004 | 0.171 ± 0.004 | 26,469 ± 125 | 22.5 ± 0.2 | 38.2 ± 4.1 | 292,174 ± 558 |
| M8-tight-transport | ERRRA | 0.965 ± 0.003 | 0.035 ± 0.003 | 20,153 ± 141 | 48.5 ± 0.4 | 0.0 ± 0.0 | 299,229 ± 542 |
| M9-extreme | Fixed allocation | 0.240 ± 0.001 | 0.242 ± 0.002 | 58,935 ± 129 | 47.6 ± 0.2 | 60.0 ± 0.0 | 324,598 ± 415 |
| M9-extreme | Tuned (s,Q) | 0.266 ± 0.001 | 0.722 ± 0.002 | 43,922 ± 115 | 35.0 ± 0.2 | 60.0 ± 0.0 | 422,389 ± 504 |
| M9-extreme | Cost-only | 0.473 ± 0.003 | 0.501 ± 0.004 | 43,372 ± 131 | 69.2 ± 0.2 | 33.9 ± 0.3 | 308,354 ± 537 |
| M9-extreme | Weighted-equity heuristic | 0.457 ± 0.005 | 0.064 ± 0.005 | 52,702 ± 180 | 47.9 ± 0.2 | 60.0 ± 0.0 | 296,334 ± 537 |
| M9-extreme | ERRRA | 0.631 ± 0.003 | 0.135 ± 0.011 | 43,426 ± 164 | 71.0 ± 0.2 | 32.4 ± 0.3 | 317,639 ± 557 |

## Paired differences (A − B, bootstrap 95% CI); all 10 policy pairs × 15 metrics are in results/main/paired-all-pairs.csv

### ERRRA − Cost-only

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | -59 [-79, -41]* | 0.0 [0.0, 0.0] | 662 [360, 950]* |
| M2-demand-surge | 0.001 [0.001, 0.002]* | -0.001 [-0.002, -0.001]* | 1,142 [1,061, 1,228]* | 3.9 [3.7, 4.2]* | 1,135 [880, 1,413]* |
| M3-supply-disruption | 0.080 [0.078, 0.082]* | -0.094 [-0.097, -0.091]* | -855 [-989, -716]* | -1.2 [-1.4, -1.0]* | 6,192 [5,899, 6,493]* |
| M4-transport-disruption | 0.005 [0.004, 0.005]* | -0.005 [-0.005, -0.004]* | -58 [-79, -38]* | 0.0 [0.0, 0.0] | 678 [433, 932]* |
| M5-compound | 0.114 [0.109, 0.118]* | -0.117 [-0.123, -0.112]* | -2,046 [-2,178, -1,911]* | 3.1 [2.8, 3.3]* | 5,806 [5,489, 6,105]* |
| M6-long-lead | 0.100 [0.096, 0.104]* | -0.262 [-0.270, -0.254]* | -380 [-544, -223]* | 0.2 [0.0, 0.4]* | 11,665 [11,387, 11,939]* |
| M7-tight-warehouse | 0.100 [0.093, 0.106]* | -0.364 [-0.374, -0.355]* | 530 [340, 717]* | -0.3 [-0.4, -0.1]* | 15,108 [14,837, 15,390]* |
| M8-tight-transport | 0.008 [0.007, 0.009]* | -0.008 [-0.009, -0.007]* | -103 [-247, 36] | -1.2 [-1.6, -0.9]* | 953 [820, 1,085]* |
| M9-extreme | 0.158 [0.155, 0.161]* | -0.366 [-0.376, -0.355]* | 53 [-60, 165] | 1.9 [1.7, 2.0]* | 9,285 [9,092, 9,477]* |

### ERRRA − Weighted-equity heuristic

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.001 [0.000, 0.001]* | -0.001 [-0.001, 0.000]* | 142 [121, 162]* | 0.0 [0.0, 0.0] | -153 [-474, 173] |
| M2-demand-surge | 0.021 [0.019, 0.024]* | -0.021 [-0.024, -0.019]* | 3,148 [3,028, 3,272]* | 8.6 [8.4, 8.9]* | 1,805 [1,508, 2,094]* |
| M3-supply-disruption | 0.027 [0.024, 0.030]* | 0.027 [0.022, 0.031]* | 1,257 [1,098, 1,441]* | 2.1 [1.9, 2.3]* | 6,593 [6,317, 6,862]* |
| M4-transport-disruption | 0.006 [0.005, 0.008]* | -0.006 [-0.008, -0.005]* | 123 [100, 145]* | 0.0 [0.0, 0.0] | 146 [-148, 426] |
| M5-compound | 0.063 [0.060, 0.067]* | -0.013 [-0.016, -0.009]* | 1,520 [1,256, 1,799]* | 7.6 [7.3, 7.9]* | 5,767 [5,433, 6,084]* |
| M6-long-lead | 0.018 [0.014, 0.022]* | 0.043 [0.034, 0.051]* | 1,031 [753, 1,306]* | 5.2 [4.8, 5.5]* | 13,176 [12,904, 13,453]* |
| M7-tight-warehouse | 0.017 [0.011, 0.023]* | 0.027 [0.019, 0.035]* | 488 [271, 699]* | 4.0 [3.8, 4.2]* | 17,285 [17,011, 17,570]* |
| M8-tight-transport | 0.141 [0.136, 0.145]* | -0.136 [-0.140, -0.131]* | -6,315 [-6,505, -6,142]* | 25.9 [25.5, 26.3]* | 7,055 [6,872, 7,243]* |
| M9-extreme | 0.174 [0.169, 0.179]* | 0.071 [0.060, 0.081]* | -9,276 [-9,422, -9,136]* | 23.1 [22.9, 23.4]* | 21,304 [21,031, 21,585]* |

### ERRRA − Tuned (s,Q)

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | 0.002 [0.002, 0.002]* | -0.002 [-0.002, -0.002]* | 763 [741, 785]* | 0.0 [0.0, 0.0] | 2,331 [2,052, 2,594]* |
| M2-demand-surge | -0.003 [-0.003, -0.002]* | 0.003 [0.002, 0.003]* | 8,215 [8,139, 8,291]* | 10.6 [10.4, 10.8]* | -6,549 [-6,933, -6,164]* |
| M3-supply-disruption | -0.065 [-0.069, -0.061]* | 0.051 [0.048, 0.055]* | 6,889 [6,719, 7,056]* | 4.3 [4.1, 4.5]* | -32,215 [-32,863, -31,524]* |
| M4-transport-disruption | -0.016 [-0.017, -0.014]* | 0.016 [0.014, 0.017]* | 865 [840, 888]* | 0.0 [0.0, 0.0] | -591 [-879, -312]* |
| M5-compound | -0.012 [-0.016, -0.007]* | 0.008 [0.003, 0.013]* | 11,805 [11,628, 11,974]* | 12.9 [12.7, 13.1]* | -41,609 [-42,435, -40,821]* |
| M6-long-lead | -0.088 [-0.096, -0.080]* | -0.064 [-0.074, -0.054]* | 9,742 [9,476, 10,017]* | 8.0 [7.7, 8.2]* | -51,956 [-52,627, -51,272]* |
| M7-tight-warehouse | -0.166 [-0.173, -0.159]* | -0.100 [-0.110, -0.090]* | 15,938 [15,717, 16,157]* | 10.7 [10.5, 10.9]* | -80,329 [-80,814, -79,862]* |
| M8-tight-transport | 0.600 [0.594, 0.607]* | -0.597 [-0.604, -0.591]* | -7,696 [-7,956, -7,452]* | 36.6 [36.1, 37.0]* | -114,466 [-114,782, -114,132]* |
| M9-extreme | 0.365 [0.362, 0.369]* | -0.587 [-0.596, -0.576]* | -497 [-624, -373]* | 36.0 [35.8, 36.2]* | -104,751 [-105,067, -104,423]* |

### Weighted-equity heuristic − Cost-only

| Scenario | Δ Worst-region essential fill | Δ Regional service gap | Δ Cumulative unmet demand | Δ P95 waiting time | Δ Total cost |
| --- | --- | --- | --- | --- | --- |
| M1-normal | -0.001 [-0.001, 0.000]* | 0.001 [0.000, 0.001]* | -201 [-218, -185]* | 0.0 [0.0, 0.0] | 815 [516, 1,100]* |
| M2-demand-surge | -0.020 [-0.022, -0.018]* | 0.020 [0.018, 0.022]* | -2,006 [-2,130, -1,884]* | -4.7 [-5.0, -4.5]* | -670 [-963, -387]* |
| M3-supply-disruption | 0.053 [0.050, 0.056]* | -0.120 [-0.125, -0.116]* | -2,112 [-2,273, -1,955]* | -3.2 [-3.4, -3.1]* | -401 [-678, -120]* |
| M4-transport-disruption | -0.002 [-0.003, -0.001]* | 0.002 [0.001, 0.003]* | -181 [-200, -162]* | 0.0 [0.0, 0.0] | 533 [261, 802]* |
| M5-compound | 0.050 [0.047, 0.054]* | -0.105 [-0.110, -0.099]* | -3,566 [-3,812, -3,331]* | -4.5 [-4.8, -4.3]* | 39 [-257, 341] |
| M6-long-lead | 0.082 [0.079, 0.086]* | -0.304 [-0.311, -0.298]* | -1,410 [-1,641, -1,190]* | -4.9 [-5.2, -4.7]* | -1,512 [-1,788, -1,233]* |
| M7-tight-warehouse | 0.083 [0.078, 0.088]* | -0.392 [-0.399, -0.385]* | 43 [-170, 249] | -4.3 [-4.5, -4.1]* | -2,177 [-2,385, -1,957]* |
| M8-tight-transport | -0.133 [-0.137, -0.128]* | 0.128 [0.123, 0.132]* | 6,212 [6,043, 6,381]* | -27.2 [-27.5, -26.8]* | -6,103 [-6,271, -5,944]* |
| M9-extreme | -0.016 [-0.021, -0.011]* | -0.436 [-0.442, -0.431]* | 9,329 [9,182, 9,468]* | -21.3 [-21.5, -21.0]* | -12,020 [-12,277, -11,773]* |

## Price of Equity relative to cost-only

PoE = mean over seeds of (C_policy − C_cost-only) / C_cost-only, bootstrap 95% CI. "Cost per pp" = Δ total cost per percentage point of worst-region essential fill gained over cost-only, computed only when both the gain and the extra cost have 95% CIs above 0; otherwise the reason is shown.

| Scenario | Policy | PoE [95% CI] | Δ worst-region ess. fill, pp [95% CI] | Cost per pp |
| --- | --- | --- | --- | --- |
| M1-normal | Fixed allocation | 21.84% [21.73, 21.95] | -0.51 [-0.54, -0.47] | worst region loss |
| M1-normal | Tuned (s,Q) | -0.59% [-0.69, -0.49] | -0.20 [-0.23, -0.18] | worst region loss |
| M1-normal | Weighted-equity heuristic | 0.29% [0.19, 0.39] | -0.06 [-0.08, -0.04] | worst region loss |
| M1-normal | ERRRA | 0.24% [0.13, 0.34] | 0.00 [0.00, 0.01] | gain not significant |
| M2-demand-surge | Fixed allocation | 16.78% [16.68, 16.88] | -39.64 [-39.99, -39.30] | worst region loss |
| M2-demand-surge | Tuned (s,Q) | 2.42% [2.28, 2.55] | 0.42 [0.35, 0.48] | 18,383 |
| M2-demand-surge | Weighted-equity heuristic | -0.21% [-0.30, -0.12] | -2.01 [-2.25, -1.78] | worst region loss |
| M2-demand-surge | ERRRA | 0.36% [0.28, 0.44] | 0.14 [0.11, 0.17] | 8,171 |
| M3-supply-disruption | Fixed allocation | 16.38% [16.24, 16.53] | -25.96 [-26.37, -25.56] | worst region loss |
| M3-supply-disruption | Tuned (s,Q) | 13.34% [13.08, 13.59] | 14.51 [14.14, 14.90] | 2,646 |
| M3-supply-disruption | Weighted-equity heuristic | -0.14% [-0.23, -0.04] | 5.26 [4.96, 5.56] | gain at lower cost |
| M3-supply-disruption | ERRRA | 2.15% [2.05, 2.26] | 8.01 [7.78, 8.23] | 773 |
| M4-transport-disruption | Fixed allocation | 21.52% [21.42, 21.62] | -21.95 [-22.18, -21.75] | worst region loss |
| M4-transport-disruption | Tuned (s,Q) | 0.45% [0.35, 0.56] | 2.03 [1.85, 2.20] | 626 |
| M4-transport-disruption | Weighted-equity heuristic | 0.19% [0.09, 0.29] | -0.18 [-0.30, -0.07] | worst region loss |
| M4-transport-disruption | ERRRA | 0.24% [0.16, 0.33] | 0.46 [0.38, 0.54] | 1,463 |
| M5-compound | Fixed allocation | 13.58% [13.46, 13.70] | -32.13 [-32.58, -31.67] | worst region loss |
| M5-compound | Tuned (s,Q) | 14.65% [14.41, 14.90] | 12.57 [12.02, 13.11] | 3,772 |
| M5-compound | Weighted-equity heuristic | 0.01% [-0.08, 0.11] | 5.03 [4.67, 5.39] | extra cost not significant |
| M5-compound | ERRRA | 1.80% [1.70, 1.89] | 11.38 [10.91, 11.84] | 510 |
| M6-long-lead | Fixed allocation | 9.22% [9.13, 9.31] | -18.95 [-19.39, -18.47] | worst region loss |
| M6-long-lead | Tuned (s,Q) | 19.57% [19.33, 19.81] | 18.84 [18.13, 19.58] | 3,378 |
| M6-long-lead | Weighted-equity heuristic | -0.46% [-0.55, -0.38] | 8.21 [7.86, 8.57] | gain at lower cost |
| M6-long-lead | ERRRA | 3.59% [3.50, 3.67] | 10.01 [9.65, 10.40] | 1,165 |
| M7-tight-warehouse | Fixed allocation | 9.03% [8.93, 9.13] | -15.59 [-16.12, -15.04] | worst region loss |
| M7-tight-warehouse | Tuned (s,Q) | 29.80% [29.64, 29.97] | 26.56 [25.86, 27.25] | 3,594 |
| M7-tight-warehouse | Weighted-equity heuristic | -0.68% [-0.74, -0.61] | 8.29 [7.76, 8.85] | gain at lower cost |
| M7-tight-warehouse | ERRRA | 4.72% [4.63, 4.81] | 9.99 [9.34, 10.63] | 1,512 |
| M8-tight-transport | Fixed allocation | 7.82% [7.74, 7.91] | -69.33 [-69.62, -69.07] | worst region loss |
| M8-tight-transport | Tuned (s,Q) | 38.70% [38.57, 38.83] | -59.25 [-59.86, -58.59] | worst region loss |
| M8-tight-transport | Weighted-equity heuristic | -2.05% [-2.10, -1.99] | -13.27 [-13.71, -12.82] | worst region loss |
| M8-tight-transport | ERRRA | 0.32% [0.27, 0.36] | 0.79 [0.66, 0.93] | 1,200 |
| M9-extreme | Fixed allocation | 5.27% [5.19, 5.35] | -23.31 [-23.56, -23.04] | worst region loss |
| M9-extreme | Tuned (s,Q) | 36.99% [36.84, 37.12] | -20.73 [-21.02, -20.44] | worst region loss |
| M9-extreme | Weighted-equity heuristic | -3.90% [-3.98, -3.82] | -1.61 [-2.13, -1.10] | worst region loss |
| M9-extreme | ERRRA | 3.01% [2.95, 3.07] | 15.79 [15.47, 16.10] | 588 |

## Pareto-efficient policies (cost ↓, worst-region essential fill ↑, cumulative unmet ↓)

| Scenario | Efficient policies |
| --- | --- |
| M1-normal | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M2-demand-surge | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M3-supply-disruption | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M4-transport-disruption | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M5-compound | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M6-long-lead | Tuned (s,Q), Weighted-equity heuristic, ERRRA |
| M7-tight-warehouse | Tuned (s,Q), Cost-only, Weighted-equity heuristic, ERRRA |
| M8-tight-transport | Cost-only, Weighted-equity heuristic, ERRRA |
| M9-extreme | Cost-only, Weighted-equity heuristic, ERRRA |
