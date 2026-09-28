# Patient participation

Patients receive a time-limited, single-use token (`/patient/confirmation/:token`). The token is stored as a SHA-256 hash; the full token never appears in the audit log.

## Patients may

Confirm identity; confirm allergies, pregnancy/lactation, age, and current medicines; read the **patient-facing** explanation; choose pickup, delivery, or decoction; confirm contact; accept or decline **non-essential** substitution (only committee-approved candidates, never model-invented swaps); acknowledge education; decline the service; submit effectiveness / adverse-reaction feedback after handover.

## Patients must not

See internal prompts; lift an A3 hard stop; change pharmacist decisions; treat “I understand the risk” as professional approval; edit herbs or doses.

A decline (`patient_declined`) permanently blocks dispensing. Newly reported safety information (for example pregnancy) voids the approval and re-enters pharmacist review.

Patient feedback never updates screening rules or prompts.
