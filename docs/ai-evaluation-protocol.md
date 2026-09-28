# AI evaluation protocol (offline)

Command: `npm run ai:evaluate`

Benchmark cases live in `benchmarks/ai-review/cases-v1.json`. They are synthetic standardized cases. Pharmacist override logs, when collected, are de-identified or synthetic and versioned in the same directory.

## Metrics

- hard-risk recall / precision (A3)
- false-alert rate on clean cases
- evidence citation completeness
- abstention appropriateness (sensitivity/specificity vs expected abstain)
- structured-output validity
- rule–model disagreement rate
- unsafe autonomous action count (must be 0)
- audit completeness and chain validity
- latency (p50/p95)

## Forbidden

Online auto-training; turning a single override into a live rule; unverified prompt edits; using patient feedback to change screening logic.

## Label on every report

```text
Engineering evaluation on synthetic standardized cases.
Not a clinical validation.
```
