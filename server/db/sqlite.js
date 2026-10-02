/**
 * Single-process SQLite store. JSON files remain fixtures / one-shot import sources.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { aiDataDir } = require('../common/dataDir');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv_docs (
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  document TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (collection, key)
);
CREATE TABLE IF NOT EXISTS kv_lists (
  collection TEXT NOT NULL,
  ord INTEGER NOT NULL,
  document TEXT NOT NULL,
  PRIMARY KEY (collection, ord)
);
CREATE TABLE IF NOT EXISTS patients (
  patient_ref TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  sex TEXT,
  identity_confirmed INTEGER NOT NULL DEFAULT 0,
  legacy_patient_id TEXT,
  legacy_customer_id TEXT,
  data_mode TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  inventory_id INTEGER,
  herb_name TEXT,
  quantity REAL NOT NULL,
  reason TEXT,
  case_id TEXT,
  actor_id TEXT,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE TABLE IF NOT EXISTS migration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ok INTEGER NOT NULL,
  counts TEXT,
  error TEXT,
  at TEXT NOT NULL
);
`;

let db = null;
let dbPath = null;

function filePath() {
  return path.join(aiDataDir(), 'pharmacy.sqlite');
}

function getDb() {
  const next = filePath();
  if (db && dbPath === next) return db;
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
  fs.mkdirSync(path.dirname(next), { recursive: true });
  db = new Database(next);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id, name, applied_at) VALUES (1, ?, ?)').run('001_init', new Date().toISOString());
  dbPath = next;
  return db;
}

function transaction(fn) {
  return getDb().transaction(fn)();
}

function reset() {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
    dbPath = null;
  }
}

function backupSqlite() {
  const src = filePath();
  if (!fs.existsSync(src)) return null;
  const dest = `${src}.bak`;
  fs.copyFileSync(src, dest);
  return dest;
}

module.exports = { getDb, transaction, reset, filePath, backupSqlite };
