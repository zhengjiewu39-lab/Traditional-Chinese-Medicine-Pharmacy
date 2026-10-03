const { randomId, hashObject } = require('../common/hash');
const { ServiceError } = require('./errors');

const STATUSES = ['draft', 'review_required', 'approved', 'published', 'superseded'];

const CN_NUM = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

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

function parseNumberToken(raw) {
  const s = String(raw || '').trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  if (Object.prototype.hasOwnProperty.call(CN_NUM, s)) return CN_NUM[s];
  if (s.startsWith('十') && s.length === 2 && CN_NUM[s[1]] != null) return 10 + CN_NUM[s[1]];
  return NaN;
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
  let covered = 0;
  if (!blob.trim()) {
    return { ok: false, verdict: 'empty', problems: [{ code: 'empty_text' }], autoConsistent: false };
  }
  const names = (facts.herbs || []).map((h) => h.name);
  for (const h of facts.herbs || []) {
    if (!blob.includes(h.name)) {
      problems.push({ code: 'herb_missing', herb: h.name });
      continue;
    }
    if (h.dosage == null) continue;
    const window = herbClause(blob, h.name, names);
    const m = window.match(new RegExp(`${escapeRe(h.name)}(?:每日|每天|一日)?\\s*(\\d+(?:\\.\\d+)?|[一二三四五六七八九十两])\\s*(g|kg|克|千克|mg|毫克)?`, 'i'));
    if (!m) {
      problems.push({ code: 'dose_unverified', herb: h.name, expected: h.dosage });
      continue;
    }
    const n = parseNumberToken(m[1]);
    const unit = normalizeUnit(m[2] || h.unit || 'g');
    const expectedUnit = normalizeUnit(h.unit || 'g');
    if (n !== Number(h.dosage)) {
      problems.push({ code: 'dose_changed', herb: h.name, expected: h.dosage, unit: h.unit, found: m[0] });
    } else if (m[2] && unit !== expectedUnit) {
      problems.push({ code: 'unit_changed', herb: h.name, expected: h.unit || 'g', found: unit });
    } else {
      covered += 1;
    }
    if (h.decoctionTiming === '先煎' && /后下/.test(window) && !/先煎/.test(window)) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '先煎' });
    }
    if (h.decoctionTiming === '后下' && /先煎/.test(window) && !/后下/.test(window)) {
      problems.push({ code: 'decoction_changed', herb: h.name, expected: '后下' });
    }
  }
  if (facts.doseCount != null) {
    const countHit = blob.match(/共\s*(\d+|[一二三四五六七八九十两])\s*剂/);
    if (countHit) {
      const n = parseNumberToken(countHit[1]);
      if (n !== Number(facts.doseCount)) {
        problems.push({ code: 'dose_count_changed', expected: facts.doseCount, found: n });
      }
    } else {
      problems.push({ code: 'dose_count_unverified', expected: facts.doseCount });
    }
    const daily = blob.match(/每[日天]\s*(\d+|[一二三四五六七八九十两])\s*剂/);
    const expectedDaily = /日一剂|每日一剂|一天一剂/.test(String(facts.frequency || facts.usage || ''));
    if (daily && expectedDaily && parseNumberToken(daily[1]) !== 1) {
      problems.push({ code: 'frequency_changed', expected: facts.frequency || facts.usage, found: daily[0] });
    }
    if (/每周/.test(blob) && expectedDaily) {
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
  const required = (facts.herbs || []).filter((h) => h.dosage != null).length + (facts.doseCount != null ? 1 : 0);
  const complete = unique.length === 0 && covered === (facts.herbs || []).filter((h) => h.dosage != null).length && required > 0;
  return {
    ok: complete,
    verdict: complete ? 'complete' : (unique.length ? 'inconsistent' : 'unknown'),
    problems: unique,
    autoConsistent: false,
  };
}

function createDraft(c, actor, { text, aiExplanation = '', source = 'pharmacist' } = {}) {
  const facts = structuredFacts(c);
  if (!facts.usage && !facts.frequency) {
    throw new ServiceError(409, 'usage_unclear', 'Usage is missing; create a clarification task instead of inventing directions');
  }
  const template = renderTemplate(facts);
  const extra = String(aiExplanation || text || '').slice(0, 2000);
  const explanationCheck = extra
    ? factsMatchText(facts, extra)
    : { ok: false, verdict: 'unknown', problems: [], autoConsistent: false };
  const check = {
    ok: true,
    verdict: 'template_locked',
    problems: [],
    autoConsistent: false,
    directionsLocked: true,
    explanation: explanationCheck,
  };
  const doc = {
    documentId: randomId('edu'),
    caseId: c.caseId,
    caseContentVersion: c.contentVersion,
    caseContentHash: c.contentHash,
    textVersion: 1,
    analysisId: c.analyses?.at(-1)?.analysisId || null,
    status: extra ? 'review_required' : 'review_required',
    text: template,
    directionsText: template,
    templateText: template,
    aiExplanation: extra,
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
    textHash: null,
    directionsLocked: true,
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
  const expected = renderTemplate(doc.structuredFacts || structuredFacts(c));
  if ((doc.directionsText || doc.templateText || doc.text) !== expected) {
    throw new ServiceError(409, 'education_inconsistent', 'Directions were altered away from the current prescription template');
  }
  doc.text = expected;
  doc.directionsText = expected;
  doc.status = 'approved';
  doc.approvedBy = String(actor.id);
  doc.approvedAt = new Date().toISOString();
  doc.consistency = {
    ok: true,
    verdict: 'template_locked',
    problems: [],
    autoConsistent: false,
    directionsLocked: true,
  };
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
  return hashObject({ directions: doc.directionsText || doc.text, facts: doc.structuredFacts, explanation: doc.aiExplanation || '', version: doc.textVersion });
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
