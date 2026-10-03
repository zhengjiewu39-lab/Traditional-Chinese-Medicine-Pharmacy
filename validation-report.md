# Validation report

Research prototype only. Passing tests is not clinical validation. This build can be described as a research prototype with a live-model screening interface and an uncertainty-handling framework. It is not a validated AI active-clarification system.

Checked after the 2026-10-03 remaining-fix pass (local Node may be newer than `engines.node`; CI uses Node 20).

| Check | Result |
|---|---|
| `npm run verify:pharmacy` | 85/85 pass |
| `npm run test:server` | 131/131 pass (37 groups) |
| `npm run lint` | pass, 0 warnings |
| Interactive mock compare | `AI_COMPARE_ALLOW_MOCK=1 npm run ai:evaluate:compare` — 6 test cases, 0 engineering failures, `inferenceMode=mock` |
| Live A/B/C/D | **未验证** — no API key, no live scores written |
| Browser role E2E | **未完成** |
| Independent expert labels | **not_evaluated** |

Mock compare only tests that the ask→script-answer→reanalyze loop runs and stays isolated. It does not support a model-effect or clinical-benefit claim.

## Completion marks

| Item | Has function | Wired into service | End-to-end | Live model | Expert review |
|---|---|---|---|---|---|
| Dual-sign version binding | Yes | Yes | API tests | n/a | n/a |
| Replay append-only | Yes | Independent `replays` collection + in-transaction pointer | Concurrent content-edit and sign probes | n/a | n/a |
| Picking plan ≠ weigh | Yes | Yes | API tests | n/a | n/a |
| Receive idempotency + lots | Yes | Request-hash idempotency; lot balances; fail inspection does not reject the request | API tests | n/a | n/a |
| Education template directions | Yes | Directions from `renderTemplate`; free text is explanation only | Unit + API; 17g / 每日三剂 / 注意休息 | n/a | n/a |
| Weigh unit/scope | Yes | Unit conversion + per_dose/course_total; missing lines cannot be waived | API tests; exception without evidence blocked | n/a | n/a |
| Fact extract | Yes | `provider.complete` when present; heuristic labelled fallback | Unit probes (negation, family/history, source span) | **未验证** | n/a |
| Candidate confirm UI | Yes | API + pharmacist/patient pages | **浏览器未验收** | n/a | n/a |
| Risk questions issued as tasks | Yes | `screen()` issues selected; rounds increment only when tasks are sent | API path | **未验证** | n/a |
| Interactive experiment loop | Yes | evaluate-compare ask→script→reanalyze | mock only, 0 engineering failures | **未验证** | unreviewed pack |

Replay no longer writes the case snapshot loaded before the model returns. The replay row is stored in an independent collection; a pointer is merged onto the current case inside a SQLite transaction. A concurrent content edit or pharmacist sign is kept.

JSON catalog stock is still a roll-up beside SQLite lots and movements. Receive and deduct share a SQLite transaction for lots and movements; that is not a single catalog+SQLite rollback.

Fact extraction calls `provider.complete` when a provider exists. Heuristic output is labelled `heuristic_fallback` and is not a live-model result. Candidates stay `pending_confirmation` until a patient or pharmacist confirms them. Stopping questions is not approval.

`cases-v1.json` remains the engineering rule pack. The main clarification experiment uses `benchmarks/ai-review/cases-interactive-v1.json`. Rule-derived `expected` is not a medical gold standard.
