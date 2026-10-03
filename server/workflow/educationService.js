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

function normalizeUnit(u) {
  const v = String(u || '').toLowerCase();
  if (v === '克' || v === 'g') return 'g';
  if (v === '千克' || v === 'kg') return 'kg';
  if (v === '毫克' || v === 'mg') return 'mg';
  return v || 'g';
}

function herbClause(blob, herbName, allNames) {
  const start = blob.indexOf(herbName);
  if (start < 0) return '';
  let end = blob.length;
  for (const other of allNames) {
    if (!other || other === herbName) continue;
    const idx = blob.indexOf(other, start + herbName.length);
    if (idx >= 0) end = Math.min(end, idx);
  }
  const cut = blob.slice(start, end);
  const sentence = cut.split(/[。；;\n]/)[0];
  return sentence || cut;
}

function renderTemplate(facts) {
  const herbs = (facts.herbs || []).map((h) => {
    const dose = h.dosage == null ? '' : `${h.dosage}${h.unit || 'g'}`;
    const timing = h.decoctionTiming ? `（${h.decoctionTiming}）` : '';
    return `${h.name}${dose}${timing}`;
  }).join('，');
  const count = facts.doseCount != null ? `共${facts.doseCount}剂` : '';
  return [herbs, count, facts.usage || facts.frequency || ''].filter(Boolean).join('。');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function factsMatchText(facts, text) {
  const blob = String(text || '');
  const problems = [];
  if (!blob.trim()) {
    return { ok: false, problems: [{ code: 'empty_text' }], autoConsistent: false };
  }
  const names = (facts.herbs || []).map((h) => h.name);
  for (const h of facts.herbs || []) {
    if (!blob.includes(h.name) || h.dosage == null) continue;
    const window = herbClause(blob, h.name, names);
    const m = window.match(new RegExp(`${escapeRe(h.name)}\\s*(\\d+(?:\\.\\d+)?)\\s*(g|kg|克|千克|mg|毫克)?`, 'i'));
    if (m) {
      const n = Number(m[1]);
      const unit = normalizeUnit(m[2] || h.unit || 'g');
      const expectedUnit = normalizeUnit(h.unit || 'g');
      if (n !== Number(h.dosage)) {
        problems.push({ code: 'dose_changed', herb: h.name, expected: h.dosage, unit: h.unit, found: m[0] });
      }
      if (m[2] && unit !== expectedUnit) {
        problems.push({ code: 'unit_changed', herb: h.name, expected: h.unit || 'g', found: unit });
      }
    }
    if (h.decoctionTiming === '先煎' && /后下/.test(window) && !/先煎/.test(window)) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '先煎' });
    }
    if (h.decoctionTiming === '后下' && /先煎/.test(window) && !/后下/.test(window)) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '后下' });
    }
  }
  if (facts.doseCount != null) {
    const countHit = blob.match(/共\s*(\d+)\s*剂/);
    if (countHit && Number(countHit[1]) !== Number(facts.doseCount)) {
      problems.push({ code: 'dose_count_changed', expected: facts.doseCount, found: Number(countHit[1]) });
    }
    if (/每周/.test(blob) && /每日|一天|日一剂/.test(String(facts.frequency || facts.usage || ''))) {
      problems.push({ code: 'frequency_changed', expected: facts.frequency || facts.usage });
    }
  }
  const unique = [];
  const seen = new Set();
  for (const p of problems) {
    const k = `${p.code}:${p.herb || ''}:${p.found || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  return { ok: unique.length === 0, problems: unique, autoConsistent: unique.length === 0 };
}

function createDraft(c, actor, { text, aiExplanation = '', source = 'pharmacist' } = {}) {
  const facts = structuredFacts(c);
  if (!facts.usage && !facts.frequency) {
    throw new ServiceError(409, 'usage_unclear', 'Usage is missing; create a clarification task instead of inventing directions');
  }
  const template = renderTemplate(facts);
  const patientText = String(text || template).slice(0, 4000);
  const check = factsMatchText(facts, patientText);
  const extra = String(aiExplanation || '').slice(0, 2000);
  const doc = {
    documentId: randomId('edu'),
    caseId: c.caseId,
    caseContentVersion: c.contentVersion,
    caseContentHash: c.contentHash,
    textVersion: 1,
    analysisId: c.analyses?.at(-1)?.analysisId || null,
    status: 'review_required',
    text: patientText,
    templateText: template,
    aiExplanation: extra,
    structuredFacts: facts,
    source,
    genericFixedNotice: source === 'fixed_template',
    consistency: { ...check, autoConsistent: check.ok && !extra },
    createdBy: String(actor.id),
    createdAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    receivedAt: null,
    understoodAt: null,
    textHash: null,
  };
  doc.textHash = contentHashOf(doc);
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
  if (doc.status === 'superseded') throw new ServiceError(409, 'education_superseded', 'Superseded education cannot be revived');
  if (doc.caseContentVersion !== c.contentVersion || doc.caseContentHash !== c.contentHash) {
    throw new ServiceError(409, 'stale_education', 'Education document does not match current prescription content');
  }
  const check = factsMatchText(doc.structuredFacts, doc.text);
  if (!check.ok) throw new ServiceError(409, 'education_inconsistent', 'Simplification changed a dose, count or unit', check.problems);
  check.autoConsistent = check.ok && !doc.aiExplanation;
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
  renderTemplate,
};
