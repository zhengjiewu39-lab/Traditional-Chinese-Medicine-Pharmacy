# TCM Chain Pharmacy Management System

A full-stack **Traditional Chinese Medicine (TCM) chain pharmacy platform** built with React and Express. It connects the entire clinical-to-dispensing workflow—prescribing, AI-assisted review, pickup codes, smart POS checkout, inventory, patients, and operations analytics—in one cohesive system.

Designed for modern TCM retail and clinic-pharmacy scenarios where **doctors, pharmacists, cashiers, and patients** need a shared, accurate, and efficient experience.

---

## Highlights

| Capability | Description |
|------------|-------------|
| **End-to-end prescription flow** | Doctor workbench → AI/pharmacist review → pickup code → POS prefill → inventory deduction → completed |
| **Smart POS (Billing)** | Scan or enter pickup code; cart auto-fills from approved prescriptions |
| **TCM Review Engine v3** | Configurable JSON rules: dosage, *Shi Ba Fan* / *Shi Jiu Wei*, ML comparison, benchmarks |
| **Persistent backend** | JSON-backed store with full REST CRUD (inventory, orders, patients, prescriptions, billing) |
| **Operations dashboard** | Live KPIs: today’s sales, pending reviews, pickup queue, low-stock alerts, benchmark snapshot |
| **Research evaluation hub** | In-app benchmark charts, 4-engine compare playground, public dataset viewer, ethics docs |
| **Patient pickup portal** | Patients track status with a 6-digit pickup code |
| **Doctor workbench** | Select patient, apply classic formula templates, reuse history, issue pickup codes |

---

## Demo workflow

```
Doctor Workbench  →  Prescription Review  →  Pickup Code (TCM######)
        ↓                                        ↓
Patient Pickup Query                    Smart POS (Billing)
        ↓                                        ↓
              Operations Dashboard (live stats)
```

**Sample pickup codes** (after seed data loads):

| Code | Patient | Status |
|------|---------|--------|
| `TCM128456` | Zhang San | Ready for pickup |
| `TCM339812` | Li Si | Ready for pickup |

---

## Tech stack

- **Frontend:** React 18, Material UI 5, React Router 6, Recharts, Axios
- **Backend:** Express 5, modular routes, file-based persistence
- **Review logic:** Configurable rule engine + interpretable ML classifier + public benchmark

---

## Research, evaluation & reproducibility

### Public benchmark dataset

`benchmarks/prescription-review-dataset.json` — **24 synthetic prescriptions** with expert labels (`approved` / `review` / `needs_revision`), licensed **CC-BY-4.0**. No real patient data.

### Run evaluation (compare engines)

```bash
npm run test:server    # unit tests
npm run evaluate       # writes benchmarks/results/latest.json
```

**Reference results** (TCM-Prescription-Review-Mini-v1, n=24):

| Engine | Accuracy | Macro-F1 | Binary-F1 (needs_revision) |
|--------|----------|----------|----------------------------|
| **rule-engine-v3** | **0.75** | **0.725** | **0.818** |
| ml-interpretable-v1 | 0.46 | 0.39 | 0.70 |
| baseline-keyword | 0.38 | 0.24 | 0.20 |
| baseline-naive | 0.38 | 0.24 | 0.20 |

### Configurable rules

Edit `server/config/tcm-rules.json` (herb dosage, 十八反/十九畏, thresholds). Override path:

```bash
TCM_RULES_PATH=./my-rules.json npm run server
```

### ML + explainability

`server/config/ml-weights.json` — linear model with **feature attributions** (`explainability.topContributions`). Compare via API:

```bash
curl -X POST 'http://localhost:3002/api/research/analyze?engine=ml-interpretable-v1' \
  -H 'Content-Type: application/json' \
  -d '{"prescription":"甘草10g，甘遂5g","patientAge":50}'
```

### Docker

```bash
docker compose up --build
```

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs tests, benchmark evaluation, and Docker build on every push/PR.

### Documentation

| Doc | Topic |
|-----|-------|
| [docs/EVALUATION.md](docs/EVALUATION.md) | Metrics & benchmark protocol |
| [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) | Step-by-step reproduction |
| [docs/ETHICS.md](docs/ETHICS.md) | Privacy, risks, responsible use |
| [docs/LITERATURE.md](docs/LITERATURE.md) | References & paper outline |

---

## Quick start

### Requirements

- Node.js 16+
- npm 8+

### Install & run

```bash
git clone https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy.git
cd Traditional-Chinese-Medicine-Pharmacy
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:3002 |

If port 3000 is busy (e.g. another project):

```bash
PORT=3003 npm start
# in another terminal:
npm run server
```

### Demo accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Pharmacist | `pharmacist` | `pharm123` |

> **Demo vs production:** The accounts above are enabled only when `NODE_ENV !== 'production'` or `ALLOW_DEMO_AUTH=true`. In production, set `TCM_JWT_SECRET`, configure users via `TCM_USERS_JSON` / `TCM_*_PASSWORD`, and restrict `CORS_ORIGIN`. Copy `.env.example` to `.env` for local setup.

---

## Main modules

| Route | Module |
|-------|--------|
| `/dashboard` | Operations dashboard (real API data) |
| `/doctor` | Doctor workbench |
| `/pickup` | Patient pickup status |
| `/billing` | Smart POS / cashier |
| `/prescriptions/review` | AI prescription review |
| `/research` | Research hub — benchmark results, engine compare, dataset, ethics |
| `/inventory` | Inventory & low-stock alerts |
| `/patients` | Patient records |
| `/customers` | Customer & membership |
| `/orders` | Order management |

Additional UI modules: organization HR, distribution, traceability, quality, compliance, herbal knowledge base, pharmacist training, membership, prescription templates & analytics.

---

## Project structure

```
chinese-medicine-pharmacy/
├── src/
│   ├── pages/           # Feature pages
│   ├── components/      # Layout & shared UI
│   ├── contexts/        # Auth context
│   └── services/        # API client
├── server/
│   ├── routes/          # REST endpoints
│   ├── services/        # Review engine, workflow, stats
│   └── data/            # Seed & store loader
├── benchmarks/          # Public evaluation dataset & results
├── docs/                # Ethics, evaluation, literature
├── scripts/             # evaluate-review.js
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/   # CI
```

---

## API overview

Base URL: `http://localhost:3002/api`

| Area | Examples |
|------|----------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Prescriptions | `POST /prescriptions/analyze`, `POST /prescriptions/:id/approve`, `GET /prescriptions/pickup/:code` |
| Billing | `POST /billing/checkout` |
| Inventory | `GET /inventory`, `GET /inventory/alerts`, CRUD |
| Dashboard | `GET /dashboard/overview` |
| Research | `GET /research/dataset`, `GET /research/results`, `POST /research/evaluate`, `POST /research/compare`, `POST /research/analyze?engine=` |

> **Note:** After updating `server.js` or routes, restart the API (`npm run server`) so new endpoints (e.g. `/research/*`) are loaded.

Data persists in `data/store.json` (created on first run from seed data).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + React dev server |
| `npm run server` | API only (port 3002) |
| `npm start` | Frontend only (port 3000) |
| `npm run build` | Production build |
| `npm run test:server` | Node unit tests (review engine) |
| `npm run evaluate` | Benchmark all engines → JSON report |

---

## Ethics & privacy

- Benchmark data is **synthetic** and safe to publish
- Runtime patient data stays local (`data/store.json`, gitignored)
- Prescription review is **decision support only** — mandatory human pharmacist review
- See [docs/ETHICS.md](docs/ETHICS.md) for risks, mitigations, and production privacy guidance

---

## Disclaimer

This system is intended for **demonstration, education, and research prototyping**. It is **not** a certified medical device. AI/rule/ML outputs do not replace licensed pharmacist or physician judgment. Always follow local regulations for dispensing TCM products.

---

## License

MIT — see [LICENSE](LICENSE).

## Security & contributing

- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow

---

## Author

Maintained by [zhengjiewu39-lab](https://github.com/zhengjiewu39-lab).

For issues or suggestions, please open a GitHub issue.
