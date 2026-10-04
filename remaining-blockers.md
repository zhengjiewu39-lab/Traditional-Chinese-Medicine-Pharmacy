# Remaining blockers

These are not software defects that Cursor can honestly close, plus engineering leftovers that this repair pass did not finish.

## Needs professional or external conditions

1. **Clinical gold labels** for miss rate / citation-support rate — worksheet `benchmarks/ai-review/expert-label-worksheet.md` is blank; pack remains `unreviewed` (`not_evaluated`).
2. **Authoritative knowledge** — 中国药典仍无开放全文 API，系统已登记该限制并接入 NCBI PubMed 题录检索。抓回的文献是草稿，不是药典正文，药师审核前不能当临床规则证据。捆绑库仍是 `synthetic-demo-kb.json`。不得把 PubMed 条数写成临床验证。
3. **Emergency thresholds and on-call contacts** — not invented. Severe-symptom escalation stays in-app (`仅站内待办，未发送`). New symptoms are not auto-diagnosed as ADR.
4. **Live LLM comparison (A/B/C/D)** — engine `research-engine@2.0.0` freezes encounter time at `issuedAt` and selects by base case. Offline mock A/C/D is engineering only and still does not show a group-effect claim. A paid full-500 live run was **not** started. Formal papers should report the 399-case test split or a new legal split, not 1500 scenes as 1500 patients. Clinical outcome remains `not_evaluated`. Promotion to `AI_MODE=live` still needs a shadow report, pharmacist approval, and governance sign-off. `maxCasesLive` is a hard cap; researcher confirm cannot raise it.
5. **MedWear** — no real interface; Observation is a reserved disabled stub. Not FHIR-certified.
6. **Identity proofing** — checkbox `identityConfirmed` is not professional verification.
7. **Independent pharmacist review of education text and second-review workflow in a live clinic** — not_evaluated.
8. **Browser acceptance** — seven demo roles were walked on 2026-10-03 (`benchmarks/ai-review/browser-role-e2e-2026-10-03.md`). That is a local demo login check, not a clinic path with real patients.
9. **500-person live screen** — model was invoked for all 500 (441 ok / 53 schema_invalid / 6 policy_violation) on existing store prescriptions. Shadow mode; nobody approved; `AI_MODE` not promoted. Not a clinical validation. Independent labels still blank.

## Engineering leftovers

- Inventory catalog remains JSON (`store.json`); SQLite stores movements and workflow documents. Deduct now prechecks the whole prescription and refuses a success idempotency key on failure, but JSON stock and SQLite case writes are still two stores. A single-database inventory cut-over was not completed.
- Legacy POS `prescriptionId` checkout can still mark an old store prescription completed; case inventory must use the dispense path (`caseId` is rejected).
- Some leftover i18n keys still name archived simulation pages; they are unused by the new nav.
- `react-organizational-chart` is unused after Organization was archived; not removed in this pass to avoid a lockfile-only churn.
- Local runtime Node may be v24; project `engines` and CI stay on Node 20. No framework upgrade was performed.
- Knowledge fragment quality vs strength naming still coexists; synthetic knowledge is an external professional block.
- Inventory quantity authority is now SQLite lots and `stock_movements`. JSON `inventory[].stock` is a rebuilt cache (`stockSource=lot_rollup`). The SKU master (name, unit, minStock, location) still lives in JSON. That is not a single-database cut-over and is not a real-dispensing go-live condition. Legacy POS/billing routes can still write JSON stock and are not the case dispense path.
- Independent professional labels remain blank. `expert-label-worksheet.md` and pack `expertReviewStatus` stay `unreviewed`. Agents must not invent gold labels. A licensed rater can print visible cards with `node scripts/ai/print-rater-pack.js`.
- This pass did not re-run a full browser approve/dispense/weigh/concurrency path or a paid live-model suite.

Do not read this list as “the system is clinically validated” or “ready for real dispensing”.
