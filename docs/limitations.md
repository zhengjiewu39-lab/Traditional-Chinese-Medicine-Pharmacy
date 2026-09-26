# Limitations

- **No real data:** No real patients, prescriptions, pharmacy transactions, ADR reports, or public-health outcomes are used in the default research workflow.
- **Simulation-only inference:** Results describe behaviour inside the configured synthetic network. They must not be extrapolated to real cities, health systems, or policy decisions without independent validation.
- **Not for dispensing or care:** The platform must not be used for clinical decision-making, dispensing, billing, or real-world resource allocation.
- **Policy labels:** Strategy names describe algorithmic heuristics in silico, not “clinically optimal” or “public-health optimal” policies.
- **Legacy Demo:** Prescription rule benchmarks under `/legacy/research` suffer from **label leakage** (rules generate labels used for evaluation). Those metrics are not evidence of clinical effectiveness.
