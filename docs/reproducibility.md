# Reproducibility

## Install

```bash
cd chinese-medicine-pharmacy
npm install
```

## Paper results (frozen matrix, one command)

```bash
npm run paper:all      # full run, about 6–8 minutes → paper/results, paper/tables, paper/figures
npm run paper:quick    # smoke run (4 calibration / 10 test seeds, LHS N=24) → *-quick folders, git-ignored; used in CI
node scripts/paper/run-all.js --stage main,ablation   # selected stages only
```

The inputs are `paper/config/scenario-matrix.json` and `paper/config/seeds.json`. Both are frozen; `npm run paper:matrix` refuses to overwrite them without `--force`. Their SHA-256 hashes are stored in `paper/results/manifest.json`. See [simulate-checklist.md](simulate-checklist.md).

## Run default synthetic experiment (30 replicates)

```bash
npm run research:reproduce
```

## CLI demo (all five policies, 14 days)

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
npm run lint
CI=true npm run build
npm audit --audit-level=high
```

Each saved experiment includes: `scenario` JSON, `schemaVersion`, `policyId`, `policyVersion`, `replicateSeeds`, `gitCommitHash`, `engineVersion`, raw replicate results, and aggregated summary (mean, std, 95% CI).
