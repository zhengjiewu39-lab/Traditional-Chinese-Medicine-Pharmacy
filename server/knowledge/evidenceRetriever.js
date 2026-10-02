const { getUsable, usableEntries } = require('./knowledgeRepository');

function publicView(e) {
  return {
    sourceId: e.sourceId,
    title: e.title,
    authority: e.authority,
    version: e.version,
    effectiveDate: e.effectiveDate,
    content: e.content,
    hash: e.hash,
    excerpt: String(e.content || '').slice(0, 280),
    synthetic: Boolean(e.synthetic),
    validFrom: e.validFrom || null,
    validTo: e.validTo || null,
    sourceType: e.sourceType || 'document',
  };
}

/**
 * Deterministic retrieval: evidence is attached by rule mapping first, then by herb scope.
 * Only approved, hash-verified entries are ever returned.
 */
function retrieve({ ruleHits = [], herbNames = [] }) {
  const byId = new Map();
  const missingEvidenceFor = [];
  const hits = ruleHits.map((hit) => {
    const found = (hit.candidateEvidenceIds || []).map(getUsable).filter(Boolean);
    found.forEach((e) => byId.set(e.sourceId, e));
    if (found.length === 0) missingEvidenceFor.push(hit.code);
    return { ...hit, evidenceIds: found.map((e) => e.sourceId) };
  });
  for (const e of usableEntries()) {
    const scoped = e.scope?.herbs || [];
    if (scoped.length && herbNames.some((n) => scoped.some((s) => n.includes(s)))) byId.set(e.sourceId, e);
  }
  const retrieved = [...byId.values()].map(publicView);
  let retrievalCoverage = 'none';
  if (hits.length === 0) retrievalCoverage = retrieved.length ? 'partial' : 'none';
  else if (missingEvidenceFor.length === 0) retrievalCoverage = 'complete';
  else if (missingEvidenceFor.length < hits.length) retrievalCoverage = 'partial';
  let evidenceStrength = 'none';
  if (hits.length === 0) evidenceStrength = retrieved.length ? 'moderate' : 'limited';
  else if (missingEvidenceFor.length === 0) evidenceStrength = 'moderate';
  else if (missingEvidenceFor.length < hits.length) evidenceStrength = 'limited';
  else evidenceStrength = 'none';
  return {
    hits, retrieved, missingEvidenceFor, evidenceStrength,
    retrievalCoverage,
    evidenceQuality: 'not_assessed',
    note: 'evidenceStrength here is retrieval coverage, not clinical evidence strength. Citation presence does not mean the citation supports the claim.',
  };
}

module.exports = { retrieve };
