const fs = require('fs');
const path = require('path');
const { hashObject } = require('../common/hash');
const { check } = require('../common/schema');

const SOURCES_DIR = path.join(__dirname, 'approved-sources');

const ENTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceId', 'title', 'authority', 'version', 'effectiveDate', 'scope', 'content', 'reviewStatus', 'reviewedBy', 'reviewedAt', 'hash'],
  properties: {
    sourceId: { type: 'string', pattern: '^KS-[A-Z0-9-]+$' },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    authority: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    effectiveDate: { type: 'string', format: 'date' },
    scope: {
      type: 'object',
      additionalProperties: false,
      properties: {
        herbs: { type: 'array', items: { type: 'string' } },
        topics: { type: 'array', items: { type: 'string' } },
      },
    },
    content: { type: 'string', minLength: 1, maxLength: 4000 },
    reviewStatus: { type: 'string', enum: ['approved', 'draft', 'retired', 'rejected'] },
    reviewedBy: { type: ['string', 'null'] },
    reviewedAt: { type: ['string', 'null'] },
    hash: { type: 'string', format: 'sha256' },
  },
};

/** The hash seals every field except itself, so flipping reviewStatus or editing content breaks integrity. */
function computeEntryHash(entry) {
  const { hash, ...rest } = entry;
  return hashObject(rest);
}

let cache = null;

function loadRegistry({ dir = SOURCES_DIR, force = false } = {}) {
  if (cache && !force && cache.dir === dir) return cache;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const entries = [];
  const bases = [];
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    bases.push({ file, knowledgeBaseId: doc.knowledgeBaseId, version: doc.version, disclaimer: doc.disclaimer });
    for (const raw of doc.entries || []) {
      const { valid, errors } = check(ENTRY_SCHEMA, raw);
      const integrityOk = valid && computeEntryHash(raw) === raw.hash;
      entries.push({
        ...raw,
        file,
        schemaValid: valid,
        schemaErrors: errors,
        integrityOk,
        usable: integrityOk && raw.reviewStatus === 'approved',
      });
    }
  }
  const version = bases.map((b) => `${b.knowledgeBaseId}@${b.version}`).join('+');
  const contentHash = hashObject(entries.map((e) => e.hash || null));
  cache = { dir, bases, entries, version, contentHash, loadedAt: new Date().toISOString() };
  return cache;
}

function knowledgeBaseVersion() {
  const r = loadRegistry();
  return `${r.version}#${r.contentHash.slice(0, 12)}`;
}

function listSources() {
  return loadRegistry().entries.map((e) => ({
    sourceId: e.sourceId,
    title: e.title,
    authority: e.authority,
    version: e.version,
    effectiveDate: e.effectiveDate,
    scope: e.scope,
    reviewStatus: e.reviewStatus,
    reviewedBy: e.reviewedBy,
    reviewedAt: e.reviewedAt,
    hash: e.hash,
    integrityOk: e.integrityOk,
    usable: e.usable,
  }));
}

module.exports = {
  SOURCES_DIR, ENTRY_SCHEMA, computeEntryHash, loadRegistry, knowledgeBaseVersion, listSources,
};
