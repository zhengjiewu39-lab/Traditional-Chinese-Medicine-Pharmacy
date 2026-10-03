/**
 * PHI minimisation and log redaction.
 * Direct identifiers never reach the model or the audit payload; secrets never reach any log.
 */

const { clinicalProjection } = require('../workflow/clinicalFacts');

const IDENTIFIER_KEYS = new Set(['name', 'patientName', 'phone', 'mobile', 'idCard', 'address', 'email', 'contact', 'contactPhone']);
const SECRET_KEYS = new Set(['token', 'accessToken', 'apiKey', 'authorization', 'password', 'passwordHash', 'secret']);
const MAX_LOG_STRING = 500;

const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const ID_CARD_RE = /(?<![0-9Xx])\d{17}[\dXx](?![0-9Xx])/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/g;
const API_KEY_RE = /\bsk-[A-Za-z0-9_-]{8,}\b/g;

function scrubText(s) {
  return String(s)
    .replace(PHONE_RE, '[phone]')
    .replace(ID_CARD_RE, '[id]')
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(API_KEY_RE, '[api-key]');
}

/** Shorten a secret for logs: keep 4 leading characters, never the full value. */
function fingerprint(secret) {
  if (!secret) return null;
  const s = String(secret);
  return `${s.slice(0, 4)}…(${s.length})`;
}

function redactForLog(value, depth = 0) {
  if (depth > 8) return '[depth]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const s = scrubText(value);
    return s.length > MAX_LOG_STRING ? `${s.slice(0, MAX_LOG_STRING)}…[${s.length}]` : s;
  }
  if (Array.isArray(value)) return value.map((v) => redactForLog(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (SECRET_KEYS.has(k)) out[k] = typeof v === 'string' ? fingerprint(v) : '[redacted]';
    else if (IDENTIFIER_KEYS.has(k)) out[k] = '[redacted]';
    else out[k] = redactForLog(v, depth + 1);
  }
  return out;
}

function ageBand(age) {
  if (typeof age !== 'number') return 'unknown';
  if (age < 1) return '<1';
  if (age <= 12) return '1-12';
  if (age <= 17) return '13-17';
  if (age < 65) return '18-64';
  if (age < 80) return '65-79';
  return '80+';
}

function weightKgRounded(kg) {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return null;
  return Math.round(kg);
}

/**
 * Minimum clinical context for the semantic track: no name, phone, address or ID;
 * age reduced to a band; free text scrubbed of phone and ID patterns.
 */
function minimiseCaseForModel(c) {
  const p = clinicalProjection(c.patient || {});
  const rx = c.prescription || {};
  const clinical = c.clinical || {};
  return {
    caseRef: c.caseId,
    patient: {
      ageBand: ageBand(p.ageYears),
      weightKg: weightKgRounded(p.weightKg),
      sex: p.sex || 'unknown',
      pregnancy: p.pregnancy ?? 'unknown',
      lactation: p.lactation ?? 'unknown',
      allergies: {
        status: p.allergyStatus,
        names: (Array.isArray(p.allergies) ? p.allergies : []).map(scrubText),
      },
      allergySeverity: c.patient?.allergySeverity || 'unknown',
      liverImpairment: { status: p.liverStatus, reportedTrue: p.liverImpairment === true },
      renalImpairment: { status: p.renalStatus, reportedTrue: p.renalImpairment === true },
      currentMedications: {
        status: p.medicationStatus,
        names: (Array.isArray(p.currentMedications) ? p.currentMedications : []).map(scrubText),
      },
    },
    diagnosisText: scrubText(rx.diagnosisText || clinical.diagnosisText || ''),
    clinicalNotes: scrubText(rx.clinicalNotes || clinical.notes || ''),
    prescription: {
      herbs: (rx.herbs || []).map((h) => ({
        name: h.name,
        dosage: h.dosage,
        unit: h.unit,
        processing: h.processing || null,
        decoctionTiming: h.decoctionTiming || null,
      })),
      doseCount: rx.doseCount ?? null,
      frequency: rx.frequency ?? null,
      usage: rx.usage ?? null,
      form: rx.form ?? null,
      decoctionNotes: rx.decoctionNotes ? scrubText(rx.decoctionNotes) : null,
    },
    freeText: c.source?.rawText ? scrubText(c.source.rawText) : '',
  };
}

module.exports = {
  redactForLog, minimiseCaseForModel, scrubText, fingerprint, ageBand, weightKgRounded,
};
