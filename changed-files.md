# Changed files

Branch: `refactor/digital-pharmacy-service`  
Baseline: `0790ca91443916b268c766bb87b66526b4aaadd7`  
Impact map commit (before application edits): `bb1ac674766372b71d9aac0b14d123c4a9295fd8`

## Added

- `impact-map.md` — written and committed before application edits
- `archive/` — recoverable copies of simulation, operations-agent, legacy demos, legacy CDSS
- `server/db/sqlite.js`, `server/db/migrateFromJson.js`
- `server/workflow/clinicalFacts.js`, `clarificationService.js`, `educationService.js`, `followUpService.js`, `inventoryDeduct.js`
- `server/research/evaluationRoutes.js`, `observationStub.js`
- `server/__tests__/digitalPharmacy.test.js`
- `scripts/ai/evaluate-compare.js`
- Patient/staff UI: `FollowUpBoard.js`, `PatientProfile.js`, `ClarificationRespond.js`, `research/Evaluation.js`
- This file, `migration-report.md`, `validation-report.md`, `remaining-blockers.md`

## Modified (active app)

- Workflow, schemas, RBAC, AI routes, patient portal, orchestrator, ruleTrack, evidence retriever, suggestion/learning, evaluate-live
- `server.js`, `package.json`, `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `README.md`
- Frontend: `App.js`, `navStructure.js`, `Workbench.js`, `Layout.js`, `aiApi.js`, locales

## Moved (not deleted from git)

See `archive/README.md`. Verified tags (`git tag -l`): `v1.0.0-research`, `legacy-cdss-v1`.

## Not claimed complete

- Live A/B/C/D model scores (no API key in this environment)
- Pharmacist gold labels / citation-support ratings
- Full POS field cut-over into SQLite
- Unused i18n keys that still name archived simulation pages
