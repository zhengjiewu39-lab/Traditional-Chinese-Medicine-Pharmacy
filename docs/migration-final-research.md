# Final research migration plan

## Product identity (sole research scope)

**CN:** 社区药房药品可及性与供应韧性仿真平台  
**EN:** Community Pharmacy Access and Supply Resilience Simulator  

Legacy HAR-CDSS, prescriptions, patients, POS, CRM → **`/legacy/*` only** (not default nav, not paper claims).

## File mapping

| Area | Action |
|------|--------|
| `server/simulation/rng.js` | Keep; **`seededRandom.js`** re-exports (canonical import) |
| `server/simulation/*` | Extend schema, metrics, policies, experiment metadata |
| `src/pages/simulation/*` | Overview, Scenario, Strategies, Run, Results, Archive, Reproducibility, Documentation |
| `src/pages/ResearchHub.js` | Legacy banner (label leakage, no clinical F1 claims) |
| `docs/methodology.md` | Rewrite/extend |
| `docs/assumptions.md`, `reproducibility.md`, `limitations.md`, `legacy-cdss.md`, `paper-outline.md` | **New** |
| `docs/legacy-cdss/*` | Archived prescription CDSS papers (not default docs) |
| `README.md` | Public-health simulation first paragraph |

## Phases

1. Migration plan (this file)  
2. Simulation core + git commit in experiments + exact re-run API  
3. Metrics (priority stockouts, recovery, inequality) + policy IDs  
4. UI/nav/i18n + legacy disclaimers  
5. npm scripts + reproduction CLI  
6. Tests + build + demo run  

No deletion of legacy application code; routes remain under `/legacy/*`.
