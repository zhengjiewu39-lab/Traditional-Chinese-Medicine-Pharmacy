# Evaluation Methodology — HAR-CDSS

## Benchmark dataset

**Primary file:** `benchmarks/prescription-review-dataset-expanded.json`  
**Fallback:** `benchmarks/prescription-review-dataset.json` (n=24)  
**Name:** TCM-Prescription-Review-Expanded-v1  
**Size:** 509 cases (24 curated + 485 synthetic)  
**License:** CC-BY-4.0  

Each case includes:

- De-identified prescription text
- Diagnosis / patient demographics (synthetic)
- **Expert label:** `approved` | `review` | `needs_revision`
- Rationale (pharmacist-style annotation)

The expanded dataset supports paper-scale evaluation of **herb adverse reaction prevention (ADR prevention)**.

## Systems compared

| Engine | Description |
|--------|-------------|
| `baseline-naive` | Always approves non-empty prescriptions (lower bound) |
| `baseline-keyword` | Keyword / regex scan for dangerous terms and large doses |
| `rule-engine-v3` | Configurable JSON rules: dosage, 十八反, 十九畏, ratios |
| `ml-interpretable-v1` | Linear model over hand-crafted features + attribution |
| `cdss-dual-track-v1` | **HAR-CDSS** — dual-track fusion with ADR taxonomy output |

## Ablation variants

| Variant | Description |
|---------|-------------|
| `rule-only` | Expert rules alone |
| `ml-only` | Interpretable ML alone |
| `fusion-cdss` | Dual-track fusion (paper main system) |

Run: `npm run evaluate:ablation` → `benchmarks/results/ablation-latest.json`

## Metrics

- **Accuracy** — exact 3-class label match
- **Macro Precision / Recall / F1** — averaged over approved / review / needs_revision
- **Binary F1 (needs_revision)** — ADR high-risk detection (prescriptions requiring modification)
- **Sensitivity / Specificity** — for ADR high-risk binary classification (ablation study)

## Reproduce locally

```bash
npm install
npm run evaluate              # full 5-engine benchmark
npm run evaluate:ablation       # rule vs ML vs fusion
npm run cdss:pipeline           # dataset expand + ML train + evaluate
# Reports: benchmarks/results/latest.json, ablation-latest.json
```

## Expected results (reference run, n=509)

| Engine | Accuracy | Macro-F1 |
|--------|----------|----------|
| ml-interpretable-v1 | 95.5% | 0.917 |
| rule-engine-v3 | 95.5% | 0.914 |
| cdss-dual-track-v1 | 95.5% | 0.914 |

The fusion system provides **ADR taxonomy categories**, **evidence levels** (deterministic vs probabilistic), and **prevention actions** in addition to classification metrics.

Run `npm run evaluate` after any rule or model change and commit updated `benchmarks/results/latest.json` for reproducibility.

## Limitations

- Synthetic + curated set — not representative of all TCM practices or real ADR incidence
- Expert labels are demo consensus, not multi-rater clinical study
- ML weights calibrated on this benchmark — retrain before production use
- ADR high-risk proxy uses `needs_revision` label, not confirmed clinical ADR events

See also: `docs/PAPER_METHODOLOGY.md`
