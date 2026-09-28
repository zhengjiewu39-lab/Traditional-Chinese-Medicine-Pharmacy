# Reproducibility

## Install

```bash
cd chinese-medicine-pharmacy
npm ci
```

## Paper results (frozen matrix, one command)

```bash
npm run paper:all      # full run → paper/results, paper/tables, paper/figures (runtime in manifest.json)
npm run paper:quick    # smoke run (3 calibration / 8 test seeds, LHS N = 24) → *-quick folders, git-ignored; used in CI
node scripts/paper/run-all.js --stage main,ablation   # selected stages (main needs calibrate first)
```

The inputs are `paper/config/scenario-matrix.json` (v2.0.0) and `paper/config/seeds.json`. Both are frozen; `npm run paper:matrix` refuses to overwrite them without `--force` and archives a superseded matrix version in `paper/config/archive/`. Their SHA-256 hashes, the git commit, Node version, bootstrap settings and the audited-run count per stage are stored in `paper/results/manifest.json`. Protocol: [experiment-protocol.md](experiment-protocol.md).

## Exact reproduction of the default experiment

```bash
REPLICATES=10 npm run research:reproduce   # default 30; CI uses 10
```

This runs all five policies on the default scenario (M5 structure) with common random numbers and stores one experiment group. It then re-runs every replicate and requires **every metric** to match exactly (canonical JSON comparison). The exit code is non-zero on any mismatch.

```bash
npm run research:reproduce -- --latest
```

This re-runs the most recent stored experiment and requires an exact match. It fails if the engine version or scenario hash differs: that would be a configuration re-run, not a reproduction.

## Exact re-run through the API

1. Start the API: `npm run server`.
2. In the UI, choose **Experiment Archive → Re-run exact experiment**, or call `POST /api/simulation/experiments/:id/rerun-exact`. Jobs are queued and return 202 with a job id; poll `GET /api/simulation/jobs/:jobId`.
3. The response reports `scenarioHashMatches`; the stored re-run records `rerunOf` and `sourceScenarioHash`.

## Builds without `.git`

Set `SOURCE_COMMIT=<7–64 hex characters>` so stored experiments carry the source commit (`gitCommitSource: env:SOURCE_COMMIT`). An invalid value is recorded as `invalid-SOURCE_COMMIT`; without either source it is `unknown`.

## Checks

```bash
npm run simulation:test
npm run lint
CI=true npm run build
npm audit --omit=dev --audit-level=high
```

Each stored experiment includes:

- scenario JSON, `scenarioHash` and schema version
- `policyId`, `policyVersion`, `policyParams`
- `replicateSeeds`
- engine version, git commit and its source, package-lock SHA-256, Node version
- raw replicate metrics and the aggregated summary (mean, SD, 95% CI)
- for groups, paired bootstrap comparisons ([data-dictionary.md](data-dictionary.md))
