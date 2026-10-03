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

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function factsMatchText(facts, text) {
  const blob = String(text || '');
  const problems = [];
  const numerals = [...blob.matchAll(/(\d+(?:\.\d+)?)\s*(g|kg|克|千克|mg)?/gi)].map((m) => ({
    n: Number(m[1]), unit: (m[2] || '').toLowerCase(), raw: m[0],
  }));
  for (const h of facts.herbs) {
    if (h.dosage == null) continue;
    const expected = Number(h.dosage);
    const herbNearby = blob.includes(h.name);
    const exact = new RegExp(`(?<!\\d)${escapeRe(String(h.dosage))}(?!\\d)`);
    if (herbNearby) {
      const wrong = numerals.filter((x) => x.n !== expected && (x.unit === 'kg' || x.n === expected * 10 || x.n === expected * 100));
      if (wrong.length) problems.push({ code: 'dose_changed', herb: h.name, expected: h.dosage, unit: h.unit, found: wrong.map((w) => w.raw) });
    }
    if (blob.includes(String(h.dosage)) && !exact.test(blob)) {
      problems.push({ code: 'dose_substring_match', herb: h.name, expected: h.dosage, unit: h.unit });
    }
    if (h.unit === 'g' && /(?:kg|千克)/i.test(blob) && herbNearby) {
      problems.push({ code: 'unit_changed', herb: h.name, expected: h.unit });
    }
    if (h.decoctionTiming === '先煎' && /后下/.test(blob) && herbNearby) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '先煎' });
    }
    if (h.decoctionTiming === '后下' && /先煎/.test(blob) && herbNearby) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '后下' });
    }
  }
  if (facts.doseCount != null) {
    if (/每周/.test(blob) && /每日|一天/.test(String(facts.frequency || facts.usage || ''))) {
      problems.push({ code: 'frequency_changed', expected: facts.frequency || facts.usage });
    }
  }
  if (!blob.trim()) problems.push({ code: 'empty_text' });
  return { ok: problems.length === 0, problems, autoConsistent: problems.length === 0 };
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
  if (doc.status === 'superseded') throw new ServiceError(409, 'education_superseded', 'Superseded education cannot be revived');
  if (doc.status !== 'approved') throw new ServiceError(409, 'not_approved', 'Education must be approved before publish');
  if (!c.approval?.valid) throw new ServiceError(409, 'prescription_not_approved', 'Education cannot be published before the current prescription is approved');
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
