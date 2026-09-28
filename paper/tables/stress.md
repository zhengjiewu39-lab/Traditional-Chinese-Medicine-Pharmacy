# Stress grid (M5-compound structure: surge × primary-supplier capacity, backup 0.4, rural road ×2; 20 test seeds per cell)

## Δ worst-region essential fill (ERRRA − cost-only)

| Primary supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.002 | 0.008 | 0.013 | 0.024 | 0.169 |
| 0.7 | 0.002 | 0.008 | 0.109 | 0.287 | 0.205 |
| 0.5 | 0.002 | 0.072 | 0.147 | 0.187 | 0.124 |
| 0.3 | 0.002 | 0.107 | 0.112 | 0.129 | 0.069 |
| 0 | 0.074 | 0.068 | 0.068 | 0.051 | 0.023 |

## Best policy by worst-region essential fill

| Primary supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.94) | ERRRA (0.92) | ERRRA (0.85) |
| 0.7 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.94) | ERRRA (0.75) | ERRRA (0.49) |
| 0.5 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.76) | ERRRA (0.54) | ERRRA (0.37) |
| 0.3 | Tuned (s,Q) (1.00) | Tuned (s,Q) (0.87) | ERRRA (0.60) | ERRRA (0.42) | ERRRA (0.31) |
| 0 | Tuned (s,Q) (0.96) | Tuned (s,Q) (0.64) | ERRRA (0.45) | ERRRA (0.32) | ERRRA (0.27) |

## Cells where every policy has worst-region essential fill < 0.5 (failure region)

- surge ×3, primary supply 0.7
- surge ×3, primary supply 0.5
- surge ×2.5, primary supply 0.3
- surge ×3, primary supply 0.3
- surge ×2, primary supply 0
- surge ×2.5, primary supply 0
- surge ×3, primary supply 0
