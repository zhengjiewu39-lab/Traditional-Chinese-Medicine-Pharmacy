# Knowledge governance

Every knowledge entry used in official screening must include `sourceId`, `title`, `authority`, `version`, `effectiveDate`, `scope`, `content`, `reviewStatus`, `reviewedBy`, `reviewedAt`, and a SHA-256 `hash`.

Only `reviewStatus=approved` entries with an intact hash are usable. Draft, retired, or tampered entries are excluded.

Each AI warning that cites evidence must use a real `sourceId`. The model cannot invent pharmacopoeia articles, statutes, or papers.

Committee-approved substitution rules, if present, appear only as **candidates for pharmacist review**, with source identifiers. The system never auto-rewrites a prescription to “swap herb A for herb B.”

Seal hashes after editing sources: `npm run ai:seal-knowledge`.
