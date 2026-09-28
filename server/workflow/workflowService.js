/**
 * Prescription workflow service. The only code path that changes a case's state.
 * Actors come from the authenticated session (or, for patients, from a validated token);
 * nothing in a request body can name an actor, a role, a state or an approval.
 */
const crypto = require('crypto');
const repo = require('./workflowRepository');
const audit = require('../audit/auditRepository');
const { checkTransition, TransitionError, POST_APPROVAL_STATES, CONTENT_LOCKED_STATES } = require('./prescriptionStateMachine');
const { hashObject, sha256, randomId } = require('../common/hash');
const { fingerprint } = require('../ai/redaction');
const { analyzeCase } = require('../ai/aiOrchestrator');
const runtime = require('../ai/aiRuntime');
const { parseHerbs } = require('../services/prescriptionAnalyzer');
const { getStore } = require('../data/store');
const { getDataMode, isSyntheticMode } = require('../config/dataMode');
const { hasPharmacistCredential } = require('../security/rbac');
const { ServiceError } = require('./errors');
const suggestions = require('./suggestionService');

const SYSTEM = { role: 'system', id: 'workflow' };
const PATIENT_TOKEN_TTL_MS = () => (Number(process.env.PATIENT_TOKEN_TTL_MINUTES) || 48 * 60) * 60000;
const FEEDBACK_TOKEN_TTL_MS = 30 * 24 * 3600000;
const DOSE_DEVIATION_TOLERANCE = 0.05;

const actorType = (role) => (role === 'researcher' ? 'researcher' : role);

function versions(c) {
  const a = c.analyses.at(-1)?.output;
  return { modelVersion: a?.modelVersion ?? null, ruleSetVersion: a?.ruleSetVersion ?? null, knowledgeBaseVersion: a?.knowledgeBaseVersion ?? null };
}

function record(c, eventType, actor, payload) {
  return audit.append({ caseId: c.caseId, eventType, actorType: actorType(actor.role), actorId: actor.id, payload, ...versions(c) });
}

function transition(c, to, actor, reason) {
  let step;
  try {
    step = checkTransition(c, to, actor.role);
  } catch (err) {
    if (err instanceof TransitionError) throw new ServiceError(409, err.code, err.message);
    throw err;
  }
  const entry = { from: step.from, to, actorType: actorType(actor.role), actorId: String(actor.id), at: new Date().toISOString(), reason: reason || null };
  c.transitions.push(entry);
  c.state = to;
  c.updatedAt = entry.at;
  record(c, 'state_transition', actor, { from: step.from, to, reason: reason || null, patientSummary: to });
  return entry;
}

function contentOf(c) {
  return { patient: c.patient, prescriber: c.prescriber, prescription: c.prescription };
}

function normaliseHerbs(herbs) {
  return (herbs || []).map((h) => ({
    name: String(h.name).trim(),
    dosage: h.dosage == null ? null : Number(h.dosage),
    unit: h.unit || 'g',
    ...(h.processing ? { processing: h.processing } : {}),
    ...(h.note ? { note: h.note } : {}),
  }));
}

function fromLegacyPrescription(id) {
  const store = getStore();
  const p = store.prescriptions.find((x) => x.id === id);
  if (!p) throw new ServiceError(404, 'legacy_prescription_not_found', `Prescription ${id} not found`);
  const pt = store.patients.find((x) => x.id === p.patientId) || {};
  const sex = { 男: 'male', 女: 'female' }[pt.gender || p.patientGender] || 'unknown';
  return {
    source: { channel: 'imported', rawText: p.prescriptionText || '' },
    patient: {
      patientRef: pt.id ? `P${pt.id}` : undefined,
      name: pt.name || p.patientName,
      phone: pt.phone,
      ageYears: typeof (pt.age ?? p.patientAge) === 'number' ? (pt.age ?? p.patientAge) : undefined,
      sex,
      allergies: Array.isArray(pt.allergies) ? pt.allergies : undefined,
    },
    prescriber: { name: p.doctor || undefined },
    prescription: {
      herbs: (p.herbs || []).map((h) => ({ name: h.name, dosage: parseFloat(String(h.dosage)) || null, unit: 'g' })),
      diagnosisText: p.diagnosis || undefined,
      issuedAt: /^\d{4}-\d{2}-\d{2}/.test(p.date || '') ? p.date.slice(0, 10) : undefined,
    },
    legacyPrescriptionId: id,
  };
}

function createCase(input, actor) {
  const base = input.fromPrescriptionId ? fromLegacyPrescription(input.fromPrescriptionId) : {};
  const source = { channel: 'counter', ...base.source, ...input.source };
  const prescription = { ...base.prescription, ...input.prescription };
  if (!prescription.herbs?.length && source.rawText) prescription.herbs = parseHerbs(source.rawText);
  prescription.herbs = normaliseHerbs(prescription.herbs);
  const now = new Date().toISOString();
  const c = {
    caseId: randomId('case'),
    createdAt: now,
    updatedAt: now,
    createdBy: { role: actor.role, id: String(actor.id) },
    dataMode: getDataMode(),
    synthetic: isSyntheticMode(),
    legacyPrescriptionId: base.legacyPrescriptionId ?? input.legacyPrescriptionId ?? null,
    source,
    patient: { ...base.patient, ...input.patient },
    prescriber: {
      ...base.prescriber,
      ...input.prescriber,
      ...(actor.role === 'prescriber' ? { userId: String(actor.id), name: input.prescriber?.name || actor.name } : {}),
    },
    prescription,
    state: 'received',
    contentVersion: 1,
    contentHash: null,
    contentHistory: [],
    transitions: [],
    analyses: [],
    replays: [],
    decisions: [],
    approval: null,
    approvalHistory: [],
    secondReview: null,
    informationRequests: [],
    patientConfirmations: [],
    patientFeedback: [],
    dispensingRecords: [],
    patientDeclined: false,
  };
  c.contentHash = hashObject(contentOf(c));
  c.contentHistory.push({ version: 1, contentHash: c.contentHash, changedBy: c.createdBy, at: now, reason: 'created' });
  record(c, 'case_received', actor, { channel: source.channel, herbCount: prescription.herbs.length, contentHash: c.contentHash, patientSummary: '处方已接收' });
  repo.saveCase(c);
  return c;
}

function getCaseOr404(caseId) {
  const c = repo.getCase(caseId);
  if (!c) throw new ServiceError(404, 'case_not_found', `Case ${caseId} not found`);
  return c;
}

async function runAnalysis(c, trigger) {
  const provider = runtime.getProvider();
  let output;
  try {
    output = await analyzeCase(c, { provider, aiEnabled: runtime.isAiEnabled(), timeoutMs: runtime.timeoutMs() });
  } catch (err) {
    audit.append({ caseId: c.caseId, eventType: 'ai_analysis_failed', actorType: 'system', actorId: 'orchestrator', payload: { message: err.message } });
    throw new ServiceError(500, 'analysis_failed', 'Screening failed; case left for pharmacist review without AI output');
  }
  const analysis = { analysisId: output.analysisId, contentHash: c.contentHash, contentVersion: c.contentVersion, at: output.generatedAt, trigger, output };
  c.analyses.push(analysis);
  audit.append({
    caseId: c.caseId,
    eventType: 'ai_analysis',
    actorType: 'ai',
    actorId: output.modelVersion,
    payload: {
      analysisId: output.analysisId,
      riskTier: output.riskTier,
      recommendation: output.recommendation,
      abstain: output.abstain,
      abstainReasons: output.abstainReasons,
      hardStops: output.hardStops.map((h) => h.code),
      semanticStatus: output.semanticTrackResult.status,
      promptVersion: output.promptVersion,
      outputHash: hashObject(output),
    },
    modelVersion: output.modelVersion,
    ruleSetVersion: output.ruleSetVersion,
    knowledgeBaseVersion: output.knowledgeBaseVersion,
  });
  suggestions.supersedePending({ caseId: c.caseId });
  suggestions.suggestionsFromAnalysis({ caseId: c.caseId, analysis, inputHash: c.contentHash });
  return analysis;
}

async function screen(c, trigger) {
  if (c.state !== 'ai_screening') transition(c, 'ai_screening', SYSTEM, trigger);
  const analysis = await runAnalysis(c, trigger);
  const aiActor = { role: 'ai', id: analysis.output.modelVersion };
  const needsInfo = analysis.output.recommendation === 'clarification_required';
  transition(c, needsInfo ? 'information_incomplete' : 'pharmacist_review_required', aiActor, `AI筛查：${analysis.output.riskTier} / ${analysis.output.recommendation}`);
  return analysis;
}

async function analyze(caseId) {
  const c = getCaseOr404(caseId);
  if (!['received', 'information_incomplete', 'ai_screening', 'pharmacist_review_required'].includes(c.state)) {
    throw new ServiceError(409, 'analysis_not_allowed', `Cannot re-screen a case in state ${c.state}`);
  }
  const analysis = await screen(c, 'analyze_requested');
  repo.saveCase(c);
  return { case: c, analysis };
}

/** Reproduce a stored analysis on the same content without touching the workflow state. */
async function replay(caseId, analysisId, actor) {
  const c = getCaseOr404(caseId);
  const original = analysisId ? c.analyses.find((a) => a.analysisId === analysisId) : c.analyses.at(-1);
  if (!original) throw new ServiceError(404, 'analysis_not_found', 'No analysis to replay');
  const content = original.contentHash === c.contentHash ? c : c.contentHistory.find((h) => h.contentHash === original.contentHash)?.snapshot;
  if (!content) throw new ServiceError(409, 'content_unavailable', 'Content for that analysis is not retained');
  const out = await analyzeCase({ ...contentOf(content), source: c.source, caseId: c.caseId }, {
    provider: runtime.getProvider(), aiEnabled: runtime.isAiEnabled(), timeoutMs: runtime.timeoutMs(), now: new Date(original.at),
  });
  const pick = (o) => ({ riskTier: o.riskTier, recommendation: o.recommendation, hardStops: o.hardStops.map((h) => h.code).sort(), abstainReasons: [...o.abstainReasons].sort(), ruleSetVersion: o.ruleSetVersion, knowledgeBaseVersion: o.knowledgeBaseVersion, promptVersion: o.promptVersion });
  const comparison = { original: pick(original.output), replay: pick(out) };
  comparison.identical = JSON.stringify(comparison.original) === JSON.stringify(comparison.replay);
  const entry = { replayId: randomId('rep'), of: original.analysisId, at: new Date().toISOString(), by: String(actor.id), comparison };
  c.replays.push(entry);
  record(c, 'analysis_replayed', actor, { of: original.analysisId, identical: comparison.identical });
  repo.saveCase(c);
  return entry;
}

function invalidateApproval(c, actor, reason) {
  if (!c.approval?.valid) return;
  c.approval = { ...c.approval, valid: false, invalidatedAt: new Date().toISOString(), invalidatedReason: reason };
  c.approvalHistory.push({ ...c.approval });
  record(c, 'approval_invalidated', actor, { decisionId: c.approval.decisionId, reason });
}

async function updateContent(caseId, patch, actor) {
  const c = getCaseOr404(caseId);
  if (CONTENT_LOCKED_STATES.has(c.state)) throw new ServiceError(409, 'content_locked', `Content cannot change in state ${c.state}`);
  if (actor.role === 'technician') {
    throw new ServiceError(403, 'clinical_content_forbidden', 'Technicians cannot change diagnosis, herbs, dosage or usage');
  }
  if (actor.role === 'prescriber' && c.createdBy?.id !== String(actor.id) && c.prescriber?.userId !== String(actor.id)) {
    throw new ServiceError(403, 'not_own_case', 'Prescribers may only edit their own prescriptions');
  }
  if (['pharmacist_approved', 'patient_confirmed', 'dispensing', 'pharmacist_final_check', 'ready_for_pickup'].includes(c.state) && actor.role === 'prescriber') {
    throw new ServiceError(403, 'signed_content_locked', 'A prescriber cannot change a pharmacist-signed prescription');
  }
  const before = { hash: c.contentHash, snapshot: structuredClone(contentOf(c)) };
  if (patch.patient) c.patient = { ...c.patient, ...patch.patient };
  if (patch.prescriber) c.prescriber = { ...c.prescriber, ...patch.prescriber };
  if (patch.prescription) {
    c.prescription = { ...c.prescription, ...patch.prescription };
    c.prescription.herbs = normaliseHerbs(c.prescription.herbs);
  }
  const newHash = hashObject(contentOf(c));
  if (newHash === before.hash) return { case: c, changed: false };
  const last = c.contentHistory.at(-1);
  last.snapshot = before.snapshot;
  c.contentVersion += 1;
  c.contentHash = newHash;
  c.contentHistory.push({
    version: c.contentVersion, contentHash: newHash, changedBy: { role: actor.role, id: String(actor.id) }, at: new Date().toISOString(), reason: patch.reason || null, changedFields: Object.keys(patch).filter((k) => k !== 'reason'),
  });
  record(c, 'content_changed', actor, { fromHash: before.hash, toHash: newHash, version: c.contentVersion, reason: patch.reason || null });
  suggestions.supersedePending({ caseId: c.caseId });

  let analysis = null;
  if (POST_APPROVAL_STATES.has(c.state) || c.state === 'pharmacist_review_required') {
    invalidateApproval(c, actor, 'content_changed_after_approval');
    analysis = await screen(c, 'content_changed');
  } else if (c.state === 'returned_to_prescriber') {
    transition(c, 'received', SYSTEM, 'prescriber_revision');
    analysis = await screen(c, 'prescriber_revision');
  } else if (c.state === 'information_incomplete') {
    analysis = await screen(c, 'information_supplied');
  } else if (c.state === 'pharmacist_rejected') {
    throw new ServiceError(409, 'rejected_case', 'Rejected cases must be returned to the prescriber before revision');
  }
  repo.saveCase(c);
  return { case: c, changed: true, analysis };
}

function requireLatest(c, analysisId) {
  const latest = c.analyses.at(-1);
  if (!latest) throw new ServiceError(409, 'no_analysis', 'Case has no screening result');
  if (latest.analysisId !== analysisId) throw new ServiceError(409, 'stale_analysis', 'Decision refers to an outdated analysis; reload the case');
  if (latest.contentHash !== c.contentHash) throw new ServiceError(409, 'stale_analysis', 'Analysis does not match current content');
  return latest;
}

function pharmacistDecision(caseId, body, actor) {
  if (!hasPharmacistCredential(actor)) {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Only a pharmacist credential can record review decisions; admin role is not sufficient');
  }
  const c = getCaseOr404(caseId);
  if (c.createdBy?.id === String(actor.id) && c.createdBy?.role === 'prescriber') {
    throw new ServiceError(403, 'cannot_review_own_prescription', 'A prescriber cannot review their own prescription');
  }
  if (c.prescriber?.userId && c.prescriber.userId === String(actor.id)) {
    throw new ServiceError(403, 'cannot_review_own_prescription', 'A prescriber cannot review their own prescription');
  }
  const latest = requireLatest(c, body.analysisId);
  const out = latest.output;
  const decision = {
    decisionId: randomId('dec'),
    action: body.action,
    analysisId: latest.analysisId,
    contentHash: c.contentHash,
    pharmacistId: String(actor.id),
    at: new Date().toISOString(),
    comment: body.comment || null,
    alertCodes: body.alertCodes || [],
    overrideReason: body.overrideReason || null,
    aiRecommendation: out.recommendation,
    aiRiskTier: out.riskTier,
  };
  const reviewStates = ['pharmacist_review_required'];
  const needState = (states) => {
    if (!states.includes(c.state)) throw new ServiceError(409, 'invalid_state', `Action ${body.action} not allowed in state ${c.state}`);
  };

  switch (body.action) {
    case 'approve': {
      needState(reviewStates);
      if (out.abstain && !body.comment) throw new ServiceError(400, 'comment_required', 'AI abstained; approval requires an independent-review comment');
      if (c.secondReview?.status === 'pending') {
        if (c.secondReview.requestedBy === String(actor.id)) throw new ServiceError(409, 'second_review_pending', 'A different pharmacist must complete the requested second review');
        c.secondReview = { ...c.secondReview, status: 'completed', completedBy: String(actor.id), completedAt: decision.at };
      }
      transition(c, 'pharmacist_approved', actor, body.comment || 'approved');
      c.approval = { decisionId: decision.decisionId, pharmacistId: String(actor.id), contentHash: c.contentHash, analysisId: latest.analysisId, at: decision.at, valid: true };
      c.approvalHistory.push({ ...c.approval });
      break;
    }
    case 'reject':
      needState(reviewStates);
      if (!body.comment) throw new ServiceError(400, 'comment_required', 'Rejection requires a reason');
      transition(c, 'pharmacist_rejected', actor, body.comment);
      break;
    case 'return_to_prescriber':
      needState(['pharmacist_review_required', 'pharmacist_rejected', 'information_incomplete']);
      if (!body.comment) throw new ServiceError(400, 'comment_required', 'Returning to the prescriber requires a reason');
      transition(c, 'returned_to_prescriber', actor, body.comment);
      break;
    case 'request_information': {
      needState(reviewStates);
      if (!body.requestedInformation?.length) throw new ServiceError(400, 'requested_information_required', 'List the information needed');
      c.informationRequests.push({ at: decision.at, by: String(actor.id), items: body.requestedInformation, comment: body.comment || null });
      decision.requestedInformation = body.requestedInformation;
      transition(c, 'information_incomplete', actor, `需补充：${body.requestedInformation.join('、')}`);
      break;
    }
    case 'override_ai_alert': {
      needState(reviewStates);
      if (!body.overrideReason) throw new ServiceError(400, 'override_reason_required', 'Overriding an AI alert requires a reason code');
      if (body.overrideReason === 'other' && !body.comment) throw new ServiceError(400, 'comment_required', 'Reason "other" requires a comment');
      if (!body.alertCodes?.length) throw new ServiceError(400, 'alert_codes_required', 'Name the alerts being overridden');
      const hard = body.alertCodes.filter((code) => out.hardStops.some((h) => h.code === code));
      if (hard.length) throw new ServiceError(409, 'hard_stop_not_overridable', `Hard stops cannot be overridden: ${hard.join(', ')}`);
      const unknown = body.alertCodes.filter((code) => !out.alerts.some((a) => a.code === code));
      if (unknown.length) throw new ServiceError(400, 'unknown_alert', `Alerts not in the current analysis: ${unknown.join(', ')}`);
      break;
    }
    case 'confirm_ai_alert': {
      needState(reviewStates);
      if (!body.alertCodes?.length) throw new ServiceError(400, 'alert_codes_required', 'Name the alerts being confirmed');
      break;
    }
    case 'request_second_review':
      needState(reviewStates);
      c.secondReview = { status: 'pending', requestedBy: String(actor.id), requestedAt: decision.at, reason: body.comment || null };
      break;
    default:
      throw new ServiceError(400, 'unknown_action', `Unknown action ${body.action}`);
  }
  c.decisions.push(decision);
  record(c, 'pharmacist_decision', actor, {
    decisionId: decision.decisionId, action: decision.action, analysisId: decision.analysisId, alertCodes: decision.alertCodes, overrideReason: decision.overrideReason, comment: decision.comment,
  });
  repo.saveCase(c);
  return { case: c, decision };
}

function requestInformation(caseId, body, actor) {
  const c = getCaseOr404(caseId);
  return pharmacistDecision(caseId, { action: 'request_information', analysisId: body.analysisId || c.analyses.at(-1)?.analysisId, requestedInformation: body.requestedInformation, comment: body.comment }, actor);
}

// ---------------------------------------------------------------- patient tokens

function issueToken(caseId, purpose, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const rec = { caseId, purpose, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlMs).toISOString(), usedAt: null, revokedAt: null };
  repo.tokens().put(tokenHash, rec);
  return { token, tokenHash, ...rec };
}

function issuePatientConfirmation(caseId, actor) {
  const c = getCaseOr404(caseId);
  if (c.state === 'pharmacist_approved') transition(c, 'patient_confirmation_required', actor, 'patient_confirmation_issued');
  else if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'invalid_state', `Patient confirmation requires an approved case (state ${c.state})`);
  for (const pc of c.patientConfirmations) {
    if (!pc.usedAt && !pc.revokedAt) {
      const rec = repo.tokens().get(pc.tokenHash);
      if (rec && !rec.usedAt) repo.tokens().put(pc.tokenHash, { ...rec, revokedAt: new Date().toISOString() });
      pc.revokedAt = new Date().toISOString();
    }
  }
  const t = issueToken(caseId, 'confirmation', PATIENT_TOKEN_TTL_MS());
  c.patientConfirmations.push({ tokenHash: t.tokenHash, issuedAt: t.issuedAt, expiresAt: t.expiresAt, issuedBy: String(actor.id), usedAt: null, revokedAt: null, response: null });
  record(c, 'patient_confirmation_requested', actor, { tokenFingerprint: fingerprint(t.tokenHash), expiresAt: t.expiresAt, patientSummary: '请确认个人信息与服务选择' });
  repo.saveCase(c);
  return { token: t.token, expiresAt: t.expiresAt, path: `/patient/confirmation/${t.token}` };
}

function resolveToken(token, purpose) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new ServiceError(400, 'invalid_token', 'Invalid link');
  const hash = sha256(token);
  const rec = repo.tokens().get(hash);
  if (!rec || rec.purpose !== purpose) throw new ServiceError(404, 'invalid_token', 'Invalid link');
  if (rec.usedAt) throw new ServiceError(410, 'token_used', 'This link has already been used');
  if (rec.revokedAt) throw new ServiceError(410, 'token_revoked', 'This link has been replaced by a newer one');
  if (Date.parse(rec.expiresAt) <= Date.now()) throw new ServiceError(410, 'token_expired', 'This link has expired');
  return { hash, rec };
}

function patientView(c) {
  const a = c.analyses.at(-1)?.output;
  const p = c.patient || {};
  return {
    caseRef: c.caseId.slice(-8),
    synthetic: c.synthetic,
    state: c.state,
    prescription: {
      herbs: (c.prescription.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage, unit: h.unit })),
      doseCount: c.prescription.doseCount ?? null,
      usage: c.prescription.usage ?? c.prescription.frequency ?? null,
      form: c.prescription.form ?? null,
    },
    recordedInformation: {
      ageYears: p.ageYears ?? null,
      allergies: p.allergies ?? null,
      pregnancy: p.pregnancy ?? 'unknown',
      lactation: p.lactation ?? 'unknown',
      currentMedications: p.currentMedications ?? null,
      phoneMasked: p.phone ? `${String(p.phone).slice(0, 3)}****${String(p.phone).slice(-4)}` : null,
    },
    explanation: c.approval?.valid
      ? { text: a?.patientExplanation || '', label: 'AI辅助生成、经药师审核的说明；如有疑问请咨询药师' }
      : { text: '药师审核中，审核完成后可查看用药说明。', label: null },
    substitutionAsked: (a?.substitutionCandidates || []).length > 0,
  };
}

function getPatientConfirmation(token) {
  const { rec } = resolveToken(token, 'confirmation');
  const c = getCaseOr404(rec.caseId);
  if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'not_awaiting_confirmation', 'This prescription is not awaiting your confirmation');
  return patientView(c);
}

function safetyChangesFrom(c, body) {
  const p = c.patient || {};
  const patch = {};
  if (body.allergyCorrections?.length) patch.allergies = [...new Set([...(p.allergies || []), ...body.allergyCorrections])];
  if (body.pregnancy && body.pregnancy !== (p.pregnancy ?? 'unknown')) patch.pregnancy = body.pregnancy;
  if (body.lactation && body.lactation !== (p.lactation ?? 'unknown')) patch.lactation = body.lactation;
  if (body.currentMedications) {
    const merged = [...new Set([...(p.currentMedications || []), ...body.currentMedications])];
    if (merged.length !== (p.currentMedications || []).length) patch.currentMedications = merged;
  }
  return patch;
}

async function submitPatientConfirmation(token, body) {
  const { hash, rec } = resolveToken(token, 'confirmation');
  const c = getCaseOr404(rec.caseId);
  if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'not_awaiting_confirmation', 'This prescription is not awaiting your confirmation');
  const now = new Date().toISOString();
  repo.tokens().put(hash, { ...rec, usedAt: now });
  const patient = { role: 'patient', id: `token:${fingerprint(hash)}` };
  const entry = c.patientConfirmations.find((x) => x.tokenHash === hash);
  if (entry) {
    entry.usedAt = now;
    entry.response = { ...body };
  }

  if (body.decision === 'decline') {
    c.patientDeclined = true;
    transition(c, 'patient_declined', patient, body.declineReason || '患者拒绝服务');
    record(c, 'patient_declined', patient, { reason: body.declineReason || null, patientSummary: '您已拒绝本次服务' });
    repo.saveCase(c);
    return { outcome: 'declined', state: c.state };
  }
  if (!body.identityConfirmed) {
    record(c, 'patient_identity_not_confirmed', patient, { patientSummary: '身份未确认，请联系药房' });
    repo.saveCase(c);
    return { outcome: 'identity_not_confirmed', state: c.state, message: '身份信息未确认，药房将与您联系。' };
  }
  const safetyPatch = safetyChangesFrom(c, body);
  c.serviceChoices = {
    fulfillment: body.fulfillment || 'pickup',
    substitutionConsent: body.substitutionConsent || 'decline',
    contactConfirmed: Boolean(body.contactConfirmed),
    educationAcknowledged: Boolean(body.educationAcknowledged),
    at: now,
  };
  if (Object.keys(safetyPatch).length) {
    record(c, 'patient_reported_safety_information', patient, { fields: Object.keys(safetyPatch), patientSummary: '您补充的信息已提交药师重新审核' });
    await updateContent(c.caseId, { patient: safetyPatch, reason: '患者确认时补充安全相关信息' }, patient);
    return { outcome: 'returned_for_review', state: repo.getCase(c.caseId).state, message: '您补充的信息需要药师重新审核，审核后会再次通知您。' };
  }
  transition(c, 'patient_confirmed', patient, '患者确认');
  record(c, 'patient_confirmed', patient, { choices: c.serviceChoices, patientSummary: '您已确认' });
  const fb = issueToken(c.caseId, 'feedback', FEEDBACK_TOKEN_TTL_MS);
  c.feedbackTokenHash = fb.tokenHash;
  repo.saveCase(c);
  return { outcome: 'confirmed', state: c.state, feedbackPath: `/patient/feedback/${fb.token}`, feedbackExpiresAt: fb.expiresAt };
}

function submitPatientFeedback(token, body) {
  const { hash, rec } = resolveToken(token, 'feedback');
  const c = getCaseOr404(rec.caseId);
  repo.tokens().put(hash, { ...rec, usedAt: new Date().toISOString() });
  const patient = { role: 'patient', id: `token:${fingerprint(hash)}` };
  const fb = { at: new Date().toISOString(), ...body };
  c.patientFeedback.push(fb);
  if (body.adverseReaction) c.pharmacovigilanceFollowUp = { flaggedAt: fb.at, status: 'open' };
  record(c, 'patient_feedback_submitted', patient, { effectiveness: body.effectiveness, adverseReaction: body.adverseReaction, patientSummary: '反馈已提交' });
  repo.saveCase(c);
  return { outcome: 'recorded', pharmacistFollowUp: Boolean(body.adverseReaction) };
}

// ---------------------------------------------------------------- dispensing

function dispensingAction(caseId, body, actor) {
  const c = getCaseOr404(caseId);
  const at = new Date().toISOString();
  switch (body.action) {
    case 'start':
      transition(c, 'dispensing', actor, body.note || '开始调剂');
      c.dispensingRecords.push({ type: 'start', by: String(actor.id), role: actor.role, at });
      break;
    case 'submit_final_check': {
      const perDose = new Map((c.prescription.herbs || []).map((h) => [h.name, h.dosage]));
      const deviations = (body.weighedItems || []).map((w) => {
        const expected = perDose.get(w.name);
        const dev = expected ? Math.abs(w.grams - expected) / expected : null;
        return { name: w.name, grams: w.grams, expected: expected ?? null, deviation: dev, outOfTolerance: expected == null || dev > DOSE_DEVIATION_TOLERANCE };
      });
      const missing = [...perDose.keys()].filter((n) => !(body.weighedItems || []).some((w) => w.name === n));
      transition(c, 'pharmacist_final_check', actor, body.note || '提交复核');
      c.dispensingRecords.push({ type: 'weighed', by: String(actor.id), role: actor.role, at, items: deviations, missing });
      break;
    }
    case 'final_check_pass': {
      if (!hasPharmacistCredential(actor)) throw new ServiceError(403, 'pharmacist_only', 'Final check requires a pharmacist credential');
      const weighed = [...c.dispensingRecords].reverse().find((r) => r.type === 'weighed');
      if (weighed && weighed.by === String(actor.id)) throw new ServiceError(409, 'same_person_check', 'Final check must be done by someone other than the dispenser');
      if (weighed && (weighed.missing.length || weighed.items.some((i) => i.outOfTolerance)) && !body.note) {
        throw new ServiceError(400, 'comment_required', 'Weighing deviations present; explain the release');
      }
      transition(c, 'ready_for_pickup', actor, body.note || '复核通过');
      c.dispensingRecords.push({ type: 'final_check_pass', by: String(actor.id), role: actor.role, at });
      break;
    }
    case 'final_check_fail':
      if (!hasPharmacistCredential(actor)) throw new ServiceError(403, 'pharmacist_only', 'Final check requires a pharmacist credential');
      transition(c, 'dispensing', actor, body.note || '复核未通过，退回调剂');
      c.dispensingRecords.push({ type: 'final_check_fail', by: String(actor.id), role: actor.role, at, note: body.note || null });
      break;
    case 'handover':
      transition(c, 'completed', actor, body.note || '已交付');
      c.dispensingRecords.push({ type: 'handover', by: String(actor.id), role: actor.role, at });
      break;
    default:
      throw new ServiceError(400, 'unknown_action', `Unknown dispensing action ${body.action}`);
  }
  record(c, 'dispensing_action', actor, { action: body.action });
  repo.saveCase(c);
  if (body.action === 'final_check_pass') {
    c.__pickup = require('./pickupService').issuePickupToken(c.caseId, actor);
  }
  return c;
}

function isPriorityReview(c) {
  const a = c.analyses.at(-1)?.output;
  if (!a) return true;
  if (a.riskTier === 'A3' || a.riskTier === 'A2') return true;
  if (a.abstain) return true;
  if (a.disagreements?.length) return true;
  if (a.missingInformation?.some((m) => m.critical)) return true;
  if (a.evidenceStrength === 'none' || a.evidenceStrength === 'limited') return true;
  if (a.displaySource === 'degraded_rules' || a.semanticTrackResult?.status === 'circuit_open') return true;
  return false;
}

function priorityReason(c) {
  const a = c.analyses.at(-1)?.output;
  if (!a) return ['尚未完成筛查'];
  const reasons = [];
  if (a.riskTier === 'A3') reasons.push('高风险阻断');
  if (a.riskTier === 'A2') reasons.push('需药师判断');
  if (a.abstain) reasons.push(`不确定性/弃权：${(a.abstainReasons || []).join('、')}`);
  if (a.disagreements?.length) reasons.push('规则与模型冲突');
  if (a.missingInformation?.some((m) => m.critical)) reasons.push('关键信息不足');
  if (a.evidenceStrength === 'none' || a.evidenceStrength === 'limited') reasons.push('超出知识范围或证据不足');
  if (a.displaySource === 'degraded_rules') reasons.push('模型降级为规则结果');
  return reasons;
}

function reviewQueue() {
  const pending = repo.listCases({ state: 'pharmacist_review_required' });
  const toItem = (c) => ({
    caseId: c.caseId,
    createdAt: c.createdAt,
    patientLabel: c.patient?.name ? `${String(c.patient.name).slice(0, 1)}**` : (c.patient?.patientRef || '未登记'),
    riskTier: c.analyses.at(-1)?.output?.riskTier || null,
    abstain: Boolean(c.analyses.at(-1)?.output?.abstain),
    displaySource: c.analyses.at(-1)?.output?.displaySource || null,
    evidenceStrength: c.analyses.at(-1)?.output?.evidenceStrength || null,
    escalateReasons: priorityReason(c),
    synthetic: Boolean(c.synthetic),
  });
  return {
    priority: pending.filter(isPriorityReview).map(toItem),
    batch: pending.filter((c) => !isPriorityReview(c)).map(toItem),
  };
}

function sampleLowRisk(actor, { rate = 0.1 } = {}) {
  const eligible = repo.listCases().filter((c) => {
    const a = c.analyses.at(-1)?.output;
    return a?.riskTier === 'A1' && ['pharmacist_approved', 'patient_confirmed', 'dispensing', 'ready_for_pickup', 'completed'].includes(c.state);
  });
  const n = eligible.length ? Math.max(1, Math.ceil(eligible.length * rate)) : 0;
  const shuffled = [...eligible].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const picked = shuffled.slice(0, n).map((c) => ({
    caseId: c.caseId,
    sampledAt: new Date().toISOString(),
    sampledBy: String(actor.id),
    riskTier: 'A1',
    state: c.state,
    purpose: 'low_risk_quality_audit',
  }));
  picked.forEach((row) => repo.learning().addSample(row));
  audit.append({
    eventType: 'low_risk_sample', actorType: actor.role, actorId: actor.id,
    payload: { count: picked.length, eligible: eligible.length, rate },
  });
  return { eligible: eligible.length, sampled: picked.length, cases: picked };
}

module.exports = {
  ServiceError,
  createCase,
  getCaseOr404,
  analyze,
  replay,
  updateContent,
  pharmacistDecision,
  requestInformation,
  issuePatientConfirmation,
  getPatientConfirmation,
  submitPatientConfirmation,
  submitPatientFeedback,
  dispensingAction,
  patientView,
  reviewQueue,
  sampleLowRisk,
  isPriorityReview,
};
