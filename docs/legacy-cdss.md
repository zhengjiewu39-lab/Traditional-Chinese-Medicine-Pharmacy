# Legacy CDSS demo (not the research product)

Routes under `/legacy/*` preserve an earlier **synthetic prescription review demo** (HAR-CDSS naming in code only).

## What it is

- Rule engine + interpretable linear classifier on **synthetic** prescription cases.
- Labels such as `needs_revision` are **simulated high-risk tags** triggered by the same rule family used to generate training/evaluation labels (**label leakage**).

## What it is not

- Not clinical validation, ADR prevention effectiveness, pharmacist concordance, or patient safety evidence.
- Do **not** report macro-F1 (~95%) or ablation rankings as paper results for public-health supply resilience.

## Running legacy benchmarks only

```bash
npm run evaluate:ablation   # writes benchmarks/results/ablation-latest.json
```

Use `docs/legacy-cdss/` for archived prescription-review write-ups; the supply-resilience paper should cite `docs/methodology.md` instead.
