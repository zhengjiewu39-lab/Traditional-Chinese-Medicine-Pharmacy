# Reorder-point (s,Q) calibration

Tuned per scenario on calibration seeds 900001–900020 (disjoint from test seeds). Objective: mean total cost + weighted stockout penalty. Base grid z ∈ {0.84, 1.28, 1.65, 2.05, 2.58, 3, 4, 5, 6, 8}, qScale ∈ {0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24}; when the optimum lies on an upper edge the grid is extended by ×1.5 on that axis (at most 6 times) until it moves inside. Large z means the tuned baseline stockpiles ahead of disruptions.

| Scenario | z | qScale | Objective | Grid extensions | Still at edge |
| --- | --- | --- | --- | --- | --- |
| S01-baseline | 1.28 | 1 | 276,915 | 0 | no |
| S02-surge-low | 2.05 | 1 | 284,286 | 0 | no |
| S03-surge-mid | 1.65 | 1.5 | 296,988 | 0 | no |
| S04-surge-high | 8 | 12 | 566,113 | 1 | no |
| S05-supply-low | 1.65 | 1 | 269,008 | 0 | no |
| S06-supply-mid | 2.58 | 1.5 | 269,501 | 0 | no |
| S07-supply-high | 27 | 3 | 661,359 | 4 | no |
| S08-rural-road | 6 | 1 | 279,629 | 0 | no |
| S09-surge-supply | 12 | 8 | 1,434,990 | 2 | no |
| S10-surge-supply-road | 12 | 8 | 1,435,308 | 2 | no |
| S11-long-lead | 6 | 12 | 1,486,264 | 0 | no |
| S12-limited-warehouse | 5 | 8 | 3,440,724 | 0 | no |
| S13-limited-capacity | 8 | 16 | 3,648,085 | 1 | no |
| S14-extreme | 18 | 36 | 4,574,064 | 4 | no |
