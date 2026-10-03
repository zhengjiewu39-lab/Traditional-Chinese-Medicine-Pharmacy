#!/usr/bin/env bash
# Snapshot JSON store + SQLite before a migration. Does not delete history.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="${1:-$(date +%Y%m%d-%H%M%S)}"
DEST="${BACKUP_DIR:-$ROOT/data/backups}/$STAMP"
mkdir -p "$DEST"
if [[ -n "${AI_DATA_DIR:-}" && -d "$AI_DATA_DIR" ]]; then
  cp -R "$AI_DATA_DIR" "$DEST/ai-data"
fi
if [[ -d "$ROOT/data" ]]; then
  cp -R "$ROOT/data" "$DEST/data" || true
fi
if [[ -d "$ROOT/data/ai" ]]; then
  cp -R "$ROOT/data/ai" "$DEST/ai-mode" || true
fi
find "$ROOT" -name '*.sqlite' -not -path '*/node_modules/*' -maxdepth 4 -exec cp {} "$DEST/" \;
cat > "$DEST/RESTORE.txt" <<EOF
Restore
-------
1. Stop the API process.
2. Copy this folder's sqlite file over the live AI_DATA_DIR database.
3. If JSON fixtures were copied, restore data/ from this snapshot.
4. Restart: npm run dev
This snapshot is an engineering backup, not a clinical archive.
EOF
echo "$DEST"
