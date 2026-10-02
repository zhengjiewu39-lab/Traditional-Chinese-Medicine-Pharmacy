# Validation report

Research prototype only. Passing tests is not clinical validation and is not evidence of reduced adverse reactions, improved adherence, or better outcomes.

Checked on this machine after the reconstruction (local Node may be newer than `engines.node`; CI uses Node 20):

| Check | Result |
|---|---|
| `node --test server/__tests__/*.test.js` | 103 pass / 0 fail |
| `npm run lint` | pass, 0 warnings |
| `CI=true npm run build` | compiled |
| `npm run ai:evaluate:compare` without key | exit 2, no placeholder scores |
| Freeze tags | `v1.0.0-research`, `legacy-cdss-v1` exist |

| Scenario | Implemented | Verified | Notes |
|---|---|---|---|
| 1 Missing allergy ≠ no allergy; clarify before approval | Yes | `digitalPharmacy` 1 | Empty array migrates to unknown |
| 2 Stop/correct does not re-append; stale token fails | Yes | Test 2 | Confirmation token binds `contentVersion` |
| 3 Patient/admin/AI cannot approve or change dose | Yes | Test 3 + pharmacist credential checks | Admin removed from `rx:review_decision` |
| 4 Model failure shows real status; mock stays mock | Yes | Provider adapter + test 4/12 | Live eval refuses mock |
| 5 Citation presence ≠ supporting claim | Yes | Retriever `evidenceQuality=not_assessed` | Demo KB remains synthetic |
| 6 Unpublished education hidden; doses not rewritten | Yes | Test 6 | `factsMatchText` |
| 7 Repeat feedback; AI cannot close follow-up | Yes | Test 7 | New feedback token after each submit |
| 8 Version conflict 409 | Yes | Test 8 | `expectedVersion` |
| 9 Proxy `secondReviewerId` rejected | Yes | Test 9 + learning labels | Two logins required |
| 10 Research/simulation endpoints gone | Yes | Test 10 + 410 handlers | Researcher hitting `/api/simulation` is 403 or 410 |
| 11 Migration rerun does not duplicate | Yes | Test 11 | |
| 12 Eval separates model vs rules; no invented live file | Yes | evaluate-live split latency | Live file absent unless actually run |

Default CI job `digital-pharmacy`: lint, `test:server`, mock `ai:evaluate`, frontend build. Supply-simulation CI jobs removed.

Frontend routes and staff/patient nav were updated; they were not driven through a logged-in browser session in this pass. API-level acceptance is covered by the server tests above.
