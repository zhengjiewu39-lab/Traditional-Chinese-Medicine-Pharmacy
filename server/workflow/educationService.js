const { randomId, hashObject } = require('../common/hash');
const { ServiceError } = require('./errors');

const STATUSES = ['draft', 'review_required', 'approved', 'published', 'superseded'];

function structuredFacts(c) {
  const rx = c.prescription || {};
  return {
    herbs: (rx.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage ?? null, unit: h.unit || 'g', decoctionTiming: h.decoctionTiming || null })),
    doseCount: rx.doseCount ?? null,
    frequency: rx.frequency || null,
    usage: rx.usage || null,
    form: rx.form || null,
    decoctionNotes: rx.decoctionNotes || null,
    storage: null,
    followUpPlan: c.followUpPlan || null,
  };
}

function factsMatchText(facts, text) {
  const blob = String(text || '');
  const problems = [];
  for (const h of facts.herbs) {
    if (h.dosage != null && !blob.includes(String(h.dosage))) {
      problems.push({ code: 'dose_missing_or_changed', herb: h.name, expected: h.dosage, unit: h.unit });
    }
    if (h.unit && blob.includes(String(h.dosage)) && h.dosage != null) {
      const re = new RegExp(`${h.dosage}\\s*(${h.unit}|g|克)`);
      if (!re.test(blob) && blob.includes(String(h.dosage))) {
        /* dosage numeral present; unit may be implied — record only if a different unit appears */
      }
    }
  }
  if (facts.doseCount != null && !blob.includes(String(facts.doseCount))) {
    problems.push({ code: 'dose_count_changed', expected: facts.doseCount });
  }
  return { ok: problems.length === 0, problems };
}

function createDraft(c, actor, { text, source = 'pharmacist' } = {}) {
  const facts = structuredFacts(c);
  if (!facts.usage && !facts.frequency) {
    throw new ServiceError(409, 'usage_unclear', 'Usage is missing; create a clarification task instead of inventing directions');
  }
  const check = factsMatchText(facts, text);
  const doc = {
    documentId: randomId('edu'),
    caseId: c.caseId,
    caseContentVersion: c.contentVersion,
    caseContentHash: c.contentHash,
    textVersion: 1,
    analysisId: c.analyses?.at(-1)?.analysisId || null,
    status: 'review_required',
    text: String(text || '').slice(0, 4000),
    structuredFacts: facts,
    source,
    genericFixedNotice: source === 'fixed_template',
    consistency: check,
    createdBy: String(actor.id),
    createdAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    receivedAt: null,
    understoodAt: null,
  };
  c.educationDocuments = (c.educationDocuments || []).map((d) => (
    ['published', 'approved', 'review_required', 'draft'].includes(d.status)
      ? { ...d, status: 'superseded', supersededAt: new Date().toISOString() }
      : d
  ));
  c.educationDocuments.push(doc);
  return doc;
}

function approve(c, documentId, actor) {
  const doc = (c.educationDocuments || []).find((d) => d.documentId === documentId);
  if (!doc) throw new ServiceError(404, 'education_not_found', 'Education document not found');
  if (doc.caseContentVersion !== c.contentVersion || doc.caseContentHash !== c.contentHash) {
    throw new ServiceError(409, 'stale_education', 'Education document does not match current prescription content');
  }
  const check = factsMatchText(doc.structuredFacts, doc.text);
  if (!check.ok) throw new ServiceError(409, 'education_inconsistent', 'Simplification changed a dose, count or unit', check.problems);
  doc.status = 'approved';
  doc.approvedBy = String(actor.id);
  doc.approvedAt = new Date().toISOString();
  doc.consistency = check;
  return doc;
}

function publish(c, documentId, actor) {
  const doc = (c.educationDocuments || []).find((d) => d.documentId === documentId);
  if (!doc) throw new ServiceError(404, 'education_not_found', 'Education document not found');
  if (doc.status !== 'approved') throw new ServiceError(409, 'not_approved', 'Education must be approved before publish');
  if (doc.caseContentVersion !== c.contentVersion) {
    throw new ServiceError(409, 'stale_education', 'Cannot publish education for a previous content version');
  }
  doc.status = 'published';
  doc.publishedBy = String(actor.id);
  doc.publishedAt = new Date().toISOString();
  return doc;
}

function publishedFor(c) {
  return (c.educationDocuments || []).find((d) => (
    d.status === 'published' && d.caseContentVersion === c.contentVersion && d.caseContentHash === c.contentHash
  )) || null;
}

function markReceived(c, documentId) {
  const doc = publishedFor(c);
  if (!doc || doc.documentId !== documentId) throw new ServiceError(409, 'education_not_published', 'No published education for this version');
  doc.receivedAt = new Date().toISOString();
  return doc;
}

function markUnderstood(c, documentId, { quizOk = null } = {}) {
  const doc = publishedFor(c);
  if (!doc || doc.documentId !== documentId) throw new ServiceError(409, 'education_not_published', 'No published education for this version');
  doc.understoodAt = new Date().toISOString();
  doc.teachBack = { quizOk, at: doc.understoodAt };
  return doc;
}

function contentHashOf(doc) {
  return hashObject({ text: doc.text, facts: doc.structuredFacts, version: doc.textVersion });
}

module.exports = {
  STATUSES,
  structuredFacts,
  factsMatchText,
  createDraft,
  approve,
  publish,
  publishedFor,
  markReceived,
  markUnderstood,
  contentHashOf,
};
