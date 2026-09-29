# AI safety boundaries

## Autonomy tiers

| Tier | Examples | Execution |
|---|---|---|
| A0 | OCR/classification placeholders, queueing, notifications, inventory reports, non-clinical admin | May auto-run; always logged |
| A1 | Shortage alerts, purchase drafts, delivery estimates, ordinary information prompts | Suggestion; staff confirm |
| A2 | Routine risk hints, dose check, special-population reminders, interactions, weak evidence | Pharmacist must approve |
| A3 | 十八反/十九畏, toxic herbs, clear overdose, severe allergy, high-risk populations, identity/source anomalies, rule conflict, unjudgeable high risk | Hard stop; pharmacist or prescriber only. Patients and technicians cannot release |

## LLM may

Convert free text to structured prescription fields; flag ambiguity and missing information; summarise rule hits; explain retrieved evidence; write pharmacist-facing and patient-facing text; suggest who should supply missing facts.

## LLM must not

Prescribe; add herbs; change doses; pick substitutes; override hard rules; change workflow state; write inventory or dispensing records.

## Forced abstention (`abstain=true`)

Schema failure; no evidence; citation to a missing `sourceId`; hard-rule vs model conflict; missing critical fields; provider timeout; diagnosis or autonomous prescription in the model output; suspected prompt injection.

Do not present numeric suggestion scores as calibrated probabilities. Suggestions carry `heuristicReliabilityLevel` (`high`/`medium`/`low`) and `uncertainty`, plus `evidenceStrength`, `missingInformation`, `disagreements`, `abstain`, `abstainReasons`. Connecting a provider starts in **shadow**; live requires a shadow evaluation report, performance gates, and dual pharmacist/governance approval. The learning registry stores metadata only and does not train weights.

## Kill switch and production

Admin may disable the model (`POST /api/ai/governance/kill-switch`). Screening continues on the deterministic rule track. `AI_PROVIDER=mock` is refused when `NODE_ENV=production`. PHI is minimised before model calls; logs store hashes of patient tokens, never the raw token; API keys are never written to the audit chain.
