# Literature & References

## TCM compatibility and prescribing

1. **Chinese Pharmacopoeia** — national standards for TCM materials and compatibility principles (*Shi Ba Fan*, *Shi Jiu Wei*).
2. **WHO Traditional Medicine Strategy** — framework for safe integration of traditional medicine (WHO, 2014–2023).
3. **Zhang et al.** — research on TCM prescription pattern analysis and herb compatibility networks (representative bibliometric/clinical studies in J. Ethnopharmacol.).

## Clinical decision support & pharmacy informatics

4. **Sittig et al., 2018** — guidance on clinical decision support implementation and safety (JAMIA).
5. **ISO/TS 82304-2** — health software — Part 2: health apps quality and reliability considerations.

## Explainable AI in healthcare

6. **Rudin, 2019** — "Stop explaining black box models for high stakes decisions" (*Nature MI*) — motivates interpretable models.
7. **Lundberg & Lee, 2017** — SHAP values for feature attribution (our ML module uses simpler linear attribution for transparency).

## This project's approach

- **Rule engine:** Explicit, auditable rules aligned with classical compatibility lists and dosage heuristics.
- **ML module:** Lightweight linear classifier over **hand-crafted clinical features** (not a black-box deep model) to support explainability.
- **Evaluation:** Public synthetic benchmark with pharmacist-style labels for reproducible comparison.

## Paper draft outline (for future submission)

1. Introduction — TCM pharmacy workflow digitization gap  
2. Related work — CDSS, TCM informatics, XAI  
3. Methods — configurable rule engine, feature-based ML, benchmark protocol  
4. Experiments — baselines vs rule vs ML on Mini-v1 dataset  
5. Ethics & limitations — synthetic data, human-in-the-loop requirement  
6. Conclusion — open-source reproducible pipeline  

See also: [docs/ETHICS.md](./ETHICS.md), [docs/EVALUATION.md](./EVALUATION.md).
