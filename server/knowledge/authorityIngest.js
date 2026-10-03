const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/sqlite');
const { searchHerb } = require('./pubmedConnector');

function catalog() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'authorityCatalog.json'), 'utf8'));
}

function listAuthorities() {
  const doc = catalog();
  return {
    version: doc.version,
    disclaimer: doc.disclaimer,
    sources: doc.sources,
    stored: listStored(),
  };
}

function listStored({ withDocument = false } = {}) {
  try {
    const cols = withDocument
      ? 'id, connector, herb, pmid, source_url, retrieved_at, review_status, content_hash, document'
      : 'id, connector, herb, pmid, source_url, retrieved_at, review_status, content_hash';
    return getDb().prepare(`SELECT ${cols} FROM external_evidence ORDER BY retrieved_at DESC LIMIT 200`).all();
  } catch (err) {
    if (String(err.message || '').includes('no such table')) return [];
    throw err;
  }
}

function saveRecords(records) {
  const db = getDb();
  const ins = db.prepare(`INSERT OR REPLACE INTO external_evidence
    (id, connector, herb, pmid, source_url, retrieved_at, review_status, document, content_hash)
    VALUES (@id, @connector, @herb, @pmid, @source_url, @retrieved_at, @review_status, @document, @content_hash)`);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      ins.run({
        id: `KS-PMID-${r.pmid}`,
        connector: r.connector,
        herb: r.herb,
        pmid: r.pmid,
        source_url: r.sourceUrl,
        retrieved_at: r.retrievedAt,
        review_status: r.reviewStatus,
        document: JSON.stringify(r),
        content_hash: r.hash,
      });
    }
  });
  tx(records);
  return records.length;
}

async function fetchPubmed(herb, opts) {
  const out = await searchHerb(herb, opts);
  const written = saveRecords(out.records);
  return { ...out, written, clinicalUse: false, usableForRules: false };
}

module.exports = { catalog, listAuthorities, listStored, saveRecords, fetchPubmed };
