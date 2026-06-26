# TCM Chain Pharmacy Management System

A full-stack **Traditional Chinese Medicine (TCM) chain pharmacy platform** built with React and Express. It connects the entire clinical-to-dispensing workflow—prescribing, AI-assisted review, pickup codes, smart POS checkout, inventory, patients, and operations analytics—in one cohesive system.

Designed for modern TCM retail and clinic-pharmacy scenarios where **doctors, pharmacists, cashiers, and patients** need a shared, accurate, and efficient experience.

---

## Highlights

| Capability | Description |
|------------|-------------|
| **End-to-end prescription flow** | Doctor workbench → AI/pharmacist review → pickup code → POS prefill → inventory deduction → completed |
| **Smart POS (Billing)** | Scan or enter pickup code; cart auto-fills from approved prescriptions |
| **TCM Review Engine v2** | Dosage checks, *Shi Ba Fan* (十八反) / *Shi Jiu Wei* (十九畏), contraindications, scoring |
| **Persistent backend** | JSON-backed store with full REST CRUD (inventory, orders, patients, prescriptions, billing) |
| **Operations dashboard** | Live KPIs: today’s sales, pending reviews, pickup queue, low-stock alerts |
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
- **Review logic:** Rule-based TCM engine (dosage, compatibility, demographics)

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

---

## Main modules

| Route | Module |
|-------|--------|
| `/dashboard` | Operations dashboard (real API data) |
| `/doctor` | Doctor workbench |
| `/pickup` | Patient pickup status |
| `/billing` | Smart POS / cashier |
| `/prescriptions/review` | AI prescription review |
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
├── data/                # Runtime store (auto-created, gitignored)
├── server.js            # API entry
└── package.json
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

Data persists in `data/store.json` (created on first run from seed data).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + React dev server |
| `npm run server` | API only (port 3002) |
| `npm start` | Frontend only (port 3000) |
| `npm run build` | Production build |

---

## Disclaimer

This system is intended for **demonstration, education, and internal pharmacy management prototyping**. AI prescription review is a **decision-support tool** and does not replace licensed pharmacist or physician judgment. Always follow local regulations for dispensing TCM products.

---

## License

MIT

---

## Author

Maintained by [zhengjiewu39-lab](https://github.com/zhengjiewu39-lab).

For issues or suggestions, please open a GitHub issue.
