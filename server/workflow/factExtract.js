/**
 * Extract candidate clinical facts from patient narrative.
 * Model output is never verified. Source spans must appear in the input text.
 */
const { FIELD_VALUE_SCHEMA, coerceFactValue } = require('./clinicalFacts');
const { FIELD_WHITELIST } = require('./clarificationService');

const NEGATION = /不(是|会|曾)?|没有|无|否认|未曾|未再|不是/;
const HISTORY = /以前|曾经|几年前|病史|既往/;
const FAMILY = /父亲|母亲|家人|家属|老公|妻子|孩子/;
const HYPOTHESIS = /如果|要是|可能|怀疑/;

function spanExists(text, span) {
  return Boolean(span && String(text).includes(String(span)));
}

function clauseAround(blob, idx, len = 12) {
  const start = Math.max(0, idx - 8);
  const end = Math.min(blob.length, idx + len + 12);
  return blob.slice(start, end);
}

function negated(clause) {
  return NEGATION.test(clause);
}

function heuristicExtract(text) {
  const blob = String(text || '');
  const out = [];
  const push = (row) => out.push({ ...row, extractedBy: 'heuristic_fallback', heuristicFallback: true, needsConfirmation: true, status: 'pending_confirmation', candidateScore: null });

  const preg = blob.search(/怀孕|妊娠|备孕/);
  if (preg >= 0) {
    const clause = clauseAround(blob, preg);
    if (FAMILY.test(clause) || HYPOTHESIS.test(clause)) {
      /* skip relative / hypothetical */
    } else if (negated(clause)) {
      push({ fieldPath: 'patient.facts.pregnancy', candidateValue: 'no', sourceText: clause.trim(), proposedStatus: 'none' });
    } else {
      push({ fieldPath: 'patient.facts.pregnancy', candidateValue: 'yes', sourceText: clause.trim(), proposedStatus: 'reported' });
    }
  }
  const liver = blob.search(/肝[功能脏]?(异常|不好|损害)|肝炎/);
  if (liver >= 0) {
    const clause = clauseAround(blob, liver);
    if (FAMILY.test(clause) || HYPOTHESIS.test(clause)) {
      /* skip */
    } else if (negated(clause) && !HISTORY.test(clause)) {
      push({ fieldPath: 'patient.facts.liverImpairment', candidateValue: false, sourceText: clause.trim(), proposedStatus: 'none' });
    } else if (HISTORY.test(clause) && /现在|目前|仍在|还在治疗|正在治疗/.test(clause)) {
      push({ fieldPath: 'patient.facts.liverImpairment', candidateValue: true, sourceText: clause.trim(), proposedStatus: 'reported' });
    } else if (HISTORY.test(clause)) {
      /* History alone is not current impairment and is not proof of none. */
    } else {
      push({ fieldPath: 'patient.facts.liverImpairment', candidateValue: true, sourceText: clause.trim(), proposedStatus: 'reported' });
    }
  }
  const med = blob.match(/正在服用\s*([^。；;\n]+)|在吃\s*([^。；;\n]+)|合并用药[:：]?\s*([^。；;\n]+)/);
  if (med) {
    const clause = med[0];
    if (!negated(clause)) {
      const names = String(med[1] || med[2] || med[3] || '').split(/[、,，和与]/).map((s) => s.trim()).filter((s) => s && !/true|false|没有/.test(s));
      if (names.length) push({ fieldPath: 'patient.facts.currentMedications', candidateValue: names, sourceText: clause, proposedStatus: 'reported' });
    }
  }
  const age = blob.match(/(\d{1,3})\s*岁/);
  if (age) push({ fieldPath: 'patient.facts.ageYears', candidateValue: Number(age[1]), sourceText: age[0], proposedStatus: 'reported' });
  return out;
}

function whitelistOnly(candidates, sourceText) {
  return (candidates || []).filter((c) => {
    if (!FIELD_WHITELIST.has(c.fieldPath) && !FIELD_VALUE_SCHEMA[c.fieldPath]) return false;
    if (!c.sourceText || !spanExists(sourceText, c.sourceText)) return false;
    return true;
  }).map((c) => ({
    ...c,
    status: 'pending_confirmation',
    verifiedBy: undefined,
    verifiedAt: undefined,
    needsConfirmation: true,
  }));
}

async function modelExtract(text, provider, { timeoutMs = 8000 } = {}) {
  if (!provider || typeof provider.complete !== 'function') return { candidates: [], called: false };
  const messages = [
    {
      role: 'system',
      content: 'Extract only whitelist patient facts as JSON {candidates:[{fieldPath,value,sourceText,negated,temporal}]}. sourceText must be a verbatim substring covering the full claim, including negation and tense. temporal must be current|history|family|hypothesis. Do not emit a current negative fact from history alone. Do not invent diagnoses or prescriptions. Do not mark verified.',
    },
    { role: 'user', content: String(text || '').slice(0, 2000) },
  ];
  let raw;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    raw = await provider.complete({ messages, jsonSchema: { type: 'object' }, signal: controller?.signal });
  } catch (err) {
    return { candidates: [], called: true, invalid: true, error: err.name === 'AbortError' ? 'timeout' : 'error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { candidates: [], called: true, invalid: true }; }
  const rows = [];
  for (const c of parsed.candidates || []) {
    if (!c.sourceText || !spanExists(text, c.sourceText)) continue;
    if (c.temporal === 'history' || c.temporal === 'family' || c.temporal === 'hypothesis') continue;
    const status = c.negated ? 'none' : 'reported';
    try {
      const coerced = coerceFactValue(c.fieldPath, status, c.negated ? (FIELD_VALUE_SCHEMA[c.fieldPath]?.type === 'list' ? [] : c.value) : c.value);
      rows.push({
        fieldPath: c.fieldPath,
        candidateValue: coerced.value,
        proposedStatus: coerced.status,
        sourceText: c.sourceText,
        extractedBy: provider.isMock ? 'mock_model' : 'model',
        heuristicFallback: false,
        needsConfirmation: true,
        status: 'pending_confirmation',
        candidateScore: null,
      });
    } catch { /* skip illegal */ }
  }
  return { candidates: rows, called: true };
}

async function extractCandidateFacts(c, { provider, timeoutMs, aiEnabled } = {}) {
  const text = c.source?.rawText || c.patient?.narrative || '';
  if (!text.trim()) {
    return { candidates: [], provider: 'none', isMock: Boolean(provider?.isMock), modelDidNotVerify: true, extractSource: 'empty', modelCalled: false };
  }
  if (aiEnabled === false || !provider || typeof provider.complete !== 'function') {
    return {
      candidates: whitelistOnly(heuristicExtract(text), text),
      provider: 'heuristic_fallback',
      isMock: false,
      modelDidNotVerify: true,
      extractSource: 'heuristic_fallback',
      modelCalled: false,
      fallbackReason: aiEnabled === false ? 'ai_disabled' : 'no_provider',
    };
  }
  const modeled = await modelExtract(text, provider, { timeoutMs });
  if (modeled.called && !modeled.invalid) {
    return {
      candidates: whitelistOnly(modeled.candidates, text),
      provider: provider.id || 'model',
      isMock: Boolean(provider.isMock),
      modelDidNotVerify: true,
      extractSource: provider.isMock ? 'mock_model' : 'live_model',
      modelCalled: true,
    };
  }
  return {
    candidates: whitelistOnly(heuristicExtract(text), text),
    provider: 'heuristic_fallback',
    isMock: false,
    modelDidNotVerify: true,
    extractSource: 'heuristic_fallback',
    modelCalled: Boolean(modeled.called),
    fallbackReason: modeled.error || 'invalid_or_failed',
  };
}

function attachCandidates(c, extracted) {
  c.factCandidates = [...(c.factCandidates || []), ...(extracted.candidates || []).map((row) => ({
    ...row,
    candidateId: row.candidateId || `cand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    caseId: c.caseId,
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
  modelExtract,
};
