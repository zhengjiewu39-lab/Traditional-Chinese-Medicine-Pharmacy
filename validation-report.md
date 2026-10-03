# Validation report

Research prototype only. Passing tests is not clinical validation and is not evidence of reduced adverse reactions, improved adherence, or better outcomes.

Checked on this machine after the 2026-10-02 repair pass (local Node may be newer than `engines.node`; CI uses Node 20):

| Check | Result |
|---|---|
| `node --test server/__tests__/*.test.js` | 110 pass / 0 fail |
| `npm run lint` | pass, 0 warnings |
| `CI=true npm run build` | compiled |
| `npm run ai:evaluate:compare` without key | exit 2, no placeholder scores |
| Freeze tags | `v1.0.0-research`, `legacy-cdss-v1` exist |

| Scenario | Implemented | Verified | Notes |
|---|---|---|---|
| 1 Missing allergy ≠ no allergy; clarify before approval | Yes | `digitalPharmacy` 1 | Empty array migrates to unknown; confirmation page uses fact adapter |
| 2 Stop/correct does not re-append; stale token fails | Yes | Test 2 | Confirmation token binds `contentVersion` |
| 3 Patient/admin/AI cannot approve or change dose | Yes | Test 3 + pharmacist herb PATCH 403 | Pharmacist cannot change herbs; prescriber-only clinical edits |
| 4 Model failure shows real status; mock stays mock | Yes | Provider adapter + test 4/12 | Default provider is `disabled`; live eval refuses mock |
| 5 Citation presence ≠ supporting claim | Yes | Retriever `evidenceQuality=not_assessed` | Demo KB remains synthetic |
| 6 Unpublished education hidden; 15 vs 150 rejected | Yes | Test 6 + P1 education test | Patient DTO only published docs; substring 15⊂150 fails |
| 7 Repeat feedback; AI cannot close follow-up | Yes | Test 7 | New feedback token after each submit |
| 8 Concurrent same-version writes: one 200, one 409 | Yes | P1 concurrent test | Two overlapping PATCH with same `expectedVersion` |
| 9 Proxy `secondReviewerId` rejected | Yes | Test 9 + learning labels | Two logins required; admin cannot fill pharmacistApproverId |
| 10 Research/simulation endpoints gone | Yes | Test 10 + 410 handlers | Researcher hitting `/api/simulation` is 403 or 410 |
| 11 Migration rerun does not duplicate | Yes | Test 11 | Also imports settings/registry/datasets/exports/sampling/pickupFailures |
| 12 Eval separates model vs rules; no invented live file | Yes | evaluate-live / evaluate-compare | Compare runner exists; live A–D not run without key |
| P1 two clarifications persist independently | Yes | P1 test | Answered response remains; sibling stays `sent` |
| P1 inventory missing herb fails all | Yes | P1 inventory test | Zero deduct on missing herb |
| P1 billing role / positive qty / no case deduct | Yes | P1 billing test | Prescriber 403; qty ≤0 rejected; `caseId` 409 |
| Browser E2E: create→clarify→answer→review→education→dispense→feedback | No | Not run | Pages and APIs are wired; this was not a logged-in browser acceptance |
| Live A/B/C/D model experiment | No | Runner only | Blocked without provider key; clinical labels `not_evaluated` |
| AI-generated education draft / follow-up summary | No | README corrected | Human pharmacist text / fixed template only |

Default CI job `digital-pharmacy`: lint, `test:server`, mock `ai:evaluate`, frontend build. Supply-simulation CI jobs removed.

Frontend routes now expose clarification, education, follow-up plan, and feedback-token actions on Review Detail, and typed clarification / intake feedback on patient pages. That is not a browser acceptance.
