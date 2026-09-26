# Reproducibility Guide

## Prerequisites

- Node.js 20+
- npm 8+
- (Optional) Docker 24+

## Quick reproduce

```bash
git clone https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy.git
cd Traditional-Chinese-Medicine-Pharmacy
npm install

# 1. Unit tests
npm run test:server

# 2. Benchmark evaluation
npm run evaluate

# 3. Start API
npm run server
curl http://localhost:3002/api/health
```

## Docker reproduce

```bash
docker compose up --build
curl http://localhost:3002/api/health
```

## Configuration

| Env variable | Default | Purpose |
|--------------|---------|---------|
| `PORT` | 3002 | API port |
| `TCM_RULES_PATH` | `server/config/tcm-rules.json` | Override rule library |
| `TCM_ML_WEIGHTS_PATH` | `server/config/ml-weights.json` | Override ML weights |

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs on every push/PR to `main`:

1. `npm run test:server`
2. `npm run evaluate`
3. Docker build

Artifacts: `benchmarks/results/latest.json`

## File checksums

After evaluation, compare your `benchmarks/results/latest.json` `evaluatedAt` timestamp and engine metrics with CI artifacts for exact reproducibility.
