# Contributing

Thank you for contributing to the **pharmacy supply resilience simulation** platform (synthetic data, research use only).

## Getting started

1. Fork and clone the repository
2. `npm install`
3. `cp .env.example .env` (optional; `.env.development` sets API URL for CRA)
4. `npm run dev` — frontend :3000 + API :3002

## Checks before a PR

```bash
npm run test:server
npm run verify:simulation
npm run build
```

Legacy prescription CDSS evaluation (optional): `npm run evaluate`

## Scope

- **Primary:** `server/simulation/`, `src/pages/simulation/`, reproducibility tests
- **Legacy demo:** existing prescription/CRM routes under `/legacy/*` — avoid expanding unless explicitly requested

Do not commit real patient data, credentials, or local experiment JSON under `data/simulation-experiments/`.
