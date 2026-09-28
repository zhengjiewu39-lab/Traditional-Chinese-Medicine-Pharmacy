# Pharmacist governance

Only the `pharmacist` role may:

- `approve` / `reject`
- `pharmacist_final_check` / `final_check_pass`
- override or confirm an AI **alert** (not a hard stop)

Admin configures the system and the kill switch but **cannot** impersonate a pharmacist approval. Technicians execute approved dispensing tasks only. AI is not a login role and cannot enter `pharmacist_approved`.

## Override of AI alerts

Requires a coded reason: `false_positive`, `patient_context`, `evidence_outdated`, `rule_not_applicable`, `model_misinterpretation`, `other`. Historical analyses are never rewritten; a new decision record is appended.

Hard stops (A3 / 十八反 / 十九畏 / toxic special management) cannot be overridden as “false positives”. The pharmacist may reject or return to the prescriber.

## Second review

`request_second_review` requires a **different** pharmacist to approve. The pharmacist who submitted the weigh-in cannot be the only final checker.

## Content change after approval

Any change to herbs, doses, or safety-relevant patient fields voids `approval.valid` and returns the case to AI screening then pharmacist review.
