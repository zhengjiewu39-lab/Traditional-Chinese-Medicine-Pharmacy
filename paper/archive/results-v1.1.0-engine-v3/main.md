# Main results (synthetic; frozen matrix; test seeds)

Each cell: mean ± 95% CI half-width over 100 common-random-number test seeds. Recovery times are right-censored at the horizon (censored runs count as the maximum observable delay) and are n/a for the no-disruption baseline; "Rec95" is the share of runs that reached 95% of the pre-disruption baseline. "Unmet ess." counts essential units not filled from stock at the time of demand (they are backordered and may be served later). Results hold only 在预定义仿真场景中 and cannot be read as real-world policy effects.

| Scenario | Policy | Cost | Worst-region ess. fill | Ess. gap | Unmet ess. | AUC | T95 | Fill | Rec95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01-baseline | Fixed allocation | 348,233 ± 459 | 0.994 ± 0.000 | 0.006 ± 0.000 | 9 ± 1 | 0.00 ± 0.00 | n/a | 0.999 ± 0.000 | n/a |
| S01-baseline | Tuned (s,Q) | 277,431 ± 498 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 0 | 0.00 ± 0.00 | n/a | 1.000 ± 0.000 | n/a |
| S01-baseline | Cost-first | 275,036 ± 534 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 0 | 0.00 ± 0.00 | n/a | 0.985 ± 0.000 | n/a |
| S01-baseline | Equity-aware (weighted) | 275,625 ± 527 | 0.998 ± 0.000 | 0.002 ± 0.000 | 9 ± 1 | 0.00 ± 0.00 | n/a | 0.989 ± 0.000 | n/a |
| S01-baseline | ERRRA | 275,165 ± 523 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 0 | 0.00 ± 0.00 | n/a | 0.986 ± 0.000 | n/a |
| S02-surge-low | Fixed allocation | 352,473 ± 485 | 0.905 ± 0.007 | 0.082 ± 0.007 | 1,898 ± 149 | 9.92 ± 0.81 | 37.2 ± 2.5 | 0.916 ± 0.006 | 0.90 |
| S02-surge-low | Tuned (s,Q) | 285,204 ± 523 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 1.000 ± 0.000 | 1.00 |
| S02-surge-low | Cost-first | 281,492 ± 490 | 0.998 ± 0.000 | 0.002 ± 0.000 | 3 ± 1 | 0.01 ± 0.00 | 0.0 ± 0.0 | 0.975 ± 0.001 | 1.00 |
| S02-surge-low | Equity-aware (weighted) | 281,686 ± 482 | 0.995 ± 0.001 | 0.005 ± 0.001 | 16 ± 2 | 0.03 ± 0.01 | 0.0 ± 0.0 | 0.984 ± 0.001 | 1.00 |
| S02-surge-low | ERRRA | 281,686 ± 523 | 0.999 ± 0.000 | 0.001 ± 0.000 | 3 ± 0 | 0.01 ± 0.00 | 0.0 ± 0.0 | 0.962 ± 0.001 | 1.00 |
| S03-surge-mid | Fixed allocation | 355,166 ± 489 | 0.547 ± 0.003 | 0.206 ± 0.004 | 9,825 ± 54 | 47.33 ± 0.23 | 60.0 ± 0.0 | 0.591 ± 0.002 | 0.00 |
| S03-surge-mid | Tuned (s,Q) | 296,615 ± 606 | 0.997 ± 0.000 | 0.003 ± 0.000 | 6 ± 1 | 0.02 ± 0.00 | 0.0 ± 0.0 | 1.000 ± 0.000 | 1.00 |
| S03-surge-mid | Cost-first | 288,122 ± 505 | 0.994 ± 0.001 | 0.006 ± 0.001 | 16 ± 2 | 0.05 ± 0.01 | 0.0 ± 0.0 | 0.904 ± 0.001 | 1.00 |
| S03-surge-mid | Equity-aware (weighted) | 287,009 ± 530 | 0.953 ± 0.004 | 0.047 ± 0.004 | 118 ± 10 | 0.41 ± 0.04 | 0.5 ± 0.4 | 0.904 ± 0.002 | 1.00 |
| S03-surge-mid | ERRRA | 288,388 ± 536 | 0.995 ± 0.001 | 0.005 ± 0.001 | 11 ± 1 | 0.04 ± 0.00 | 0.0 ± 0.0 | 0.888 ± 0.001 | 1.00 |
| S04-surge-high | Fixed allocation | 360,297 ± 474 | 0.319 ± 0.003 | 0.292 ± 0.003 | 15,688 ± 69 | 68.52 ± 0.31 | 60.0 ± 0.0 | 0.400 ± 0.002 | 0.00 |
| S04-surge-high | Tuned (s,Q) | 351,413 ± 1,054 | 0.947 ± 0.009 | 0.053 ± 0.009 | 961 ± 157 | 3.59 ± 0.56 | 9.9 ± 0.8 | 0.946 ± 0.005 | 1.00 |
| S04-surge-high | Cost-first | 300,654 ± 543 | 0.980 ± 0.001 | 0.020 ± 0.001 | 92 ± 9 | 0.27 ± 0.03 | 0.1 ± 0.1 | 0.814 ± 0.001 | 1.00 |
| S04-surge-high | Equity-aware (weighted) | 296,699 ± 483 | 0.844 ± 0.005 | 0.118 ± 0.005 | 1,450 ± 41 | 6.33 ± 0.16 | 26.6 ± 0.8 | 0.763 ± 0.002 | 1.00 |
| S04-surge-high | ERRRA | 303,473 ± 533 | 0.984 ± 0.001 | 0.016 ± 0.001 | 42 ± 3 | 0.12 ± 0.01 | 0.0 ± 0.0 | 0.807 ± 0.001 | 1.00 |
| S05-supply-low | Fixed allocation | 338,592 ± 459 | 0.957 ± 0.004 | 0.037 ± 0.004 | 789 ± 80 | 4.38 ± 0.46 | 24.3 ± 1.7 | 0.962 ± 0.004 | 1.00 |
| S05-supply-low | Tuned (s,Q) | 270,162 ± 490 | 0.999 ± 0.000 | 0.001 ± 0.000 | 1 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 1.000 ± 0.000 | 1.00 |
| S05-supply-low | Cost-first | 266,200 ± 497 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.983 ± 0.000 | 1.00 |
| S05-supply-low | Equity-aware (weighted) | 266,686 ± 484 | 0.998 ± 0.000 | 0.002 ± 0.000 | 9 ± 1 | 0.01 ± 0.00 | 0.0 ± 0.0 | 0.987 ± 0.000 | 1.00 |
| S05-supply-low | ERRRA | 266,631 ± 505 | 0.999 ± 0.000 | 0.001 ± 0.000 | 1 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.978 ± 0.001 | 1.00 |
| S06-supply-mid | Fixed allocation | 327,093 ± 437 | 0.555 ± 0.002 | 0.320 ± 0.003 | 8,157 ± 34 | 46.55 ± 0.16 | 60.0 ± 0.0 | 0.611 ± 0.001 | 0.00 |
| S06-supply-mid | Tuned (s,Q) | 271,175 ± 794 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 1 | 0.00 ± 0.01 | 0.1 ± 0.1 | 1.000 ± 0.000 | 1.00 |
| S06-supply-mid | Cost-first | 258,692 ± 505 | 0.999 ± 0.000 | 0.001 ± 0.000 | 2 ± 1 | 0.01 ± 0.00 | 0.0 ± 0.0 | 0.920 ± 0.001 | 1.00 |
| S06-supply-mid | Equity-aware (weighted) | 258,079 ± 510 | 0.977 ± 0.003 | 0.023 ± 0.003 | 58 ± 7 | 0.26 ± 0.04 | 0.7 ± 0.7 | 0.922 ± 0.002 | 1.00 |
| S06-supply-mid | ERRRA | 259,053 ± 491 | 0.999 ± 0.000 | 0.001 ± 0.000 | 1 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.914 ± 0.001 | 1.00 |
| S07-supply-high | Fixed allocation | 316,927 ± 381 | 0.371 ± 0.003 | 0.325 ± 0.003 | 11,277 ± 50 | 64.44 ± 0.24 | 60.0 ± 0.0 | 0.461 ± 0.002 | 0.00 |
| S07-supply-high | Tuned (s,Q) | 340,513 ± 825 | 0.906 ± 0.005 | 0.094 ± 0.005 | 1,358 ± 67 | 7.78 ± 0.38 | 15.6 ± 0.4 | 0.926 ± 0.003 | 1.00 |
| S07-supply-high | Cost-first | 252,549 ± 480 | 0.988 ± 0.001 | 0.012 ± 0.001 | 175 ± 16 | 1.00 ± 0.09 | 0.0 ± 0.0 | 0.803 ± 0.001 | 1.00 |
| S07-supply-high | Equity-aware (weighted) | 250,113 ± 446 | 0.859 ± 0.005 | 0.097 ± 0.005 | 1,405 ± 48 | 7.91 ± 0.27 | 26.1 ± 1.1 | 0.779 ± 0.002 | 1.00 |
| S07-supply-high | ERRRA | 252,942 ± 452 | 0.999 ± 0.000 | 0.001 ± 0.000 | 1 ± 0 | 0.00 ± 0.00 | 0.0 ± 0.0 | 0.806 ± 0.001 | 1.00 |
| S08-rural-road | Fixed allocation | 348,066 ± 459 | 0.864 ± 0.004 | 0.136 ± 0.004 | 220 ± 7 | 1.14 ± 0.04 | 3.0 ± 0.9 | 0.989 ± 0.000 | 1.00 |
| S08-rural-road | Tuned (s,Q) | 279,860 ± 528 | 0.998 ± 0.000 | 0.002 ± 0.000 | 3 ± 0 | 0.01 ± 0.00 | 0.0 ± 0.0 | 1.000 ± 0.000 | 1.00 |
| S08-rural-road | Cost-first | 274,920 ± 519 | 0.995 ± 0.001 | 0.005 ± 0.001 | 8 ± 1 | 0.04 ± 0.01 | 0.0 ± 0.0 | 0.985 ± 0.000 | 1.00 |
| S08-rural-road | Equity-aware (weighted) | 275,482 ± 518 | 0.993 ± 0.001 | 0.007 ± 0.001 | 18 ± 2 | 0.05 ± 0.01 | 0.0 ± 0.0 | 0.988 ± 0.000 | 1.00 |
| S08-rural-road | ERRRA | 275,138 ± 502 | 0.996 ± 0.001 | 0.004 ± 0.001 | 6 ± 1 | 0.03 ± 0.01 | 0.0 ± 0.0 | 0.985 ± 0.000 | 1.00 |
| S09-surge-supply | Fixed allocation | 332,075 ± 418 | 0.288 ± 0.000 | 0.355 ± 0.001 | 14,586 ± 33 | 71.08 ± 0.05 | 60.0 ± 0.0 | 0.393 ± 0.000 | 0.00 |
| S09-surge-supply | Tuned (s,Q) | 357,137 ± 996 | 0.716 ± 0.007 | 0.284 ± 0.007 | 4,773 ± 128 | 21.92 ± 0.58 | 28.8 ± 1.2 | 0.786 ± 0.004 | 1.00 |
| S09-surge-supply | Cost-first | 281,230 ± 495 | 0.949 ± 0.003 | 0.050 ± 0.003 | 850 ± 43 | 4.11 ± 0.21 | 14.2 ± 0.5 | 0.725 ± 0.001 | 1.00 |
| S09-surge-supply | Equity-aware (weighted) | 274,907 ± 508 | 0.773 ± 0.006 | 0.089 ± 0.007 | 3,681 ± 55 | 18.19 ± 0.25 | 43.5 ± 0.8 | 0.645 ± 0.002 | 1.00 |
| S09-surge-supply | ERRRA | 284,009 ± 514 | 0.984 ± 0.002 | 0.014 ± 0.001 | 153 ± 20 | 0.79 ± 0.10 | 6.6 ± 0.8 | 0.731 ± 0.001 | 1.00 |
| S10-surge-supply-road | Fixed allocation | 332,048 ± 418 | 0.288 ± 0.000 | 0.355 ± 0.001 | 14,760 ± 33 | 71.84 ± 0.05 | 60.0 ± 0.0 | 0.386 ± 0.000 | 0.00 |
| S10-surge-supply-road | Tuned (s,Q) | 356,984 ± 993 | 0.716 ± 0.007 | 0.283 ± 0.007 | 4,776 ± 128 | 21.93 ± 0.58 | 28.8 ± 1.2 | 0.786 ± 0.004 | 1.00 |
| S10-surge-supply-road | Cost-first | 280,968 ± 485 | 0.906 ± 0.004 | 0.094 ± 0.004 | 1,640 ± 74 | 7.23 ± 0.31 | 14.5 ± 0.9 | 0.705 ± 0.002 | 1.00 |
| S10-surge-supply-road | Equity-aware (weighted) | 274,841 ± 511 | 0.741 ± 0.006 | 0.109 ± 0.007 | 3,993 ± 75 | 19.94 ± 0.34 | 45.6 ± 0.8 | 0.639 ± 0.002 | 1.00 |
| S10-surge-supply-road | ERRRA | 284,390 ± 509 | 0.963 ± 0.002 | 0.032 ± 0.002 | 286 ± 27 | 1.37 ± 0.14 | 8.8 ± 0.6 | 0.724 ± 0.001 | 1.00 |
| S11-long-lead | Fixed allocation | 332,333 ± 418 | 0.288 ± 0.000 | 0.351 ± 0.001 | 14,644 ± 33 | 71.05 ± 0.05 | 60.0 ± 0.0 | 0.390 ± 0.000 | 0.00 |
| S11-long-lead | Tuned (s,Q) | 353,176 ± 923 | 0.713 ± 0.008 | 0.284 ± 0.008 | 4,841 ± 139 | 21.83 ± 0.62 | 26.2 ± 0.8 | 0.761 ± 0.004 | 1.00 |
| S11-long-lead | Cost-first | 281,435 ± 510 | 0.920 ± 0.004 | 0.079 ± 0.004 | 1,340 ± 60 | 6.09 ± 0.27 | 15.6 ± 0.5 | 0.717 ± 0.001 | 1.00 |
| S11-long-lead | Equity-aware (weighted) | 274,230 ± 476 | 0.725 ± 0.008 | 0.162 ± 0.008 | 3,297 ± 62 | 16.88 ± 0.31 | 45.7 ± 1.2 | 0.667 ± 0.002 | 1.00 |
| S11-long-lead | ERRRA | 284,415 ± 553 | 0.980 ± 0.001 | 0.016 ± 0.001 | 203 ± 24 | 1.01 ± 0.12 | 8.4 ± 0.8 | 0.728 ± 0.001 | 1.00 |
| S12-limited-warehouse | Fixed allocation | 280,635 ± 349 | 0.288 ± 0.000 | 0.355 ± 0.001 | 14,585 ± 33 | 71.07 ± 0.05 | 60.0 ± 0.0 | 0.393 ± 0.000 | 0.00 |
| S12-limited-warehouse | Tuned (s,Q) | 354,223 ± 507 | 0.311 ± 0.002 | 0.678 ± 0.004 | 13,689 ± 50 | 67.34 ± 0.21 | 60.0 ± 0.0 | 0.431 ± 0.001 | 0.00 |
| S12-limited-warehouse | Cost-first | 226,414 ± 350 | 0.324 ± 0.001 | 0.671 ± 0.001 | 11,286 ± 33 | 55.94 ± 0.08 | 60.0 ± 0.0 | 0.515 ± 0.001 | 0.00 |
| S12-limited-warehouse | Equity-aware (weighted) | 223,285 ± 347 | 0.351 ± 0.001 | 0.192 ± 0.017 | 15,110 ± 42 | 76.05 ± 0.15 | 60.0 ± 0.0 | 0.374 ± 0.001 | 0.00 |
| S12-limited-warehouse | ERRRA | 235,403 ± 379 | 0.342 ± 0.001 | 0.192 ± 0.005 | 15,431 ± 34 | 77.75 ± 0.07 | 60.0 ± 0.0 | 0.461 ± 0.001 | 0.00 |
| S13-limited-capacity | Fixed allocation | 306,502 ± 371 | 0.232 ± 0.001 | 0.237 ± 0.002 | 16,777 ± 36 | 74.80 ± 0.25 | 60.0 ± 0.0 | 0.303 ± 0.000 | 0.00 |
| S13-limited-capacity | Tuned (s,Q) | 410,900 ± 451 | 0.287 ± 0.001 | 0.695 ± 0.004 | 14,339 ± 47 | 69.80 ± 0.18 | 60.0 ± 0.0 | 0.403 ± 0.001 | 0.00 |
| S13-limited-capacity | Cost-first | 259,275 ± 451 | 0.818 ± 0.006 | 0.182 ± 0.006 | 3,035 ± 92 | 12.41 ± 0.36 | 15.8 ± 0.4 | 0.547 ± 0.001 | 1.00 |
| S13-limited-capacity | Equity-aware (weighted) | 242,363 ± 461 | 0.569 ± 0.005 | 0.116 ± 0.010 | 9,472 ± 74 | 46.54 ± 0.33 | 60.0 ± 0.0 | 0.395 ± 0.001 | 0.00 |
| S13-limited-capacity | ERRRA | 264,309 ± 513 | 0.987 ± 0.001 | 0.012 ± 0.001 | 99 ± 13 | 0.51 ± 0.06 | 4.5 ± 0.8 | 0.585 ± 0.001 | 1.00 |
| S14-extreme | Fixed allocation | 304,103 ± 376 | 0.226 ± 0.000 | 0.103 ± 0.001 | 20,204 ± 40 | 82.89 ± 0.04 | 60.0 ± 0.0 | 0.257 ± 0.000 | 0.00 |
| S14-extreme | Tuned (s,Q) | 427,926 ± 526 | 0.263 ± 0.001 | 0.545 ± 0.008 | 18,329 ± 51 | 78.00 ± 0.15 | 60.0 ± 0.0 | 0.328 ± 0.001 | 0.00 |
| S14-extreme | Cost-first | 253,378 ± 448 | 0.262 ± 0.001 | 0.577 ± 0.007 | 16,322 ± 49 | 65.36 ± 0.13 | 60.0 ± 0.0 | 0.338 ± 0.001 | 0.00 |
| S14-extreme | Equity-aware (weighted) | 243,379 ± 445 | 0.294 ± 0.002 | 0.181 ± 0.009 | 18,697 ± 51 | 79.74 ± 0.13 | 60.0 ± 0.0 | 0.278 ± 0.001 | 0.00 |
| S14-extreme | ERRRA | 265,969 ± 467 | 0.282 ± 0.002 | 0.088 ± 0.006 | 19,174 ± 68 | 82.70 ± 0.15 | 60.0 ± 0.0 | 0.301 ± 0.001 | 0.00 |

## ERRRA − cost-first (paired over seeds)

Mean difference [95% CI] (number of seeds where ERRRA is higher ↑ / lower ↓). Positive is better for worst-region fill; negative is better for unmet, gap and cost.

| Scenario | Δ worst-region ess. fill | Δ unmet ess. | Δ ess. gap | Δ cost |
| --- | --- | --- | --- | --- |
| S01-baseline | -0.000 [-0.000, 0.000] (5↑/9↓) | 0.020 [-0.106, 0.146] (9↑/6↓) | 0.000 [-0.000, 0.000] (9↑/5↓) | 129 [-46, 304] (54↑/46↓) |
| S02-surge-low | 0.000 [0.000, 0.000] (17↑/9↓) | -0.620 [-1.159, -0.081] (10↑/21↓) | -0.000 [-0.000, -0.000] (9↑/17↓) | 195 [-24, 414] (52↑/48↓) |
| S03-surge-mid | 0.001 [0.001, 0.002] (67↑/2↓) | -4.960 [-6.755, -3.165] (9↑/71↓) | -0.001 [-0.002, -0.001] (2↑/67↓) | 265 [43, 488] (58↑/42↓) |
| S04-surge-high | 0.004 [0.004, 0.005] (89↑/0↓) | -49.640 [-58.332, -40.948] (2↑/96↓) | -0.004 [-0.005, -0.004] (0↑/90↓) | 2,819 [2,577, 3,061] (97↑/3↓) |
| S05-supply-low | 0.000 [-0.000, 0.000] (19↑/12↓) | -0.230 [-0.421, -0.039] (11↑/20↓) | -0.000 [-0.000, 0.000] (12↑/19↓) | 431 [223, 639] (63↑/37↓) |
| S06-supply-mid | 0.000 [0.000, 0.000] (28↑/11↓) | -1.170 [-1.890, -0.450] (10↑/31↓) | -0.000 [-0.000, -0.000] (11↑/28↓) | 361 [147, 575] (65↑/35↓) |
| S07-supply-high | 0.011 [0.010, 0.012] (99↑/0↓) | -173.790 [-189.545, -158.035] (0↑/100↓) | -0.011 [-0.012, -0.010] (0↑/99↓) | 393 [143, 643] (63↑/37↓) |
| S08-rural-road | 0.001 [0.001, 0.001] (56↑/3↓) | -2.240 [-2.888, -1.592] (3↑/57↓) | -0.001 [-0.001, -0.001] (3↑/56↓) | 218 [24, 413] (58↑/42↓) |
| S09-surge-supply | 0.034 [0.032, 0.036] (100↑/0↓) | -697.380 [-738.696, -656.064] (0↑/100↓) | -0.036 [-0.038, -0.033] (0↑/100↓) | 2,779 [2,539, 3,019] (99↑/1↓) |
| S10-surge-supply-road | 0.057 [0.053, 0.061] (100↑/0↓) | -1,353.560 [-1,426.108, -1,281.012] (0↑/100↓) | -0.062 [-0.066, -0.057] (0↑/100↓) | 3,421 [3,137, 3,705] (99↑/1↓) |
| S11-long-lead | 0.060 [0.057, 0.063] (100↑/0↓) | -1,136.880 [-1,192.395, -1,081.365] (0↑/100↓) | -0.064 [-0.067, -0.060] (0↑/100↓) | 2,980 [2,733, 3,227] (99↑/1↓) |
| S12-limited-warehouse | 0.018 [0.017, 0.019] (100↑/0↓) | 4,144.310 [4,126.483, 4,162.137] (100↑/0↓) | -0.479 [-0.484, -0.474] (0↑/100↓) | 8,988 [8,887, 9,090] (100↑/0↓) |
| S13-limited-capacity | 0.169 [0.164, 0.175] (100↑/0↓) | -2,936.010 [-3,027.215, -2,844.805] (0↑/100↓) | -0.170 [-0.176, -0.165] (0↑/100↓) | 5,034 [4,813, 5,256] (100↑/0↓) |
| S14-extreme | 0.020 [0.018, 0.022] (96↑/4↓) | 2,852.530 [2,806.580, 2,898.480] (100↑/0↓) | -0.489 [-0.495, -0.484] (0↑/100↓) | 12,591 [12,498, 12,684] (100↑/0↓) |

## Price of Equity vs cost-first

costPerGapPoint = (C_policy − C_costFirst) / (gap reduction in percentage points). priceOfEquityRelative = (ΔC / C_costFirst) / (Δgap / gap_costFirst). "dominant" = lower cost and lower gap; "no_gap_reduction" = the policy did not reduce the gap.

| Scenario | Policy | Δ cost | Gap reduction (pp) | Cost per pp | PoE (relative) |
| --- | --- | --- | --- | --- | --- |
| S01-baseline | Equity-aware (weighted) | 589 | -0.11 | no_gap_reduction | — |
| S01-baseline | ERRRA | 129 | -0.00 | no_gap_reduction | — |
| S02-surge-low | Equity-aware (weighted) | 194 | -0.38 | no_gap_reduction | — |
| S02-surge-low | ERRRA | 195 | 0.01 | 17,797.3 | 0.010 |
| S03-surge-mid | Equity-aware (weighted) | -1,113 | -4.06 | no_gap_reduction | — |
| S03-surge-mid | ERRRA | 265 | 0.13 | 1,982.0 | 0.004 |
| S04-surge-high | Equity-aware (weighted) | -3,955 | -9.86 | no_gap_reduction | — |
| S04-surge-high | ERRRA | 2,819 | 0.41 | 6,900.4 | 0.046 |
| S05-supply-low | Equity-aware (weighted) | 486 | -0.12 | no_gap_reduction | — |
| S05-supply-low | ERRRA | 431 | 0.01 | 48,861.4 | 0.017 |
| S06-supply-mid | Equity-aware (weighted) | -613 | -2.21 | no_gap_reduction | — |
| S06-supply-mid | ERRRA | 361 | 0.02 | 24,005.8 | 0.009 |
| S07-supply-high | Equity-aware (weighted) | -2,436 | -8.49 | no_gap_reduction | — |
| S07-supply-high | ERRRA | 393 | 1.12 | 350.5 | 0.002 |
| S08-rural-road | Equity-aware (weighted) | 562 | -0.24 | no_gap_reduction | — |
| S08-rural-road | ERRRA | 218 | 0.12 | 1,876.5 | 0.003 |
| S09-surge-supply | Equity-aware (weighted) | -6,323 | -3.84 | no_gap_reduction | — |
| S09-surge-supply | ERRRA | 2,779 | 3.60 | 772.5 | 0.014 |
| S10-surge-supply-road | Equity-aware (weighted) | -6,127 | -1.54 | no_gap_reduction | — |
| S10-surge-supply-road | ERRRA | 3,421 | 6.16 | 555.3 | 0.019 |
| S11-long-lead | Equity-aware (weighted) | -7,205 | -8.29 | no_gap_reduction | — |
| S11-long-lead | ERRRA | 2,980 | 6.36 | 468.6 | 0.013 |
| S12-limited-warehouse | Equity-aware (weighted) | -3,130 | 47.87 | dominant_lower_cost_and_gap | — |
| S12-limited-warehouse | ERRRA | 8,988 | 47.88 | 187.7 | 0.056 |
| S13-limited-capacity | Equity-aware (weighted) | -16,911 | 6.59 | dominant_lower_cost_and_gap | — |
| S13-limited-capacity | ERRRA | 5,034 | 17.03 | 295.7 | 0.021 |
| S14-extreme | Equity-aware (weighted) | -9,999 | 39.64 | dominant_lower_cost_and_gap | — |
| S14-extreme | ERRRA | 12,591 | 48.94 | 257.3 | 0.059 |

## Pareto-efficient policies (cost ↓, worst-region essential fill ↑, unmet essential ↓)

| Scenario | Efficient policies |
| --- | --- |
| S01-baseline | Cost-first |
| S02-surge-low | Tuned (s,Q), Cost-first, ERRRA |
| S03-surge-mid | Tuned (s,Q), Cost-first, Equity-aware (weighted), ERRRA |
| S04-surge-high | Cost-first, Equity-aware (weighted), ERRRA |
| S05-supply-low | Cost-first, ERRRA |
| S06-supply-mid | Tuned (s,Q), Cost-first, Equity-aware (weighted), ERRRA |
| S07-supply-high | Cost-first, Equity-aware (weighted), ERRRA |
| S08-rural-road | Tuned (s,Q), Cost-first, ERRRA |
| S09-surge-supply | Cost-first, Equity-aware (weighted), ERRRA |
| S10-surge-supply-road | Cost-first, Equity-aware (weighted), ERRRA |
| S11-long-lead | Cost-first, Equity-aware (weighted), ERRRA |
| S12-limited-warehouse | Cost-first, Equity-aware (weighted) |
| S13-limited-capacity | Cost-first, Equity-aware (weighted), ERRRA |
| S14-extreme | Tuned (s,Q), Cost-first, Equity-aware (weighted) |
