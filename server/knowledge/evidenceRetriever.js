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
  let evidenceStrength = 'none';
  if (hits.length === 0) evidenceStrength = retrieved.length ? 'moderate' : 'limited';
  else if (missingEvidenceFor.length === 0) evidenceStrength = 'strong';
  else if (missingEvidenceFor.length < hits.length) evidenceStrength = 'moderate';
  else evidenceStrength = 'limited';
  return { hits, retrieved, missingEvidenceFor, evidenceStrength };
}

module.exports = { retrieve };
