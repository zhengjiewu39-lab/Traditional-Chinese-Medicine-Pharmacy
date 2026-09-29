# AI review offline evaluation

> **Engineering evaluation on synthetic standardized cases. Not a clinical validation.**
> Mock-deterministic-v1 only (millisecond latency). Cases share the rule table. Do **not** cite 100% figures as live-AI accuracy or unseen-prescription sensitivity. No `results-live` report is committed.

- Benchmark: `tcm-ai-review-synthetic@1.0.0` (64 synthetic cases)
- Model: `mock-deterministic-v1` (deterministic mock provider), prompt `rx-screening@1.0.0#3ae9d440`
- Rule set: `tcm-rules@1.0.0+ai-safety-rules@1.0.0`; knowledge base: `tcm-pharmacy-synthetic-kb@1.0.0#3fb575be480e`
- Generated: 2026-09-28T21:46:00.444Z

| Metric | Value |
| --- | --- |
| Hard-risk recall (A3) | 100.0% (23 positives) |
| Hard-risk precision (A3) | 100.0% |
| Hard-stop code recall | 100.0% |
| False-alert rate on clean cases | 0.0% (8 clean cases) |
| Evidence citation completeness | 83.9% (52/62) |
| Abstention sensitivity / specificity | 100.0% / 100.0% |
| Abstain reason match | 100.0% |
| Unified output schema validity | 100.0% |
| Semantic schema validity (normal provider) | 100.0% |
| Rule–model disagreement rate | 2.1% (48 cases with model output) |
| Unsafe autonomous actions | 0 |
| Audit completeness | 100.0%; chain valid: true |
| Latency p50 / p95 / max (ms) | 1.21 / 3.46 / 307.45 |
| Tier agreement with expected | 100.0% |
| Cases meeting all expectations | 100.0% |

Evidence gaps (codes with no approved source): HERB_NOT_IN_RULESET, INJECTION_SUSPECTED.

## Safety gates

- PASS: unsafe autonomous actions = 0 (0)
- PASS: unified output schema validity = 100% (1)
- PASS: hard-risk recall = 100% (1)
- PASS: audit chain verifies (true)
- PASS: audit completeness = 100% (1)

## Expectation failures

- none

## Limitations

- Cases are synthetic and were written from the same rule tables the rule track implements, so recall on them measures implementation fidelity, not clinical sensitivity.
- The semantic track uses the deterministic mock provider; metrics say nothing about a real language model.
- No pharmacist, patient or real prescription was involved. These numbers cannot support any clinical claim.
