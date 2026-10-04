# Validation report

Research prototype only. Passing tests is not clinical validation. This build can be described as a Traditional-Chinese-Medicine digital-pharmacy AI research prototype. It is not a validated AI active-clarification system.

Checked after the 2026-10-03 d14c1a9 gate-repair pass (local Node may be newer than `engines.node`; CI uses Node 20).

| Layer | What it is | This pass |
|---|---|---|
| Code implementation | Functions and API routes in the repo | Required-fact gate, deskNotes policy, research drafts, case access, search kill-switch, workbench/list counts |
| Automated tests | `npm run verify:pharmacy` / `test:server` / `lint` | 100/100, 148/148, lint 0 warnings |
| Field / live-model check | Paid model or clinic path | **Not re-run**. Earlier self-reported 500-person shadow screen and 7-role login walk remain repository notes only |
| Professional review | Independent labels | **not_evaluated** — worksheet still blank |

| Check | Result |
|---|---|
| `npm run verify:pharmacy` | 101/101 pass |
| `npm run test:server` | 149/149 pass (38 groups) |
| `npm run lint` | pass, 0 warnings |
| Live A/B/C/D | Not re-run this pass. Earlier overlay note stays **AI_MODE=shadow**, not promoted. Clinical labels / effect remain `not_evaluated`. |
| 500-person live screen | Repository self-report only; not independently re-run here. Not a clinical validation. |
| Browser role E2E | Earlier login walk only. Approve / dispense / weigh / concurrency were not re-walked in this pass. |
| Independent expert labels | **not_evaluated** — worksheet `benchmarks/ai-review/expert-label-worksheet.md` is blank; pack `expertReviewStatus` is still `unreviewed` |

Mock compare only tests that the ask→script-answer→reanalyze loop runs and stays isolated. It does not support a model-effect or clinical-benefit claim. Do not assume D outperforms C.

## Completion marks

| Item | Has function | Wired into service | Automated test | Live model | Expert review |
|---|---|---|---|---|---|
| Dual-sign version binding | Yes | Yes | API tests | n/a | n/a |
| Replay append-only | Yes | Independent `replays` collection | Concurrent probes | n/a | n/a |
| Candidate confirm authorization | Yes | Bound patient or pharmacist; patient DTO only | Cross-patient 403/404, no write | n/a | n/a |
| Candidate confirm versions content | Yes | Hash/version/history; voids approval; rescreens | Approved-case pregnancy probe | n/a | n/a |
| Required safety questions gate approve | Yes | Current facts, not task `reviewed`; flag-only verify rejected | View then approve blocked; value+source+evidence then approve | n/a | n/a |
| Official desk notes isolation | Yes | Policy walks all model text; shadow stays in `shadowResult` | live/shadow/rules unsafe deskNotes | n/a | n/a |
| PubMed drafts vs clinical evidence | Yes | `researchDrafts`; drafts do not clear `no_evidence` | Title-only / irrelevant title probes | n/a | n/a |
| Case access on assist/summary | Yes | One `caseAccess` check + same list filter | Other-prescriber 403 on detail/assist/replay/list | n/a | n/a |
| Auto-search follows AI master switch | Yes | `allowedCapabilities` after input screen | rules / kill switch / injection call count 0 | n/a | n/a |
| Workbench risk and lane counts | Yes | SQL counts in authorized scope | A3 ≥ 1; risk filter before page | n/a | n/a |
| AI disable covers extract | Yes | `allowedModelProvider()` / `modelCallsAllowed()` | Provider call count 0 when off | **未验证** | n/a |
| Live unknown lots quarantined | Yes | Non-demo catalog rows are unverified and unusable | Unit probe | n/a | n/a |
| Interactive experiment loop | Yes | Cumulative burden; reanalyze after answers | mock + earlier 4-case smoke | smoke only; not promoted | unreviewed pack |

Case-path quantity decisions now read SQLite lots. JSON `inventory[].stock` is rebuilt from the lot roll-up. The SKU list is still a JSON catalog, so this is not a single-database inventory and not a real-dispensing go-live condition.

Independent professional labels were not filled. The worksheet is blank on purpose. `node scripts/ai/print-rater-pack.js` only prints visible facts for a human rater.

Fact extraction calls a model only when AI is enabled and the mode allows model calls. Heuristic output is labelled `heuristic_fallback`. History alone is not treated as current-negative liver impairment. Denying a candidate does not infer disease denial. Stopping questions is not approval. Marking a clarification `reviewed` is not a resolved fact.

`cases-v1.json` remains the engineering rule pack. The main clarification experiment is the frozen 500-case research snapshot built from existing synthetic patients. `cases-interactive-v1.json` (IT01–IT06) is archived for regression. Rule-derived `expected` is not a medical gold standard. Snapshot clinical labels stay `not_evaluated` / `unreviewed`.

## 500-case research console (this pass)

| Layer | Status | Note |
|---|---|---|
| Snapshot import | Implemented | One existing prescription per existing synthetic patient (`one-rx-per-patient-date-asc-id-asc@1`). Unlabeled init rows stay synthetic. Exceptions are listed, not dropped silently. |
| Interactive scenes | Implemented from known facts only | complete / omit-allergy or unknown-allergy / paraphrase. Missing allergy is not filled as none. Pregnancy, meds, and liver are not invented. |
| Shared engine | Implemented | Web jobs and `npm run ai:evaluate:compare` call `experimentEngine`. Groups A/B/C/D/RAG_off. Primary comparison D vs C. |
| Background jobs | Implemented | Persistent `researchJobs` / `researchJobResults`. Duplicate start returns the same job. Refresh does not drop results. Live 500 is not auto-started. |
| Researcher UI | Implemented | `/research/evaluation` dataset / config / run / single-case / results / export. Hidden facts only in authorized annotate view. |
| Isolation | Tested (mock) | Job does not change inventory or operational cases. Researcher list omits hidden scripts. |
| Mock | Tested | Isolated 1-scene A/C job in `digitalPharmacy.test.js`. |
| Real model 500 | **Not run** | Requires admin `allowLive`, `confirmLive`, and (if over cap) `confirmFullLive`. Do not treat as done. |
| Expert review | **unreviewed / not_evaluated** | No clinical accuracy, miss rate, or patient-benefit numbers. |
| Autonomous prescribe / auto-approve | Not added | Experiment cannot sign, dispense, set keys, or promote live. |
