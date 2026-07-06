# Paper Methodology — HAR-CDSS

**Title (ZH):** 融合专家知识规则与可解释机器学习的草药不良反应预防：一个临床决策支持系统原型的设计与评估  

**Title (EN):** Integrating Expert Knowledge Rules with Interpretable Machine Learning for Herb Adverse Reaction Prevention: Design and Evaluation of a Clinical Decision Support System Prototype

---

## 1. Problem & Motivation

Traditional Chinese medicine (TCM) pharmacy workflows rely on pharmacist expertise to detect incompatible herb combinations (十八反/十九畏), dosage risks, and population-specific contraindications. Pure rule systems miss latent patterns; pure ML models lack clinical trust. **HAR-CDSS** combines both in a dual-track architecture for **adverse reaction prevention (ADR prevention)**.

## 2. System Architecture

```
Prescription Input
       │
       ├─► Track 1: Expert Rule Engine (rule-engine-v3)
       │         → Deterministic alerts (十八反, 十九畏, dosage, contraindications)
       │
       ├─► Track 2: Interpretable ML (ml-interpretable-v1)
       │         → Feature vector → Linear logistic → Risk probability + attributions
       │
       └─► Fusion (cdss-dual-track-v1)
                 → Rule hard-override + ML probability blend → Joint decision + ADR report
```

### ADR Taxonomy (`server/config/adr-taxonomy.json`)

| ID | Category | Evidence |
|----|----------|----------|
| ADR-C1 | 配伍禁忌 | Deterministic |
| ADR-C2 | 剂量毒性风险 | Deterministic |
| ADR-C3 | 病证禁忌 | Rule-based |
| ADR-C4 | 特殊人群风险 | Rule-based |
| ADR-C5 | ML 潜在风险 | Probabilistic |

## 3. Methods

### 3.1 Expert Rules
- Configurable JSON rules (`server/config/tcm-rules.json`)
- Checks: 十八反, 十九畏, per-herb dosage bounds, ratio constraints, contraindication keywords

### 3.2 Interpretable ML
- Hand-crafted features (10 dimensions): herb count, dosage flags, 18fan/19wei, incompatible pairs, licorice ratio, age groups, warm/cold mix
- Linear logistic classifier with **feature attribution** (not black-box deep learning)
- Weights trained via `scripts/train-ml-weights.js`

### 3.3 Fusion Policy
- Weight: 55% rule score + 45% ML score
- Hard override: 十八反/十九畏 always → `需修改`
- Output: `adrPrevention` block with risk score, categories, prevention actions

## 4. Dataset

| Property | Value |
|----------|-------|
| Name | TCM-Prescription-Review-Expanded-v1 |
| Size | n=509 (24 curated + 485 synthetic) |
| Labels | `approved`, `review`, `needs_revision` |
| License | CC-BY-4.0 |
| File | `benchmarks/prescription-review-dataset-expanded.json` |

Synthetic cases generated with controlled ADR triggers for benchmark coverage.

## 5. Evaluation

### 5.1 Full Benchmark (5 engines)
```bash
npm run evaluate
```
Engines: baseline-naive, baseline-keyword, rule-engine-v3, ml-interpretable-v1, cdss-dual-track-v1

### 5.2 Ablation Study
```bash
npm run evaluate:ablation
```
Variants: rule-only, ml-only, fusion-cdss

### 5.3 Metrics
- **Accuracy** — 3-class label match
- **Macro-F1** — averaged over approved/review/needs_revision
- **ADR High-Risk F1** — binary detection of `needs_revision` (proxy for high ADR risk)
- **Sensitivity / Specificity** — for ADR high-risk class

## 6. Expected Results (reference, n=509)

| Engine | Accuracy | Macro-F1 |
|--------|----------|----------|
| ml-interpretable-v1 | ~95.5% | ~0.917 |
| rule-engine-v3 | ~95.5% | ~0.914 |
| cdss-dual-track-v1 | ~95.5% | ~0.914 |

See `benchmarks/results/latest.json` and `benchmarks/results/ablation-latest.json`.

## 7. Paper Sections Mapping

| Section | System Artifact |
|---------|-----------------|
| Introduction | Problem statement above |
| Related Work | `docs/LITERATURE.md` |
| System Design | `cdssEngine.js`, `adrTaxonomy.js`, architecture diagram |
| Implementation | Rule config, ML weights, API routes |
| Evaluation | Research Hub UI, benchmark scripts |
| Discussion | Limitations below |
| Ethics | `docs/ETHICS.md` |

## 8. Limitations

- Synthetic + curated benchmark — not multi-center clinical validation
- Expert labels are demo consensus, not multi-rater κ study
- ML is linear — may miss non-linear interactions
- Prototype only — not for unsupervised clinical deployment

## 9. Reproducibility

```bash
npm install
npm run cdss:pipeline    # expand dataset → train ML → evaluate
npm run test:server
npm run evaluate:ablation
```

API endpoints:
- `POST /api/prescriptions/cdss` — clinical UI
- `POST /api/research/cdss` — research route
- `POST /api/research/ablation` — ablation study
- `GET /api/research/meta` — system metadata for paper
