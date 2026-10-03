# Remaining blockers

These are not software defects that Cursor can honestly close, plus engineering leftovers that this repair pass did not finish.

## Needs professional or external conditions

1. **Clinical gold labels** for miss rate / citation-support rate — no pharmacist annotation in this pass (`not_evaluated`).
2. **Authoritative knowledge** — 中国药典仍无开放全文 API，系统已登记该限制并接入 NCBI PubMed 题录检索。抓回的文献是草稿，不是药典正文，药师审核前不能当临床规则证据。捆绑库仍是 `synthetic-demo-kb.json`。不得把 PubMed 条数写成临床验证。
3. **Emergency thresholds and on-call contacts** — not invented. Severe-symptom escalation stays in-app (`仅站内待办，未发送`). New symptoms are not auto-diagnosed as ADR.
4. **Live LLM comparison (A/B/C/D)** — the compare runner now executes groups A–D when a live provider is configured. Without `AI_API_KEY` / provider, `npm run ai:evaluate:compare` exits 2 and writes no placeholder scores. Clinical outcome remains `not_evaluated`.
5. **MedWear** — no real interface; Observation is a reserved disabled stub. Not FHIR-certified.
6. **Identity proofing** — checkbox `identityConfirmed` is not professional verification.
7. **Independent pharmacist review of education text and second-review workflow in a live clinic** — not_evaluated.
8. **Browser acceptance of the full patient–pharmacist path** — APIs and pages are wired; this pass did not complete a logged-in browser walkthrough.

## Engineering leftovers

- Inventory catalog remains JSON (`store.json`); SQLite stores movements and workflow documents. Deduct now prechecks the whole prescription and refuses a success idempotency key on failure, but JSON stock and SQLite case writes are still two stores. A single-database inventory cut-over was not completed.
- Legacy POS `prescriptionId` checkout can still mark an old store prescription completed; case inventory must use the dispense path (`caseId` is rejected).
- Some leftover i18n keys still name archived simulation pages; they are unused by the new nav.
- `react-organizational-chart` is unused after Organization was archived; not removed in this pass to avoid a lockfile-only churn.
- Local runtime Node may be v24; project `engines` and CI stay on Node 20. No framework upgrade was performed.
- Knowledge fragment quality vs strength naming still coexists; synthetic knowledge is an external professional block.

Do not read this list as “the system is clinically validated” or “ready for real dispensing”.
