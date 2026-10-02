# Migration report

## Method

1. Backup: `pharmacy.sqlite.bak` is written when an import starts (`server/db/sqlite.js` `backupSqlite`).
2. Source JSON: `data/ai/{DATA_MODE}/cases.json` and `data/store.json` are read once.
3. Target: `data/ai/{DATA_MODE}/pharmacy.sqlite` (`kv_docs`, `patients`, `stock_movements`, `migration_log`).
4. Idempotence: `INSERT OR IGNORE` plus `migration_log.name = import_json_v1 AND ok = 1` skip.

## Field mapping

| Legacy | New |
|---|---|
| `liverImpairment`/`renalImpairment` boolean | `facts.*` — `true` → reported; `false`/absent → **unknown** |
| `allergies: []` | `facts.allergies.status = unknown` (not none) |
| `allergies: [names]` | `reported` + `allergyItems` |
| `currentMedications` strings | `medicationItems` with `itemStatus=active` |
| `store.patients[].id` | `patients.legacy_patient_id` |
| `store.customers[].id` | `patients.legacy_customer_id`; points/level/spending dropped from the active document |

## Counts

Runtime import prints `{ cases, tokens, patients, skippedCases, skippedPatients }`. Re-run must increase `skipped*` rather than duplicate primary keys. Failure writes `migration_log.ok = 0` and does not mark the import complete.

## Rollback

Stop the process. Restore `pharmacy.sqlite.bak` and keep the original JSON files. JSON is not deleted by import.
