# Validation report

Research prototype only. Passing tests is not clinical validation and is not evidence of reduced adverse reactions, improved adherence, or better outcomes. Demo, synthetic and real-use data must stay labelled separately. Simulated runs are not clinical validation. The system cannot auto-train or auto-deploy a new model.

Checked locally after the 2026-10-03 brief (local Node may be newer than `engines.node`; CI uses Node 20):

| Check | Result |
|---|---|
| `npm run verify:pharmacy` | 78 pass / 0 fail |
| `npm run lint` | pass, 0 warnings |
| `AI_COMPARE_ALLOW_MOCK=1 AI_COMPARE_SMOKE=1 npm run ai:evaluate:compare` | mock, 8 clean cases, 0 engineering failures, wrote `benchmarks/ai-review/results-mock/` |
| Live A/B/C/D | **未验证** — no API key was supplied; do not treat mock scores as live results |

## Phase 1 (safety)

| Scenario | Implemented | Verified | Notes |
|---|---|---|---|
| Dual-sign binds contentVersion/hash/analysisId/protocolVersion | Yes | digitalPharmacy dual + content-change test | Content change archives signs; stale analysisId 409; proxy secondReviewerId 400 |
| Education template vs AI paragraph; 17g/15mg/8剂; 附子先煎薄荷后下 | Yes | education factsMatchText tests | Per-herb window; superseded cannot revive |
| auto_pick writes picking_plan only | Yes | digitalPharmacy auto-pick | State stays `dispensing`; no `type=weighed`; start reuses reservation |
| Restock propose ≠ inbound | Yes | digitalPharmacy restock | `applied=[]`; fail inspection does not increase stock |
| Analyze CAS / replay append-only | Yes | workflowService runAnalysis + replay | Stale model result stored in `staleAnalyses` |
| Live empty catalog blocks deduct | Yes | digitalPharmacy live-empty test | `skipped` is demo-only |

## Phase 2 (facts / questions)

| Scenario | Implemented | Verified | Notes |
|---|---|---|---|
| Fact statuses include denied/verified/conflicting | Yes | digitalPharmacy fact test | Denied allergy is not `[]` / `none` |
| NL extract is candidate, not verified | Yes | factExtract heuristic | Source span must exist in text |
| Risk questions: mandatory + adaptive + stop | Yes | clarificationService generateRiskQuestions | Weights are uncalibrated heuristics |
| Live model small run | No | 未验证 | Requires an authorized person to set provider keys and run compare |

## Phase 3 (experiment)

| Scenario | Implemented | Verified | Notes |
|---|---|---|---|
| Orchestrator reads rulesEnabled/retrievalEnabled/clarificationMode | Yes | architectureConvergence | `retrievalUsed` from actual retrieved evidence |
| Case constructor + hidden label isolation | Yes | architectureConvergence | `hiddenPatientFacts` / scripts / expert labels stay off the visible case |
| Main groups A/B/C/D + RAG_off | Yes | evaluate-compare.js | Primary comparison D vs C |
| Independent unsafe-suggestion labels | No | not_evaluated | Need independent professional review |
| Pharmacist time / clinical effect / fairness | No | not_evaluated | No participant or real-use data |

## Honest leftovers

- Browser role E2E (create → clarify → dual-sign after edit → weigh → receive → deliver) was not logged in this pass as a full UI acceptance.
- JSON inventory catalog and SQLite movements still coexist; deduct/receive share a SQLite transaction for movements, catalog rows remain in the JSON store.
- No real weighing device is connected; manual entry is labelled `weighSource=manual`.
- No live model key was used. Live results must stay in `benchmarks/ai-review/results-live/` and must not be copied from mock.

Backup: `./scripts/backup-data.sh` then restore from `data/backups/<stamp>/RESTORE.txt`.
