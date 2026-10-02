const fs = require('fs');
const path = require('path');
const { getDb, backupSqlite } = require('./sqlite');
const { aiDataDir } = require('../common/dataDir');
const { attachFacts } = require('../workflow/clinicalFacts');

function count(db, sql) {
  return db.prepare(sql).get().n;
}

function importIfNeeded() {
  const db = getDb();
  const already = db.prepare('SELECT 1 FROM migration_log WHERE name = ? AND ok = 1').get('import_json_v1');
  if (already) return { skipped: true, reason: 'already_imported' };

  const casesPath = path.join(aiDataDir(), 'cases.json');
  const storePath = path.resolve(__dirname, '../../data/store.json');
  const report = { cases: 0, tokens: 0, patients: 0, skippedCases: 0, skippedPatients: 0 };
  backupSqlite();

  const insertDoc = db.prepare('INSERT OR IGNORE INTO kv_docs (collection, key, document, version, updated_at) VALUES (?, ?, ?, ?, ?)');
  const insertPatient = db.prepare(`INSERT OR IGNORE INTO patients
    (patient_ref, name, phone, sex, identity_confirmed, legacy_patient_id, legacy_customer_id, data_mode, version, document, created_at, updated_at)
    VALUES (@patient_ref, @name, @phone, @sex, @identity_confirmed, @legacy_patient_id, @legacy_customer_id, @data_mode, @version, @document, @created_at, @updated_at)`);

  const run = db.transaction(() => {
    if (fs.existsSync(casesPath)) {
      const data = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
      for (const [id, c] of Object.entries(data.cases || {})) {
        const r = insertDoc.run('cases', id, JSON.stringify(c), c.contentVersion || 1, c.updatedAt || new Date().toISOString());
        if (r.changes) report.cases += 1;
        else report.skippedCases += 1;
      }
      for (const [hash, rec] of Object.entries(data.tokens || {})) {
        const r = insertDoc.run('tokens', hash, JSON.stringify(rec), 1, rec.issuedAt || new Date().toISOString());
        if (r.changes) report.tokens += 1;
      }
      for (const [id, d] of Object.entries(data.drafts || {})) insertDoc.run('drafts', id, JSON.stringify(d), 1, d.updatedAt || new Date().toISOString());
      for (const [id, s] of Object.entries(data.suggestions || {})) insertDoc.run('suggestions', id, JSON.stringify(s), 1, s.createdAt || new Date().toISOString());
      for (const [hash, rec] of Object.entries(data.pickupTokens || {})) insertDoc.run('pickupTokens', hash, JSON.stringify(rec), 1, rec.issuedAt || new Date().toISOString());
    }
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      const now = new Date().toISOString();
      for (const p of store.patients || []) {
        const ref = p.patientRef || `legacy-p-${p.id}`;
        const merged = attachFacts({
          patientRef: ref,
          name: p.name,
          phone: p.phone,
          ageYears: p.age,
          sex: p.gender === '男' ? 'male' : p.gender === '女' ? 'female' : 'unknown',
          allergies: p.allergies,
          legacyPatientId: String(p.id),
          legacyCustomerId: p.customerId != null ? String(p.customerId) : null,
        });
        const r = insertPatient.run({
          patient_ref: ref,
          name: merged.name || null,
          phone: merged.phone || null,
          sex: merged.sex || null,
          identity_confirmed: 0,
          legacy_patient_id: String(p.id),
          legacy_customer_id: merged.legacyCustomerId,
          data_mode: 'demo',
          version: 1,
          document: JSON.stringify(merged),
          created_at: now,
          updated_at: now,
        });
        if (r.changes) report.patients += 1;
        else report.skippedPatients += 1;
      }
      for (const c of store.customers || []) {
        const ref = `legacy-c-${c.id}`;
        const exists = db.prepare('SELECT 1 FROM patients WHERE legacy_customer_id = ? OR patient_ref = ?').get(String(c.id), ref);
        if (exists) continue;
        const merged = attachFacts({
          patientRef: ref,
          name: c.name,
          phone: c.phone,
          legacyCustomerId: String(c.id),
        });
        insertPatient.run({
          patient_ref: ref,
          name: merged.name || null,
          phone: merged.phone || null,
          sex: null,
          identity_confirmed: 0,
          legacy_patient_id: null,
          legacy_customer_id: String(c.id),
          data_mode: 'demo',
          version: 1,
          document: JSON.stringify({ ...merged, marketingRemoved: true, points: undefined, spending: undefined, level: undefined }),
          created_at: now,
          updated_at: now,
        });
        report.patients += 1;
      }
    }
    db.prepare('INSERT INTO migration_log (name, ok, counts, error, at) VALUES (?, 1, ?, NULL, ?)').run('import_json_v1', JSON.stringify(report), new Date().toISOString());
  });

  try {
    run();
    return { ok: true, ...report, after: { kv: count(db, 'SELECT COUNT(*) AS n FROM kv_docs'), patients: count(db, 'SELECT COUNT(*) AS n FROM patients') } };
  } catch (err) {
    db.prepare('INSERT INTO migration_log (name, ok, counts, error, at) VALUES (?, 0, ?, ?, ?)').run('import_json_v1', JSON.stringify(report), String(err.message), new Date().toISOString());
    return { ok: false, error: err.message, ...report };
  }
}

module.exports = { importIfNeeded };
