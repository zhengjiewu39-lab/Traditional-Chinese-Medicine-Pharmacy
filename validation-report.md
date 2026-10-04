# Validation report

Research prototype only. Passing tests is not clinical validation. This build can be described as a Traditional-Chinese-Medicine digital-pharmacy AI research prototype. It is not a validated AI active-clarification system.

Checked after the 2026-10-04 `research-engine@2.0.0` repair (local Node may be newer than `engines.node`; CI uses Node 20). Old `50cb7a6` job rows stay historical and are not a new-protocol formal analysis.

| Layer | What it is | This pass |
|---|---|---|
| Code implementation | Functions and API routes in the repo | Required-fact gate, deskNotes policy, research drafts, case access, search kill-switch, workbench/list counts |
| Automated tests | `npm run verify:pharmacy` / `test:server` / `lint` | 100/100, 148/148, lint 0 warnings |
| Field / live-model check | Paid model or clinic path | **Not re-run**. Earlier self-reported 500-person shadow screen and 7-role login walk remain repository notes only |
| Professional review | Independent labels | **not_evaluated** — worksheet still blank |

| Check | Result |
|---|---|
| `npm run verify:pharmacy` | included in `test:server` |
| `npm run test:server` | 168/168 pass (40 groups) |
| `npm run lint` | pass, 0 warnings |
| `npm run build` | production frontend compiled |
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
| Snapshot import | Implemented (dataset 1.1.0) | Selection is by **base case**, then scenes. Unanalyzable herbs/units/dose counts stay exceptions. Encounter time is the frozen `issuedAt`. Same-content snapshots are not overwritten. |
| Interactive scenes | Implemented from known facts only | complete / omit-allergy or unknown-allergy / paraphrase. Askable fields have source-or-unknown scripts. Missing allergy is not filled as none. |
| Shared engine | Implemented `research-engine@2.0.0` | Web and CLI share `capabilityPolicy`. rules never calls a model; mock is offline; real pauses when the kill-switch or `allowLive` is off. |
| Background jobs | Implemented | Per-researcher idempotency; merge-save keeps cancel; actual model-call reserve; corrupt snapshot fails closed; retries keep the original row. |
| Researcher UI | Implemented | `all` engineering split; selected-case single run; results bound to `jobId`; reference-fact view (not expert labeling). Admin research quotas are on the governance desk. |
| Isolation | Tested | Two researchers with the same config get separate jobs. Hidden scripts stay out of the default list. |
| Mock | Tested | Repair suite in `researchEngine.test.js` plus isolated digital-pharmacy job. Offline A/C/D on 500 bases × 1500 scenes × 3 groups = 4500 rows, 0 engineering failures. Encounter freeze: expiry hits 0; all 1500 scenes are `staleAtEvaluationNow`. A: A2=1017 / A3=483. C and D remain identical (A1=372 / A2=645 / A3=483). This is not a live-model result and does not show D > C. |
| Real model 500 | **Not run** | `maxCasesLive` is a hard cap. `confirmFullLive` is only an extra confirm below that cap. Do not treat as done. |
| Expert review | **unreviewed / not_evaluated** | No clinical accuracy, miss rate, or patient-benefit numbers. |
| Autonomous prescribe / auto-approve | Not added | Experiment cannot sign, dispense, set keys, change dose, or promote live. |
