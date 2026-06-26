# Ethics & Data Privacy

## Purpose and scope

This repository provides a **demonstration and research prototype** for TCM pharmacy workflow and prescription review assistance. It is **not** a certified medical device and **must not** be used as the sole basis for clinical decisions.

## Data used in this project

| Data type | Source | Privacy |
|-----------|--------|---------|
| Runtime store (`data/store.json`) | Local seed / user demo input | **Not committed** to git; stays on your machine |
| Benchmark dataset (`benchmarks/`) | **Synthetic**, de-identified prescriptions | Safe for public release (CC-BY-4.0) |
| Patient names in demo UI | Fictional (张三, 李四, etc.) | No real individuals |

We do **not** collect, transmit, or store real patient PHI in the public repository.

## Responsible use

1. **Human-in-the-loop**: Pharmacists and licensed clinicians must review all prescriptions before dispensing.
2. **Decision support only**: Rule engine and ML outputs are advisory; errors and omissions are possible.
3. **Regulatory compliance**: Operators must follow local pharmacy, TCM, and privacy laws (e.g., GDPR, HIPAA, PIPL as applicable).
4. **No training on private data without consent**: Do not commit real EHR exports or identifiable prescriptions.

## Risk summary

| Risk | Mitigation |
|------|------------|
| False negative (unsafe Rx approved) | Mandatory pharmacist review; conservative thresholds; benchmark monitoring |
| False positive (safe Rx blocked) | "Review" tier; override with audit log in production |
| Data leak from deployment | Encrypt data at rest; access control; no default public exposure of `/api` |
| Over-reliance on automation | README disclaimer; ethics doc; no auto-dispense without human approval |

## Privacy-by-design (recommended production settings)

- Store PHI in encrypted databases, not flat JSON files
- Enable authentication, RBAC, and audit logging for all prescription access
- Anonymize or aggregate data before research export
- Set retention policies and secure deletion for patient records

## Contact

Report ethical or security concerns via GitHub Issues (no PHI in issue text).
