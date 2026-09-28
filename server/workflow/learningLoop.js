/**
 * Controlled learning loop. Nothing here trains weights, mutates prompts, or
 * publishes models. Production must not claim that the model "has learned".
 */
const { randomId, hashObject } = require('../common/hash');
const repo = require('../workflow/workflowRepository');
const audit = require('../audit/auditRepository');
const { ServiceError } = require('./errors');
const { isSyntheticMode } = require('../config/dataMode');

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
    ruleIds: s.ruleIds,
    modelVersion: s.modelVersion,
    promptVersion: s.promptVersion,
    knowledgeBaseVersion: s.knowledgeBaseVersion,
    status: s.status,
    reasonCode: s.disposition?.reasonCode || null,
    decidedRole: s.disposition?.decidedRole || null,
    pharmacistAgrees: s.pharmacistAcknowledged?.agrees ?? null,
    synthetic: true,
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
    dataMode: isSyntheticMode() ? 'synthetic-study' : 'pilot',
    note: 'De-identified candidate rows only. Not a trained model. Not for clinical use until labelled and evaluated offline.',
  };
  repo.learning().addExport({ ...rec, rowCount: rows.length });
  audit.append({ eventType: 'learning_export', actorType: actor.role, actorId: actor.id, payload: { exportId: rec.exportId, count: rows.length } });
  return { ...rec, rows };
}

function reviewLabel(body, actor) {
  if (body.risk === 'high' && !body.secondReviewerId) {
    throw new ServiceError(400, 'dual_review_required', 'High-risk labels require a second pharmacist reviewer');
  }
  const row = {
    labelId: randomId('lbl'),
    suggestionId: body.suggestionId,
    label: body.label,
    risk: body.risk || 'routine',
    reviewerId: String(actor.id),
    secondReviewerId: body.secondReviewerId || null,
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
    note: 'Offline training only. This registry does not run training. No weights are stored here.',
  };
  repo.learning().putModel(m);
  audit.append({ eventType: 'model_registered', actorType: actor.role, actorId: actor.id, payload: { modelId: m.modelId, status: m.status } });
  return m;
}

function setModelStatus(modelId, status, actor, reason) {
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
  if (status === 'live' && actor.role !== 'admin') {
    throw new ServiceError(403, 'governance_approval_required', 'Live publish requires admin governance approval after shadow evaluation');
  }
  const next = {
    ...m,
    status,
    liveAt: status === 'live' ? new Date().toISOString() : m.liveAt,
    rollbackTo: status === 'rolled_back' ? m.version : m.rollbackTo,
    lastDecision: { by: String(actor.id), role: actor.role, at: new Date().toISOString(), reason: reason || null },
  };
  repo.learning().putModel(next);
  audit.append({ eventType: 'model_status', actorType: actor.role, actorId: actor.id, payload: { modelId, status, reason: reason || null } });
  return next;
}

function hashObjectSafe(o) {
  return hashObject(o);
}

module.exports = { exportCandidates, reviewLabel, registerModel, setModelStatus, hashObjectSafe };
