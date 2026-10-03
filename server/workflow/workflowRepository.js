const { getDb, transaction, reset: resetDb } = require('../db/sqlite');

const INITIAL = {
  cases: {}, tokens: {}, proposals: {}, purchaseDrafts: [], settings: {},
  drafts: {}, suggestions: {}, pickupTokens: {}, pickupFailures: {},
  learningExports: [], datasets: {}, modelRegistry: {}, samplingLog: [],
};

const DOC_MAP = {
  cases: 'cases',
  tokens: 'tokens',
  proposals: 'proposals',
  drafts: 'drafts',
  suggestions: 'suggestions',
  pickupTokens: 'pickupTokens',
  pickupFailures: 'pickupFailures',
  datasets: 'datasets',
  modelRegistry: 'modelRegistry',
  settings: 'settings',
};

function readCollection(name) {
  const db = getDb();
  const rows = db.prepare('SELECT key, document FROM kv_docs WHERE collection = ?').all(name);
  const out = {};
  for (const row of rows) out[row.key] = JSON.parse(row.document);
  return out;
}

function writeDoc(collection, key, document, version = 1) {
  getDb().prepare(`
    INSERT INTO kv_docs (collection, key, document, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, key) DO UPDATE SET document = excluded.document, version = excluded.version, updated_at = excluded.updated_at
  `).run(collection, key, JSON.stringify(document), version, new Date().toISOString());
}

function listDocs(collection) {
  return getDb().prepare('SELECT document FROM kv_docs WHERE collection = ?').all(collection).map((r) => JSON.parse(r.document));
}

function saveDoc(collection, key, document) {
  writeDoc(collection, key, document, Number(document?.version) || 1);
  return document;
}

function getDoc(collection, key) {
  const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get(collection, key);
  return row ? JSON.parse(row.document) : null;
}

function data() {
  return {
    cases: readCollection('cases'),
    tokens: readCollection('tokens'),
    proposals: readCollection('proposals'),
    drafts: readCollection('drafts'),
    suggestions: readCollection('suggestions'),
    pickupTokens: readCollection('pickupTokens'),
    pickupFailures: readCollection('pickupFailures'),
    datasets: readCollection('datasets'),
    modelRegistry: readCollection('modelRegistry'),
    settings: readCollection('settings').default || {},
    purchaseDrafts: listDocs('purchaseDrafts'),
    learningExports: listDocs('learningExports'),
    samplingLog: listDocs('samplingLog'),
  };
}

function getCase(caseId) {
  const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('cases', caseId);
  return row ? JSON.parse(row.document) : null;
}

function listCases(filter = {}) {
  let list = listDocs('cases');
  if (filter.state) list = list.filter((c) => c.state === filter.state);
  if (filter.riskTier) list = list.filter((c) => c.analyses?.at(-1)?.output?.riskTier === filter.riskTier);
  if (filter.createdById) list = list.filter((c) => c.createdBy?.id === String(filter.createdById));
  if (filter.queue === 'priority') list = list.filter((c) => c.state === 'pharmacist_review_required');
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function saveCase(c, { expectedVersion, expectedRecordVersion } = {}) {
  return transaction(() => {
    const current = getCase(c.caseId);
    if (expectedVersion != null && current && Number(current.contentVersion) !== Number(expectedVersion)) {
      const err = new Error('version_conflict');
      err.code = 'version_conflict';
      err.status = 409;
      err.currentVersion = current.contentVersion;
      throw err;
    }
    if (expectedRecordVersion != null && current && Number(current.recordVersion || 0) !== Number(expectedRecordVersion)) {
      const err = new Error('version_conflict');
      err.code = 'version_conflict';
      err.status = 409;
      err.currentVersion = current.contentVersion;
      err.currentRecordVersion = current.recordVersion;
      throw err;
    }
    c.recordVersion = (current?.recordVersion || 0) + 1;
    writeDoc('cases', c.caseId, c, c.recordVersion);
    return c;
  });
}

function appendCaseReplay(caseId, entry) {
  return transaction(() => {
    const current = getCase(caseId);
    if (!current) return null;
    const replays = Array.isArray(current.replays) ? current.replays : [];
    if (!replays.some((r) => r.replayId === entry.replayId)) replays.push(entry);
    current.replays = replays;
    current.recordVersion = (current.recordVersion || 0) + 1;
    writeDoc('cases', caseId, current, current.recordVersion);
    return current;
  });
}

function tokens() {
  return {
    get: (hash) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('tokens', hash);
      return row ? JSON.parse(row.document) : null;
    },
    put: (hash, rec) => writeDoc('tokens', hash, rec, 1),
  };
}

function proposals() {
  return {
    get: (id) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('proposals', id);
      return row ? JSON.parse(row.document) : null;
    },
    put: (p) => writeDoc('proposals', p.proposalId, p, 1),
    list: () => listDocs('proposals').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  };
}

function addPurchaseDraft(doc) {
  writeDoc('purchaseDrafts', doc.id || `${Date.now()}`, doc, 1);
  return doc;
}

function purchaseDrafts() {
  return listDocs('purchaseDrafts');
}

function settings() {
  return {
    get: () => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('settings', 'default');
      return row ? JSON.parse(row.document) : {};
    },
    set: (patch) => {
      const cur = settings().get();
      writeDoc('settings', 'default', { ...cur, ...patch }, 1);
    },
  };
}

function getDraft(id) {
  const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('drafts', id);
  return row ? JSON.parse(row.document) : null;
}

function listDrafts(filter = {}) {
  let list = listDocs('drafts');
  if (filter.createdById) list = list.filter((d) => d.createdBy?.id === String(filter.createdById));
  if (filter.status) list = list.filter((d) => d.status === filter.status);
  return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function saveDraft(draft) {
  writeDoc('drafts', draft.draftId, draft, 1);
  return draft;
}

function getSuggestion(id) {
  const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('suggestions', id);
  return row ? JSON.parse(row.document) : null;
}

function listSuggestions(filter = {}) {
  let list = listDocs('suggestions');
  if (filter.draftId) list = list.filter((s) => s.draftId === filter.draftId);
  if (filter.caseId) list = list.filter((s) => s.caseId === filter.caseId);
  if (filter.status) list = list.filter((s) => s.status === filter.status);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function saveSuggestion(s) {
  writeDoc('suggestions', s.suggestionId, s, 1);
  return s;
}

function pickupTokens() {
  return {
    get: (hash) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('pickupTokens', hash);
      return row ? JSON.parse(row.document) : null;
    },
    put: (hash, rec) => writeDoc('pickupTokens', hash, rec, 1),
    list: () => listDocs('pickupTokens'),
  };
}

function pickupFailures() {
  return {
    get: (key) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('pickupFailures', key);
      return row ? JSON.parse(row.document) : { count: 0, lockedUntil: null };
    },
    put: (key, rec) => writeDoc('pickupFailures', key, rec, 1),
  };
}

function learning() {
  return {
    listExports: () => listDocs('learningExports'),
    addExport: (row) => writeDoc('learningExports', row.exportId || `${Date.now()}`, row, 1),
    getDataset: (id) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('datasets', id);
      return row ? JSON.parse(row.document) : null;
    },
    putDataset: (ds) => writeDoc('datasets', ds.datasetId, ds, 1),
    listDatasets: () => listDocs('datasets'),
    getModel: (id) => {
      const row = getDb().prepare('SELECT document FROM kv_docs WHERE collection = ? AND key = ?').get('modelRegistry', id);
      return row ? JSON.parse(row.document) : null;
    },
    putModel: (m) => writeDoc('modelRegistry', m.modelId, m, 1),
    listModels: () => listDocs('modelRegistry'),
    addSample: (row) => writeDoc('samplingLog', row.caseId + (row.sampledAt || ''), row, 1),
    samples: () => listDocs('samplingLog'),
  };
}

function recordStockMovement({ id, idempotencyKey, inventoryId, herbName, quantity, reason, caseId, actorId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM stock_movements WHERE idempotency_key = ?').get(idempotencyKey);
  if (existing) return { replayed: true, id: existing.id };
  db.prepare(`INSERT INTO stock_movements (id, idempotency_key, inventory_id, herb_name, quantity, reason, case_id, actor_id, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, idempotencyKey, inventoryId ?? null, herbName || null, quantity, reason || null, caseId || null, actorId || null, new Date().toISOString());
  return { replayed: false, id };
}

function upsertPatient(doc) {
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO patients (patient_ref, name, phone, sex, identity_confirmed, legacy_patient_id, legacy_customer_id, data_mode, version, document, created_at, updated_at)
    VALUES (@patient_ref, @name, @phone, @sex, @identity_confirmed, @legacy_patient_id, @legacy_customer_id, @data_mode, @version, @document, @created_at, @updated_at)
    ON CONFLICT(patient_ref) DO UPDATE SET name=excluded.name, phone=excluded.phone, sex=excluded.sex, document=excluded.document, version=excluded.version, updated_at=excluded.updated_at
  `).run({
    patient_ref: doc.patientRef,
    name: doc.name || null,
    phone: doc.phone || null,
    sex: doc.sex || null,
    identity_confirmed: doc.identityConfirmed ? 1 : 0,
    legacy_patient_id: doc.legacyPatientId || null,
    legacy_customer_id: doc.legacyCustomerId || null,
    data_mode: doc.dataMode || null,
    version: doc.version || 1,
    document: JSON.stringify(doc),
    created_at: now,
    updated_at: now,
  });
  return doc;
}

function getPatient(ref) {
  const row = getDb().prepare('SELECT document FROM patients WHERE patient_ref = ?').get(ref);
  return row ? JSON.parse(row.document) : null;
}

function listPatients() {
  return getDb().prepare('SELECT document FROM patients').all().map((r) => JSON.parse(r.document));
}

const _store = {
  read: data,
  update(mutator) {
    return transaction(() => {
      const snapshot = data();
      const result = mutator(snapshot);
      for (const [id, c] of Object.entries(snapshot.cases || {})) writeDoc('cases', id, c, c.contentVersion || 1);
      for (const [k, v] of Object.entries(snapshot.tokens || {})) writeDoc('tokens', k, v, 1);
      for (const [k, v] of Object.entries(snapshot.pickupTokens || {})) writeDoc('pickupTokens', k, v, 1);
      return result;
    });
  },
  reset: resetDb,
  filePath: () => require('../db/sqlite').filePath(),
};

module.exports = {
  getCase, listCases, saveCase, appendCaseReplay, tokens, proposals, addPurchaseDraft, purchaseDrafts, settings,
  getDraft, listDrafts, saveDraft, getSuggestion, listSuggestions, saveSuggestion,
  listDocs, saveDoc, getDoc,
  pickupTokens, pickupFailures, learning, recordStockMovement, upsertPatient, getPatient, listPatients,
  _store, INITIAL, DOC_MAP,
};
