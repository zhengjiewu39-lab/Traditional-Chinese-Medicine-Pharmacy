# Evaluation Methodology

## Benchmark dataset

**File:** `benchmarks/prescription-review-dataset.json`  
**Name:** TCM-Prescription-Review-Mini-v1  
**Size:** 24 synthetic cases  
**License:** CC-BY-4.0  

Each case includes:

- De-identified prescription text
- Diagnosis / patient demographics (synthetic)
- **Expert label:** `approved` | `review` | `needs_revision`
- Rationale (pharmacist-style annotation)

## Systems compared

| Engine | Description |
|--------|-------------|
| `baseline-naive` | Always approves non-empty prescriptions (lower bound) |
| `baseline-keyword` | Keyword / regex scan for dangerous terms and large doses |
| `rule-engine-v3` | Configurable JSON rules: dosage, 十八反, 十九畏, ratios |
| `ml-interpretable-v1` | Linear model over hand-crafted features + attribution |

## Metrics

- **Accuracy** — exact label match
- **Macro Precision / Recall / F1** — averaged over 3 classes
- **Binary F1 (needs_revision)** — safety-critical detection of prescriptions requiring modification

## Reproduce locally

```bash
npm install
npm run evaluate
# Report written to benchmarks/results/latest.json
```

## Expected results (reference run)

On the mini benchmark (n=24), the rule engine typically outperforms both baselines on macro-F1 and revision detection. The ML model provides comparable ranking with **explainable feature attributions** (see `explainability.topContributions` in API responses when using ML mode).

Run `npm run evaluate` after any rule or model change and commit updated `benchmarks/results/latest.json` for reproducibility.

## Limitations

- Small synthetic set — not representative of all TCM practices
- Expert labels are demo consensus, not multi-rater clinical study
- ML weights are calibrated on this benchmark only — retrain before production use
