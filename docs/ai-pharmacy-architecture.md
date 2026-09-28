# Pharmacist-governed AI pharmacy architecture

Working paper title: *Design and Technical Validation of a Pharmacist-Governed Agentic AI Platform for Traditional Chinese Medicine Pharmacy: A Synthetic Case and Digital-Twin Study.*

This is a research prototype. AI does not independently diagnose, prescribe, or approve prescriptions. All demonstration data are synthetic.

## Layers

```text
UI (task boards, pharmacist review, patient confirmation)
  → HTTP (schema, RBAC, rate limits, audit)
    → workflowService + prescriptionStateMachine
      → three-track AI (rules → approved RAG → constrained LLM)
      → operationsAgent + digitalTwinBridge (ERRRA, read-only vs live inventory)
    → append-only audit chain
```

## Innovation claims (technical, not clinical)

1. Hard rules, RAG evidence, and LLM semantics run as three tracks; the model cannot lower a hard-rule tier.
2. Risk-adaptive autonomy (A0–A3) with forced abstention.
3. Dual loops: pharmacist professional review and patient informed participation.
4. Tamper-evident audit chain of AI and human decisions.
5. Operations proposals evaluated on the digital twin before any business draft is created.
6. Pharmacist overrides become versioned offline evaluation data; there is no online self-training.

## What this system does not claim

- AI is better than a real pharmacist.
- AI can prescribe autonomously.
- The system reduced real adverse reactions.
- Synthetic results represent real clinical effect.
- The system is ready to deploy in a real pharmacy.
