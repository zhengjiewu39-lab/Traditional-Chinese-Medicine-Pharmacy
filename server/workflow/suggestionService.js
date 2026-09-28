const { randomId, hashObject } = require('../common/hash');
const repo = require('./workflowRepository');
const { ServiceError } = require('./errors');

const STATUSES = ['pending', 'accepted', 'partially_accepted', 'rejected', 'ignored', 'superseded'];
const REASON_CODES = [
  'clinically_appropriate', 'patient_specific', 'evidence_insufficient', 'wrong_context',
  'dose_adjusted_instead', 'already_addressed', 'disagrees_with_experience', 'other',
];

function persist(s) {
  return repo.saveSuggestion(s);
}

function suggestionsFromAnalysis({ draftId, caseId, analysis, inputHash }) {
  const out = analysis.output || analysis;
  const createdAt = new Date().toISOString();
  const base = {
    draftId: draftId || null,
    caseId: caseId || null,
    modelProvider: out.semanticTrackResult?.provider || null,
    modelVersion: out.modelVersion,
    promptVersion: out.promptVersion,
    knowledgeBaseVersion: out.knowledgeBaseVersion,
    inputHash,
    outputHash: hashObject({
      riskTier: out.riskTier, hardStops: out.hardStops, alerts: out.alerts, missing: out.missingInformation,
    }),
    createdAt,
    status: 'pending',
    disposition: null,
    pharmacistAcknowledged: null,
    retainedInFinal: null,
    caseFinalState: null,
  };

  const items = [];
  for (const h of out.hardStops || []) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: 'contraindication',
      targetField: 'prescription.herbs',
      severity: 'A3',
      message: h.message,
      proposedChange: null,
      evidenceIds: h.evidenceIds || [],
      evidenceStrength: (h.evidenceIds || []).length ? out.evidenceStrength : 'none',
      uncertainty: out.abstain ? 'high' : 'low',
      ruleIds: h.ruleId ? [h.ruleId] : [],
      confidence: (h.evidenceIds || []).length ? 0.9 : 0.3,
    });
  }
  for (const a of out.alerts || []) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: a.source === 'ai' ? 'model_warning' : 'rule_warning',
      targetField: 'prescription',
      severity: a.tier || 'A2',
      message: a.message,
      proposedChange: null,
      evidenceIds: a.evidenceIds || [],
      evidenceStrength: (a.evidenceIds || []).length ? 'moderate' : 'none',
      uncertainty: a.source === 'ai' ? 'medium' : 'low',
      ruleIds: a.ruleId ? [a.ruleId] : [],
      confidence: a.source === 'ai' ? 0.6 : 0.85,
    });
  }
  for (const m of out.missingInformation || []) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: 'missing_information',
      targetField: m.field || 'patient',
      severity: m.critical ? 'A2' : 'A1',
      message: m.message,
      proposedChange: null,
      evidenceIds: [],
      evidenceStrength: 'none',
      uncertainty: 'high',
      ruleIds: [],
      confidence: 0.7,
    });
  }
  for (const q of out.counterfactuals || []) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: 'ask_patient_or_recheck',
      targetField: 'clinical',
      severity: q.tier || 'A2',
      message: q.text,
      proposedChange: null,
      evidenceIds: [],
      evidenceStrength: 'limited',
      uncertainty: 'medium',
      ruleIds: q.code ? [q.code] : [],
      confidence: 0.5,
    });
  }
  for (const s of out.substitutionCandidates || []) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: 'candidate_prescription_change',
      targetField: 'prescription.herbs',
      severity: 'A2',
      message: `候选修改（须医师主动采纳，系统不会自动改方）：${s.from} → ${s.to}（${s.condition}）`,
      proposedChange: { type: 'replace_herb', from: s.from, to: s.to, ruleId: s.ruleId },
      evidenceIds: s.evidenceIds || [],
      evidenceStrength: 'moderate',
      uncertainty: 'medium',
      ruleIds: s.ruleId ? [s.ruleId] : [],
      confidence: 0.4,
    });
  }
  if (out.abstain || out.disagreements?.length) {
    items.push({
      ...base,
      suggestionId: randomId('sug'),
      suggestionType: 'escalate_pharmacist',
      targetField: 'workflow',
      severity: out.riskTier || 'A2',
      message: out.abstain
        ? `证据不足或模型弃权，需要人工判断（${(out.abstainReasons || []).join('、')}）`
        : `规则与模型存在分歧，建议药师重点审核`,
      proposedChange: null,
      evidenceIds: [],
      evidenceStrength: out.evidenceStrength || 'limited',
      uncertainty: 'high',
      ruleIds: [],
      confidence: 0.5,
    });
  }
  return items.map(persist);
}

function supersedePending({ draftId, caseId }) {
  for (const s of repo.listSuggestions({ draftId, caseId, status: 'pending' })) {
    persist({ ...s, status: 'superseded', supersededAt: new Date().toISOString() });
  }
}

function decide(suggestionId, body, actor) {
  const s = repo.getSuggestion(suggestionId);
  if (!s) throw new ServiceError(404, 'suggestion_not_found', 'Suggestion not found');
  if (s.status !== 'pending') throw new ServiceError(409, 'already_decided', `Suggestion is ${s.status}`);
  if (!STATUSES.includes(body.status) || body.status === 'pending' || body.status === 'superseded') {
    throw new ServiceError(400, 'invalid_status', 'Disposition must be accepted, partially_accepted, rejected or ignored');
  }
  if (body.status !== 'ignored' && !body.reasonCode) throw new ServiceError(400, 'reason_required', 'A reasonCode is required');
  if (body.reasonCode && !REASON_CODES.includes(body.reasonCode)) throw new ServiceError(400, 'unknown_reason', 'Unknown reasonCode');
  const beforeHash = s.inputHash;
  const next = {
    ...s,
    status: body.status,
    disposition: {
      decidedBy: String(actor.id),
      decidedRole: actor.role,
      decidedAt: new Date().toISOString(),
      reasonCode: body.reasonCode || null,
      comment: body.comment || null,
      beforeHash,
      afterHash: body.afterHash || beforeHash,
      partialFields: body.partialFields || null,
    },
  };
  persist(next);
  return next;
}

function markPharmacistView(suggestionId, actor, acknowledged) {
  const s = repo.getSuggestion(suggestionId);
  if (!s) throw new ServiceError(404, 'suggestion_not_found', 'Suggestion not found');
  const next = {
    ...s,
    pharmacistAcknowledged: {
      by: String(actor.id),
      at: new Date().toISOString(),
      agrees: Boolean(acknowledged),
    },
  };
  return persist(next);
}

function metrics() {
  const all = repo.listSuggestions();
  const decided = all.filter((s) => s.disposition);
  const n = (st) => all.filter((s) => s.status === st).length;
  const byType = {};
  const byRole = {};
  const byModel = {};
  const reasons = {};
  for (const s of all) {
    byType[s.suggestionType] = byType[s.suggestionType] || { total: 0, accepted: 0, rejected: 0, partial: 0 };
    byType[s.suggestionType].total += 1;
    if (s.status === 'accepted') byType[s.suggestionType].accepted += 1;
    if (s.status === 'rejected') byType[s.suggestionType].rejected += 1;
    if (s.status === 'partially_accepted') byType[s.suggestionType].partial += 1;
    if (s.disposition) {
      const role = s.disposition.decidedRole;
      byRole[role] = byRole[role] || { total: 0, accepted: 0 };
      byRole[role].total += 1;
      if (s.status === 'accepted') byRole[role].accepted += 1;
      reasons[s.disposition.reasonCode || 'none'] = (reasons[s.disposition.reasonCode || 'none'] || 0) + 1;
    }
    const mv = s.modelVersion || 'none';
    byModel[mv] = byModel[mv] || { total: 0, accepted: 0 };
    byModel[mv].total += 1;
    if (s.status === 'accepted') byModel[mv].accepted += 1;
  }
  const rate = (a, b) => (b ? a / b : null);
  const acceptedChange = all.filter((s) => s.suggestionType === 'candidate_prescription_change' && s.status === 'accepted').length;
  const changeOffered = all.filter((s) => s.suggestionType === 'candidate_prescription_change').length;
  const pharmacistDisagree = all.filter((s) => s.pharmacistAcknowledged && s.pharmacistAcknowledged.agrees === false).length;
  const pharmacistViewed = all.filter((s) => s.pharmacistAcknowledged).length;
  return {
    counts: { total: all.length, pending: n('pending'), accepted: n('accepted'), partially_accepted: n('partially_accepted'), rejected: n('rejected'), ignored: n('ignored'), superseded: n('superseded') },
    rates: {
      acceptanceRate: rate(n('accepted'), decided.length),
      partialAcceptanceRate: rate(n('partially_accepted'), decided.length),
      rejectionRate: rate(n('rejected'), decided.length),
      prescriptionChangeAfterPromptRate: rate(acceptedChange, changeOffered),
      pharmacistAiAgreementRate: rate(pharmacistViewed - pharmacistDisagree, pharmacistViewed),
    },
    rejectReasons: reasons,
    bySuggestionType: byType,
    byRole,
    byModelVersion: byModel,
  };
}

module.exports = {
  STATUSES, REASON_CODES, suggestionsFromAnalysis, supersedePending, decide, markPharmacistView, metrics,
};
