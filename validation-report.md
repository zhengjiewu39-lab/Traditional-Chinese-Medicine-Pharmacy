# Validation report

Research prototype only. Passing tests is not clinical validation. This build can be described as a Traditional-Chinese-Medicine digital-pharmacy AI research prototype. It is not a validated AI active-clarification system.

Checked after the 2026-10-03 integrity pass (local Node may be newer than `engines.node`; CI uses Node 20).

| Check | Result |
|---|---|
| `npm run verify:pharmacy` | 94/94 pass |
| `npm run test:server` | 142/142 pass (37 groups) |
| `npm run lint` | pass, 0 warnings |
| Live A/B/C/D | Overlay present (`openai-compatible` / `deepseek-chat` / `api.deepseek.com`, key saved, **AI_MODE=shadow**, not promoted). `AI_COMPARE_SMOKE=1 npm run ai:evaluate:compare` wrote gitignored `results-live/compare-smoke.json`: 4 cases (IT01–IT04), engineering failures 0, model schema failures 2 (`C/IT04`, `RAG_off/IT04`). API `providerMeta.model` was `deepseek-flash`. Clinical labels / effect remain `not_evaluated`. Not a D-vs-C claim. Full six-case test split was not run. |
| 500-person live screen | **model invoked for 500/500** on existing store prescriptions after the key was recharged (441 ok / 53 schema_invalid / 6 policy_violation). `AI_MODE` stays **shadow**. Nobody approved. Counts in gitignored `results-live/screen-500-latest.json`. Not a clinical validation. |
| Browser role E2E | **pass** for 7 demo roles — see `benchmarks/ai-review/browser-role-e2e-2026-10-03.md` |
| Independent expert labels | **not_evaluated** — worksheet `benchmarks/ai-review/expert-label-worksheet.md` is blank; pack `expertReviewStatus` is still `unreviewed` |

Mock compare only tests that the ask→script-answer→reanalyze loop runs and stays isolated. It does not support a model-effect or clinical-benefit claim. Do not assume D outperforms C.

## Completion marks

| Item | Has function | Wired into service | End-to-end | Live model | Expert review |
|---|---|---|---|---|---|
| Dual-sign version binding | Yes | Yes | API tests | n/a | n/a |
| Replay append-only | Yes | Independent `replays` collection | Concurrent probes | n/a | n/a |
| Candidate confirm authorization | Yes | Bound patient or pharmacist; patient DTO only | Cross-patient 403/404, no write | n/a | n/a |
| Candidate confirm versions content | Yes | Hash/version/history; voids approval; rescreens | Approved-case pregnancy probe | n/a | n/a |
| Required safety questions gate approve | Yes | Critical/pregnancy `requiredForDecision`; unknown/deny still block unless independently verified | Female pregnancy approve blocked | n/a | n/a |
| AI disable covers extract | Yes | `allowedModelProvider()` / `modelCallsAllowed()` | Provider call count 0 when off | **未验证** | n/a |
| Live unknown lots quarantined | Yes | Non-demo catalog rows are unverified and unusable | Unit probe | n/a | n/a |
| Interactive experiment loop | Yes | Cumulative burden; reanalyze after answers | mock + 4-case live smoke | smoke only; not promoted | unreviewed pack |

JSON catalog stock is still a roll-up beside SQLite lots and movements. That is not a single catalog+SQLite rollback.

Fact extraction calls a model only when AI is enabled and the mode allows model calls. Heuristic output is labelled `heuristic_fallback`. History alone is not treated as current-negative liver impairment. Denying a candidate does not infer disease denial. Stopping questions is not approval.

`cases-v1.json` remains the engineering rule pack. The main clarification experiment uses `benchmarks/ai-review/cases-interactive-v1.json`. Rule-derived `expected` is not a medical gold standard.
