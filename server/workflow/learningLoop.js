/**
 * Controlled learning loop. Nothing here trains weights, mutates prompts, or
 * publishes models. Production must not claim that the model "has learned".
 */
const { randomId, hashObject } = require('../common/hash');
const repo = require('./workflowRepository');
const audit = require('../audit/auditRepository');
const { ServiceError } = require('./errors');
const { getDataMode, isSyntheticMode } = require('../config/dataMode');
const { getUserById } = require('../security/auth');
const { hasPharmacistCredential } = require('../security/rbac');

const LIVE_GATES = {
  minSchemaPassRate: 0.9,
  maxUnsafeAutonomousActions: 0,
};

function deidentifySuggestion(s) {
  return {
    suggestionId: s.suggestionId,
    suggestionType: s.suggestionType,
    severity: s.severity,
    message: s.message,
    proposedChange: s.proposedChange,
    evidenceIds: s.evidenceIds,
    evidenceStrength: s.evidenceStrength,
    uncertainty: s.uncertainty,
    heuristicReliabilityLevel: s.heuristicReliabilityLevel || null,
    ruleIds: s.ruleIds,
    modelVersion: s.modelVersion,
    promptVersion: s.promptVersion,
    knowledgeBaseVersion: s.knowledgeBaseVersion,
    status: s.status,
    reasonCode: s.disposition?.reasonCode || null,
    decidedRole: s.disposition?.decidedRole || null,
    pharmacistAgrees: s.pharmacistAcknowledged?.agrees ?? null,
    synthetic: isSyntheticMode(),
    dataMode: getDataMode(),
  };
}

function exportCandidates(actor) {
  const rows = repo.listSuggestions().filter((s) => {
    if (s.status === 'pending' || s.status === 'superseded') return false;
    if (!s.disposition?.reasonCode) return false;
    return true;
  }).map(deidentifySuggestion);
  const rec = {
    exportId: randomId('lexp'),
    at: new Date().toISOString(),
    by: String(actor.id),
    count: rows.length,
    dataMode: getDataMode(),
    synthetic: isSyntheticMode(),
    note: 'De-identified candidate rows only. Registry metadata only — this loop does not train weights. Not for clinical use until labelled and evaluated offline.',
  };
  repo.learning().addExport({ ...rec, rowCount: rows.length });
  audit.append({ eventType: 'learning_export', actorType: actor.role, actorId: actor.id, payload: { exportId: rec.exportId, count: rows.length, dataMode: rec.dataMode } });
  return { ...rec, rows };
}

function assertPharmacistAccount(id, { otherThan } = {}) {
  const user = getUserById(id);
  if (!user) throw new ServiceError(400, 'reviewer_not_found', 'Second reviewer is not a known account');
  if (!hasPharmacistCredential(user)) {
    throw new ServiceError(400, 'pharmacist_credential_required', 'Second reviewer must hold a pharmacist credential');
  }
  if (otherThan != null && String(user.id) === String(otherThan)) {
    throw new ServiceError(400, 'same_reviewer', 'Second reviewer must be a different pharmacist');
  }
  return user;
}

function reviewLabel(body, actor) {
  if (body.secondReviewerId) {
    throw new ServiceError(400, 'proxy_second_review_forbidden', 'Filling secondReviewerId is not a dual signature. The second pharmacist must log in and POST their own label.');
  }
  if (body.risk === 'high') {
    const ds = repo.learning().getDataset(body.datasetId);
    const prior = (ds?.labels || []).filter((l) => l.suggestionId === body.suggestionId && l.risk === 'high');
    const other = prior.find((l) => String(l.reviewerId) !== String(actor.id));
    if (!other && prior.some((l) => String(l.reviewerId) === String(actor.id))) {
      throw new ServiceError(409, 'dual_review_incomplete', 'High-risk labels need a second pharmacist to sign in separately');
    }
  }
  const row = {
    labelId: randomId('lbl'),
    suggestionId: body.suggestionId,
    label: body.label,
    risk: body.risk || 'routine',
    reviewerId: String(actor.id),
    secondReviewerId: body.secondReviewerId ? String(body.secondReviewerId) : null,
    at: new Date().toISOString(),
    comment: body.comment || null,
  };
  const ds = repo.learning().getDataset(body.datasetId) || {
    datasetId: body.datasetId || randomId('ds'),
    version: '0.1.0-candidate',
    createdAt: new Date().toISOString(),
    dictionary: 'suggestionType,severity,status,reasonCode,label',
    provenance: 'de-identified pharmacist dispositions',
    labels: [],
  };
  ds.labels.push(row);
  repo.learning().putDataset(ds);
  audit.append({ eventType: 'learning_label', actorType: actor.role, actorId: actor.id, payload: { labelId: row.labelId, suggestionId: body.suggestionId } });
  return { dataset: { datasetId: ds.datasetId, version: ds.version, labelCount: ds.labels.length }, label: row };
}

function registerModel(body, actor) {
  if (body.status === 'live') {
    throw new ServiceError(409, 'cannot_publish_directly', 'Candidate models must enter shadow, then pass governance approval');
  }
  const m = {
    modelId: body.modelId || randomId('mdl'),
    version: body.version,
    status: body.status || 'candidate',
    promptVersion: body.promptVersion,
    knowledgeBaseVersion: body.knowledgeBaseVersion,
    evaluationReportId: body.evaluationReportId || null,
    registeredBy: String(actor.id),
    registeredAt: new Date().toISOString(),
    liveAt: null,
    rollbackTo: null,
    shadowEnteredAt: body.status === 'shadow' ? new Date().toISOString() : null,
    shadowCompletedAt: null,
    pharmacistApproverId: null,
    governanceApproverId: null,
    note: 'Offline training only. This registry does not run training. No weights are stored here.',
  };
  repo.learning().putModel(m);
  audit.append({ eventType: 'model_registered', actorType: actor.role, actorId: actor.id, payload: { modelId: m.modelId, status: m.status } });
  return m;
}

function recordShadowComplete(modelId, body, actor) {
  const m = repo.learning().getModel(modelId);
  if (!m) throw new ServiceError(404, 'model_not_found', 'Model not in registry');
  if (m.status !== 'shadow') throw new ServiceError(409, 'not_in_shadow', 'Shadow completion is recorded only while the model is in shadow');
  const metrics = body.metrics || {};
  if (!body.evaluationReportId) throw new ServiceError(400, 'evaluation_report_required', 'A live-evaluation report id is required');
  if (metrics.unsafeAutonomousActions != null && metrics.unsafeAutonomousActions > LIVE_GATES.maxUnsafeAutonomousActions) {
    throw new ServiceError(409, 'live_gate_failed', 'Unsafe autonomous actions exceed the live gate');
  }
  if (metrics.schemaPassRate != null && metrics.schemaPassRate < LIVE_GATES.minSchemaPassRate) {
    throw new ServiceError(409, 'live_gate_failed', `schemaPassRate ${metrics.schemaPassRate} is below ${LIVE_GATES.minSchemaPassRate}`);
  }
  const next = {
    ...m,
    evaluationReportId: String(body.evaluationReportId),
    shadowCompletedAt: new Date().toISOString(),
    shadowMetrics: {
      schemaPassRate: metrics.schemaPassRate ?? null,
      hardRiskRecall: metrics.hardRiskRecall ?? null,
      unsafeAutonomousActions: metrics.unsafeAutonomousActions ?? null,
      note: 'hardRiskRecall on the synthetic rule-derived set is not clinical sensitivity',
    },
    lastDecision: { by: String(actor.id), role: actor.role, at: new Date().toISOString(), reason: 'shadow_complete' },
  };
  repo.learning().putModel(next);
  audit.append({ eventType: 'model_shadow_complete', actorType: actor.role, actorId: actor.id, payload: { modelId, evaluationReportId: next.evaluationReportId } });
  return next;
}

function assertLiveReady(m, actor, pharmacistApproverId) {
  if (!m.shadowCompletedAt) throw new ServiceError(409, 'shadow_incomplete', 'Live publish requires a completed shadow run');
  if (!m.evaluationReportId) throw new ServiceError(409, 'evaluation_report_required', 'Live publish requires an evaluation report recorded during shadow');
  if (!pharmacistApproverId) throw new ServiceError(400, 'pharmacist_approval_required', 'Live publish requires a pharmacist approver distinct from the governance actor');
  const pharmacist = assertPharmacistAccount(pharmacistApproverId, { otherThan: actor.id });
  if (m.shadowMetrics?.unsafeAutonomousActions != null
    && m.shadowMetrics.unsafeAutonomousActions > LIVE_GATES.maxUnsafeAutonomousActions) {
    throw new ServiceError(409, 'live_gate_failed', 'Unsafe autonomous actions exceed the live gate');
  }
  if (m.shadowMetrics?.schemaPassRate != null && m.shadowMetrics.schemaPassRate < LIVE_GATES.minSchemaPassRate) {
    throw new ServiceError(409, 'live_gate_failed', 'schemaPassRate is below the live gate');
  }
  return pharmacist;
}

function setModelStatus(modelId, status, actor, reason, extra = {}) {
  const m = repo.learning().getModel(modelId);
  if (!m) throw new ServiceError(404, 'model_not_found', 'Model not in registry');
  const allowed = {
    candidate: ['shadow'],
    shadow: ['live', 'rolled_back', 'candidate'],
    live: ['rolled_back', 'shadow'],
    rolled_back: ['shadow'],
  };
  if (!(allowed[m.status] || []).includes(status)) {
    throw new ServiceError(409, 'invalid_model_transition', `Cannot move ${m.status} → ${status}`);
  }
  if (status === 'live') {
    if (actor.role !== 'admin') {
      throw new ServiceError(403, 'governance_approval_required', 'Live publish requires admin governance approval after shadow evaluation');
    }
    const pharmacist = assertLiveReady(m, actor, extra.pharmacistApproverId);
    const next = {
      ...m,
      status,
      liveAt: new Date().toISOString(),
      pharmacistApproverId: String(pharmacist.id),
      governanceApproverId: String(actor.id),
      lastDecision: { by: String(actor.id), role: actor.role, at: new Date().toISOString(), reason: reason || null },
    };
    repo.learning().putModel(next);
    audit.append({ eventType: 'model_status', actorType: actor.role, actorId: actor.id, payload: { modelId, status, pharmacistApproverId: next.pharmacistApproverId } });
    return next;
  }
  const next = {
    ...m,
    status,
    shadowEnteredAt: status === 'shadow' ? (m.shadowEnteredAt || new Date().toISOString()) : m.shadowEnteredAt,
    liveAt: status === 'live' ? new Date().toISOString() : m.liveAt,
    rollbackTo: status === 'rolled_back' ? m.version : m.rollbackTo,
    lastDecision: { by: String(actor.id), role: actor.role, at: new Date().toISOString(), reason: reason || null },
  };
  repo.learning().putModel(next);
  audit.append({ eventType: 'model_status', actorType: actor.role, actorId: actor.id, payload: { modelId, status, reason: reason || null } });
  return next;
}

function findPromotableShadowModel(modelName) {
  return repo.learning().listModels().find((m) => (
    m.status === 'shadow'
    && m.shadowCompletedAt
    && m.evaluationReportId
    && (!modelName || m.version === modelName || m.modelId === modelName)
  ));
}

function hashObjectSafe(o) {
  return hashObject(o);
}

module.exports = {
  LIVE_GATES,
  exportCandidates,
  reviewLabel,
  registerModel,
  recordShadowComplete,
  setModelStatus,
  findPromotableShadowModel,
  hashObjectSafe,
};
