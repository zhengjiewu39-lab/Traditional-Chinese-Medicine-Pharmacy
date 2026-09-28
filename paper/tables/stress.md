# Stress grid (M5-compound structure: surge × primary-supplier capacity, backup 0.4, rural road ×2; 20 test seeds per cell)

## Δ worst-region essential fill (ERRRA − cost-only)

| Primary supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.001 | 0.006 | 0.011 | 0.015 | 0.166 |
| 0.7 | 0.001 | 0.006 | 0.092 | 0.298 | 0.223 |
| 0.5 | 0.001 | 0.069 | 0.150 | 0.190 | 0.131 |
| 0.3 | 0.001 | 0.115 | 0.107 | 0.132 | 0.067 |
| 0 | 0.075 | 0.070 | 0.063 | 0.048 | 0.019 |

## Best policy by worst-region essential fill

| Primary supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.94) | ERRRA (0.92) | ERRRA (0.87) |
| 0.7 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.94) | ERRRA (0.77) | ERRRA (0.52) |
| 0.5 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.78) | ERRRA (0.55) | ERRRA (0.39) |
| 0.3 | Tuned (s,Q) (1.00) | Tuned (s,Q) (0.88) | ERRRA (0.61) | ERRRA (0.44) | ERRRA (0.32) |
| 0 | Tuned (s,Q) (0.96) | Tuned (s,Q) (0.66) | ERRRA (0.46) | ERRRA (0.33) | ERRRA (0.27) |

## Cells where every policy has worst-region essential fill < 0.5 (failure region)

- surge ×3, primary supply 0.5
- surge ×2.5, primary supply 0.3
- surge ×3, primary supply 0.3
- surge ×2, primary supply 0
- surge ×2.5, primary supply 0
- surge ×3, primary supply 0
