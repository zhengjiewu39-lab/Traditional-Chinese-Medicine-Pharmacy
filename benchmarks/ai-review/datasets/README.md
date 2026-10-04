# Research snapshots

The default main experiment is a frozen, de-identified snapshot built from the existing 500 synthetic patients and one prescription each (`one-rx-per-patient-date-asc-id-asc@1`).

Files are written under the runtime data directory (`data/research/snapshots/` or `AI_DATA_DIR`). Patient-center edits do not rewrite a frozen `contentHash`; a new version is a new file.

`cases-interactive-v1.json` (IT01–IT06) is historical/regression only.
