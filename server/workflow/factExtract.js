/**
 * Extract candidate clinical facts from patient narrative.
 * Model output is never verified. Source spans must appear in the input text.
 */
const { FIELD_VALUE_SCHEMA, coerceFactValue } = require('./clinicalFacts');
const { FIELD_WHITELIST } = require('./clarificationService');

const KEYWORDS = [
  { fieldPath: 'patient.facts.allergies', re: /过敏[于到]?([^。；;\n]+)|对([^。；;\n]{1,20})过敏/ },
  { fieldPath: 'patient.facts.pregnancy', re: /怀孕|妊娠|备孕/ },
  { fieldPath: 'patient.facts.lactation', re: /哺乳|在喂奶/ },
  { fieldPath: 'patient.facts.liverImpairment', re: /肝[功能脏]?(异常|不好|损害)|肝炎/ },
  { fieldPath: 'patient.facts.renalImpairment', re: /肾[功能脏]?(异常|不好|损害)|肾炎/ },
  { fieldPath: 'patient.facts.ageYears', re: /(\d{1,3})\s*岁/ },
  { fieldPath: 'patient.facts.weightKg', re: /(\d{2,3}(?:\.\d)?)\s*公斤|体重\s*(\d{2,3}(?:\.\d)?)/ },
  { fieldPath: 'patient.facts.currentMedications', re: /在吃|正在服用|合并用药[:：]?\s*([^。；;\n]+)/ },
];

function spanExists(text, span) {
  return Boolean(span && String(text).includes(String(span)));
}

function heuristicExtract(text) {
  const blob = String(text || '');
  const out = [];
  for (const row of KEYWORDS) {
    const m = blob.match(row.re);
    if (!m) continue;
    const sourceText = m[0];
    if (!spanExists(blob, sourceText)) continue;
    let raw = m[1] || m[2] || true;
    if (row.fieldPath === 'patient.facts.pregnancy' || row.fieldPath === 'patient.facts.lactation') raw = 'yes';
    if (row.fieldPath === 'patient.facts.liverImpairment' || row.fieldPath === 'patient.facts.renalImpairment') raw = true;
    if (row.fieldPath.endsWith('allergies') || row.fieldPath.endsWith('currentMedications')) {
      raw = String(raw).split(/[、,，和与]/).map((s) => s.trim()).filter(Boolean);
    }
    if (row.fieldPath.endsWith('ageYears') || row.fieldPath.endsWith('weightKg')) raw = Number(raw);
    let coerced;
    try {
      coerced = coerceFactValue(row.fieldPath, 'reported', raw);
    } catch {
      continue;
    }
    out.push({
      fieldPath: row.fieldPath,
      candidateValue: coerced.value,
      status: 'pending_confirmation',
      sourceText,
      needsConfirmation: true,
      extractedBy: 'heuristic',
      candidateScore: null,
    });
  }
  return out;
}

function whitelistOnly(candidates, sourceText) {
  return (candidates || []).filter((c) => {
    if (!FIELD_WHITELIST.has(c.fieldPath) && !FIELD_VALUE_SCHEMA[c.fieldPath]) return false;
    if (c.sourceText && !spanExists(sourceText, c.sourceText)) return false;
    return true;
  }).map((c) => ({
    ...c,
    status: 'pending_confirmation',
    verifiedBy: undefined,
    verifiedAt: undefined,
    needsConfirmation: true,
  }));
}

function extractCandidateFacts(c, { provider } = {}) {
  const text = c.source?.rawText || c.patient?.narrative || '';
  const heuristic = heuristicExtract(text);
  return {
    candidates: whitelistOnly(heuristic, text),
    provider: provider?.id || 'heuristic',
    isMock: Boolean(provider?.isMock),
    modelDidNotVerify: true,
  };
}

function attachCandidates(c, extracted) {
  c.factCandidates = [...(c.factCandidates || []), ...(extracted.candidates || []).map((row) => ({
    ...row,
    caseContentVersion: c.contentVersion,
    createdAt: new Date().toISOString(),
  }))];
  return c.factCandidates;
}

module.exports = {
  extractCandidateFacts,
  attachCandidates,
  heuristicExtract,
  whitelistOnly,
};
