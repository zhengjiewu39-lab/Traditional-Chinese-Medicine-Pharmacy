# Contributing

This repository is a **pharmacist-supervised, patient-participating AI TCM pharmacy research prototype** (synthetic data only).

## Getting started

1. Fork and clone the repository
2. `npm install`
3. `cp .env.example .env` (optional)
4. `npm run dev` — frontend :3000 + API :3002

## Checks before a PR

```bash
npm run lint
npm run test:server
npm run ai:evaluate
CI=true npm run build
```

Live-model comparison is explicit and optional: `npm run ai:evaluate:live` / `npm run ai:evaluate:compare` (requires a real provider). Do not commit invented live scores.

## Scope

- **Primary:** prescription workflow, clarification, education approval, follow-up, inventory/traceability
- **Archived:** `archive/` (simulation, operations agent, membership/org demos, legacy CDSS). Restore via git tags `v1.0.0-research` or `legacy-cdss-v1`.

Do not commit real patient data, credentials, or `benchmarks/ai-review/results-live/*.json`.
