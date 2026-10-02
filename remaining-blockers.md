# Remaining blockers

These are not software defects that Cursor can honestly close.

## Needs professional or external conditions

1. **Clinical gold labels** for miss rate / citation-support rate — no pharmacist annotation in this pass (`not_evaluated`).
2. **Authoritative knowledge** — `synthetic-demo-kb.json` is still the only bundled source. No pharmacopoeia licence, no real pharmacist review signatures.
3. **Emergency thresholds and on-call contacts** — not invented. Severe-symptom escalation stays in-app (`仅站内待办，未发送`).
4. **Live LLM comparison (A/B/C/D)** — blocked without `AI_API_KEY` / provider. `npm run ai:evaluate:compare` exits 2 and writes no placeholder scores.
5. **MedWear** — no real interface; Observation is a reserved disabled stub. Not FHIR-certified.
6. **Identity proofing** — checkbox `identityConfirmed` is not professional verification.
7. **Independent pharmacist review of education text and second-review workflow in a live clinic** — not_evaluated.

## Engineering leftovers

- Legacy `data/store.json` remains the inventory catalog source; SQLite records movements and workflow documents. A full cut-over of every POS field was not completed.
- Some leftover i18n keys still name archived simulation pages; they are unused by the new nav.
- `react-organizational-chart` is unused after Organization was archived; not removed in this pass to avoid a lockfile-only churn.
- Local runtime Node may be v24; project `engines` and CI stay on Node 20. No framework upgrade was performed.

Do not read this list as “the system is clinically validated” or “ready for real dispensing”.
