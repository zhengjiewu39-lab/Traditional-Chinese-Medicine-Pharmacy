/**
 * Build evaluation cases from a frozen pack.
 * Hidden labels never enter the visible case object used by the system under test.
 */
const HIDDEN_KEYS = ['hiddenPatientFacts', 'patientAnswerScript', 'expertReferenceLabels', 'expected'];

function deepMerge(base, over) {
  if (over === undefined) return base;
  if (over === null || Array.isArray(over) || typeof over !== 'object' || typeof base !== 'object' || !base) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

function issuedAtFromOffset(offsetDays, now = new Date()) {
  const n = Number(offsetDays || 0);
  return new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);
}

function buildVisibleCase(pack, raw, { now = new Date() } = {}) {
  const defaults = pack.defaults || {};
  const observed = raw.initialObservedFacts || raw.patient || {};
  const patient = deepMerge(defaults.patient, observed);
  const prescriber = raw.prescriber === null ? null : deepMerge(defaults.prescriber, raw.prescriber);
  const prescription = deepMerge(defaults.prescription, raw.prescription || {});
  const offset = prescription.issuedAtOffsetDays;
  const issuedAt = prescription.issuedAt || issuedAtFromOffset(offset, now);
  const { issuedAtOffsetDays: _drop, ...rx } = prescription;
  return {
    caseId: raw.id || raw.caseId,
    source: deepMerge(defaults.source, raw.source),
    patient,
    prescriber,
    prescription: { ...rx, issuedAt },
    category: raw.category || null,
    dataMode: 'synthetic_benchmark',
  };
}

function hiddenBundle(raw) {
  return {
    hiddenPatientFacts: raw.hiddenPatientFacts || null,
    patientAnswerScript: raw.patientAnswerScript || null,
    expertReferenceLabels: raw.expertReferenceLabels || null,
    expected: raw.expected || null,
    reviewStatus: raw.expertReviewStatus || (raw.expertReferenceLabels ? 'unreviewed' : 'rule_derived_not_gold'),
  };
}

function containsHiddenKeys(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((v, i) => containsHiddenKeys(v, `${path}[${i}]`, hits));
    return hits;
  }
  for (const [k, v] of Object.entries(value)) {
    if (HIDDEN_KEYS.includes(k)) hits.push(`${path}.${k}`);
    containsHiddenKeys(v, `${path}.${k}`, hits);
  }
  return hits;
}

function assertNoHiddenLeak(visible) {
  const hits = containsHiddenKeys(visible);
  if (hits.length) {
    const err = new Error(`hidden evaluation fields leaked: ${hits.join(', ')}`);
    err.code = 'hidden_label_leak';
    throw err;
  }
  return true;
}

function answerFromScript(hidden, fieldPath) {
  const script = hidden?.patientAnswerScript;
  if (!script) return null;
  const row = script[fieldPath] || script[fieldPath.replace('patient.facts.', '')];
  if (!row) return null;
  return { ...row, fromScript: true };
}

module.exports = {
  HIDDEN_KEYS,
  deepMerge,
  buildVisibleCase,
  hiddenBundle,
  containsHiddenKeys,
  assertNoHiddenLeak,
  answerFromScript,
  issuedAtFromOffset,
};
