/**
 * Immutable research snapshots. Patient-center edits do not rewrite a frozen hash.
 * Missing or corrupt files fail closed. Same-content snapshots are not overwritten.
 */
const fs = require('fs');
const path = require('path');
const { getStore } = require('../data/store');
const repo = require('../workflow/workflowRepository');
const { buildSnapshot, DATASET_ID, hashSnapshotContent } = require('./snapshotBuilder');

const META = 'researchSnapshots';

function snapshotDir() {
  const root = process.env.AI_DATA_DIR || process.env.STORE_DIR || path.join(__dirname, '../../data');
  return path.join(root, 'research', 'snapshots');
}

function fileOf(datasetId, version, contentHash) {
  return path.join(snapshotDir(), `${datasetId}-${version}-${contentHash.slice(0, 12)}.json`);
}

function listMeta() {
  return (repo.listDocs(META) || []).sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
}

function verifyDoc(doc, expectedHash) {
  if (!doc || typeof doc !== 'object') {
    const err = new Error('research snapshot file is not an object');
    err.code = 'snapshot_corrupt';
    throw err;
  }
  const recomputed = hashSnapshotContent(doc);
  if (doc.contentHash && recomputed !== doc.contentHash) {
    const err = new Error('research snapshot contentHash does not match recomputed hash');
    err.code = 'snapshot_corrupt';
    throw err;
  }
  if (expectedHash && recomputed !== expectedHash) {
    const err = new Error('research snapshot hash does not match the job protocol');
    err.code = 'snapshot_corrupt';
    throw err;
  }
  return { ...doc, contentHash: recomputed };
}

function readFile(meta) {
  if (!meta?.path || !fs.existsSync(meta.path)) return null;
  try {
    return verifyDoc(JSON.parse(fs.readFileSync(meta.path, 'utf8')), meta.contentHash);
  } catch (err) {
    if (err.code === 'snapshot_corrupt') throw err;
    const wrap = new Error(`research snapshot unreadable: ${err.message}`);
    wrap.code = 'snapshot_corrupt';
    throw wrap;
  }
}

function publicMeta(row) {
  if (!row) return null;
  return {
    datasetId: row.datasetId,
    version: row.version,
    generatedAt: row.generatedAt,
    evaluationNow: row.evaluationNow || row.generatedAt,
    sourceVersion: row.sourceVersion,
    contentHash: row.contentHash,
    selectionRule: row.selectionRule,
    encounterRule: row.encounterRule,
    counts: row.counts,
    expertReviewStatus: row.expertReviewStatus,
    clinicalCorrectness: row.clinicalCorrectness,
    purpose: row.purpose,
    label: row.label,
    archivedInteractivePack: row.archivedInteractivePack,
  };
}

function stripSource(caseRow) {
  if (!caseRow) return caseRow;
  const { source, ...rest } = caseRow;
  return rest;
}

function ensureCurrent({ forceNew = false } = {}) {
  const current = listMeta()[0];
  if (current && !forceNew) {
    try {
      const doc = readFile(current);
      if (doc) return doc;
    } catch (err) {
      if (err.code !== 'snapshot_corrupt') throw err;
    }
  }
  const store = getStore();
  const snap = buildSnapshot({
    patients: store.patients || [],
    prescriptions: store.prescriptions || [],
    sourceVersion: store.meta?.version != null ? `store.meta.version=${store.meta.version}` : 'store',
  });
  const same = listMeta().find((m) => m.contentHash === snap.contentHash);
  if (same) {
    const existing = readFile(same);
    if (existing) return existing;
  }
  fs.mkdirSync(snapshotDir(), { recursive: true });
  const dest = fileOf(snap.datasetId, snap.version, snap.contentHash);
  if (fs.existsSync(dest) && !forceNew) {
    return verifyDoc(JSON.parse(fs.readFileSync(dest, 'utf8')), snap.contentHash);
  }
  fs.writeFileSync(dest, `${JSON.stringify(snap)}\n`);
  const meta = {
    id: `${snap.datasetId}:${snap.contentHash}`,
    datasetId: snap.datasetId,
    version: snap.version,
    generatedAt: snap.generatedAt,
    evaluationNow: snap.evaluationNow,
    sourceVersion: snap.sourceVersion,
    contentHash: snap.contentHash,
    selectionRule: snap.selectionRule,
    encounterRule: snap.encounterRule,
    counts: snap.counts,
    expertReviewStatus: snap.expertReviewStatus,
    clinicalCorrectness: snap.clinicalCorrectness,
    purpose: snap.purpose,
    label: snap.label,
    archivedInteractivePack: snap.archivedInteractivePack,
    path: dest,
  };
  repo.saveDoc(META, meta.id, meta);
  return snap;
}

function getByHash(contentHash) {
  const meta = listMeta().find((m) => m.contentHash === contentHash);
  if (!meta) {
    const err = new Error('research snapshot missing');
    err.code = 'snapshot_missing';
    throw err;
  }
  const doc = readFile(meta);
  if (!doc) {
    const err = new Error('research snapshot file missing');
    err.code = 'snapshot_missing';
    throw err;
  }
  return doc;
}

function current() {
  return ensureCurrent();
}

function listCases(snap, { q, split, offset = 0, limit = 20 } = {}) {
  let rows = snap.cases || [];
  if (split && split !== 'all') rows = rows.filter((c) => c.split === split);
  if (q) {
    const term = String(q).toLowerCase();
    rows = rows.filter((c) => c.id.toLowerCase().includes(term) || c.baseId.toLowerCase().includes(term) || (c.category || '').includes(q));
  }
  return {
    total: rows.length,
    offset: +offset,
    limit: +limit,
    records: rows.slice(+offset, +offset + +limit).map((c) => getCase({ cases: [c] }, c.id, { annotate: false })),
  };
}

function getCase(snap, id, { annotate = false } = {}) {
  const row = (snap.cases || []).find((c) => c.id === id || c.researchCaseId === id);
  if (!row) return null;
  const visible = stripSource(row);
  if (annotate) return { ...visible, viewKind: 'reference_facts', independentlyLabeled: false };
  const { hiddenPatientFacts, patientAnswerScript, expertReferenceLabels, ...pub } = visible;
  return pub;
}

module.exports = {
  DATASET_ID,
  ensureCurrent,
  current,
  getByHash,
  listMeta,
  publicMeta,
  listCases,
  getCase,
  stripSource,
  verifyDoc,
  readFile,
};
