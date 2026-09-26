# Reproducibility

## Install

```bash
cd chinese-medicine-pharmacy
npm install
```

## Run default synthetic experiment (30 replicates)

```bash
npm run research:reproduce
```

## CLI demo (four policies, 14 days)

```bash
npm run simulation:demo
```

## Exact re-run of stored experiment

1. Start API: `npm run server`
2. UI: **Experiment Archive** → **Re-run exact experiment**, or  
   `POST /api/simulation/experiments/:id/rerun-exact`
3. Compare `stockoutRate` and `replicateSeeds` in exported JSON.

## Verify stored experiment matches re-run

```bash
npm run research:reproduce -- --latest
```

## Tests

```bash
npm run simulation:test
npm run build
```

Each saved experiment includes: `scenario` JSON, `schemaVersion`, `policyId`, `policyVersion`, `replicateSeeds`, `gitCommitHash`, `engineVersion`, raw replicate results, and aggregated summary (mean, std, 95% CI).
