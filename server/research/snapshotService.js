/**
 * Immutable research snapshots. Patient-center edits do not rewrite a frozen hash.
 */
const fs = require('fs');
const path = require('path');
const { getStore } = require('../data/store');
const repo = require('../workflow/workflowRepository');
const { buildSnapshot, DATASET_ID } = require('./snapshotBuilder');

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

function readFile(meta) {
  if (!meta?.path || !fs.existsSync(meta.path)) return null;
  return JSON.parse(fs.readFileSync(meta.path, 'utf8'));
}

function publicMeta(row) {
  if (!row) return null;
  return {
    datasetId: row.datasetId,
    version: row.version,
    generatedAt: row.generatedAt,
    sourceVersion: row.sourceVersion,
    contentHash: row.contentHash,
    selectionRule: row.selectionRule,
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
    const doc = readFile(current);
    if (doc && doc.contentHash === current.contentHash) return doc;
  }
  const store = getStore();
  const snap = buildSnapshot({
    patients: store.patients || [],
    prescriptions: store.prescriptions || [],
    sourceVersion: store.meta?.version != null ? `store.meta.version=${store.meta.version}` : 'store',
  });
  if (current && current.contentHash === snap.contentHash && !forceNew) {
    return readFile(current) || snap;
  }
  fs.mkdirSync(snapshotDir(), { recursive: true });
  const dest = fileOf(snap.datasetId, snap.version, snap.contentHash);
  fs.writeFileSync(dest, `${JSON.stringify(snap)}\n`);
  const meta = {
    id: `${snap.datasetId}:${snap.contentHash}`,
    datasetId: snap.datasetId,
    version: snap.version,
    generatedAt: snap.generatedAt,
    sourceVersion: snap.sourceVersion,
    contentHash: snap.contentHash,
    selectionRule: snap.selectionRule,
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
  return meta ? readFile(meta) : null;
}

function current() {
  return ensureCurrent();
}

function listCases(snap, { q, split, offset = 0, limit = 20 } = {}) {
  let rows = snap.cases || [];
  if (split) rows = rows.filter((c) => c.split === split);
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
  if (annotate) return visible;
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
};
