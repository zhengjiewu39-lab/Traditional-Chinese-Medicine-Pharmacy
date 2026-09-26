# Stress grid (S10 structure: surge × supply, rural road ×2; 20 test seeds per cell)

## Δ worst-region essential fill (ERRRA − cost-first)

| Supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.001 | 0.007 | 0.011 | 0.179 | 0.174 |
| 0.7 | 0.001 | 0.006 | 0.150 | 0.186 | 0.157 |
| 0.5 | 0.001 | 0.011 | 0.281 | 0.172 | 0.084 |
| 0.3 | 0.006 | 0.305 | 0.130 | 0.058 | 0.013 |
| 0.1 | 0.081 | 0.118 | 0.010 | -0.006 | -0.008 |

## Best policy by worst-region essential fill

| Supply \ Surge | ×1 | ×1.5 | ×2 | ×2.5 | ×3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Tuned (s,Q) (1.00) | Tuned (s,Q) (1.00) | ERRRA (0.94) | ERRRA (0.71) | ERRRA (0.44) |
| 0.7 | Tuned (s,Q) (1.00) | Tuned (s,Q) (0.98) | ERRRA (0.86) | ERRRA (0.45) | ERRRA (0.38) |
| 0.5 | Tuned (s,Q) (1.00) | ERRRA (0.97) | ERRRA (0.61) | ERRRA (0.42) | ERRRA (0.32) |
| 0.3 | ERRRA (1.00) | ERRRA (0.92) | ERRRA (0.40) | ERRRA (0.31) | Equity-aware (weighted) (0.26) |
| 0.1 | ERRRA (0.87) | ERRRA (0.48) | Tuned (s,Q) (0.30) | Tuned (s,Q) (0.27) | Tuned (s,Q) (0.25) |

## Cells where every policy has worst-region essential fill < 0.5 (failure region)

- surge ×3, supply 1
- surge ×2.5, supply 0.7
- surge ×3, supply 0.7
- surge ×2.5, supply 0.5
- surge ×3, supply 0.5
- surge ×2, supply 0.3
- surge ×2.5, supply 0.3
- surge ×3, supply 0.3
- surge ×1.5, supply 0.1
- surge ×2, supply 0.1
- surge ×2.5, supply 0.1
- surge ×3, supply 0.1
