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
const { normalizePatientIdentity, staffPatientDisplay } = require('./patientIdentity');
const suggestions = require('./suggestionService');
const { prescriberFields } = require('../security/prescriberLicense');
const facts = require('./clinicalFacts');
const clarification = require('./clarificationService');
const education = require('./educationService');
const followUp = require('./followUpService');
const { deductForCase } = require('./inventoryDeduct');
const pharmacyOps = require('./pharmacyOps');
const researchProtocol = require('./researchProtocol');

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

function resolvePrescriberOnCreate(base, incoming, actor) {
  const named = { ...(base || {}), ...(incoming || {}) };
  const rosterActor = actor.role === 'prescriber'
    ? actor
    : (named.userId ? { id: named.userId, name: named.name } : null);
  if (rosterActor) {
    return {
      name: named.name || rosterActor.name,
      institution: named.institution,
      ...prescriberFields(rosterActor),
    };
  }
  const out = {
    name: named.name,
    institution: named.institution,
    licenseSource: 'not_on_file',
  };
  // Clients cannot claim verified. An explicit false is a failed check, not an invented pass.
  if (named.licenseVerified === false) {
    out.licenseVerified = false;
    out.licenseSource = named.licenseSource || 'failed_check';
  }
  return out;
}

function normaliseHerbs(herbs) {
  return (herbs || []).map((h) => ({
    name: String(h.name).trim(),
    dosage: h.dosage == null ? null : Number(h.dosage),
    unit: h.unit || 'g',
    ...(h.processing ? { processing: h.processing } : {}),
    ...(h.decoctionTiming ? { decoctionTiming: h.decoctionTiming } : {}),
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
    patient: facts.attachFacts(normalizePatientIdentity({ ...base.patient, ...input.patient })),
    clarificationTasks: [],
    educationDocuments: [],
    followUpTasks: [],
    followUpPlan: null,
    prescriber: resolvePrescriberOnCreate(base.prescriber, input.prescriber, actor),
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
  persistCase(c);
  syncPatientMaster(c);
  return c;
}

function getCaseOr404(caseId) {
  const c = repo.getCase(caseId);
  if (!c) throw new ServiceError(404, 'case_not_found', `Case ${caseId} not found`);
  return c;
}

function persistCase(c, lock = {}) {
  try {
    return repo.saveCase(c, lock);
  } catch (err) {
    if (err.code === 'version_conflict') {
      throw new ServiceError(409, 'version_conflict', 'Another user updated this case; reload and retry', {
        currentVersion: err.currentVersion,
        currentRecordVersion: err.currentRecordVersion,
      });
    }
    throw err;
  }
}

function syncPatientMaster(c) {
  if (!c.patient?.patientRef) return;
  const projected = facts.attachFacts(c.patient);
  repo.upsertPatient({
    ...projected,
    patientRef: projected.patientRef,
    version: (c.contentVersion || 1),
    dataMode: c.dataMode,
  });
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
  const to = (c.clarificationTasks || []).some((t) => t.requiredForDecision && t.status === 'sent')
    ? 'information_incomplete'
    : 'pharmacist_review_required';
  transition(c, to, aiActor, `AI筛查：${analysis.output.riskTier} / ${analysis.output.recommendation}`);
  researchProtocol.applyReviewProtocol(c);
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

function assertVersion(c, expectedVersion) {
  if (expectedVersion == null) return;
  if (Number(expectedVersion) !== Number(c.contentVersion)) {
    throw new ServiceError(409, 'version_conflict', 'Another user updated this case; reload and retry', { currentVersion: c.contentVersion });
  }
}

async function updateContent(caseId, patch, actor) {
  const c = getCaseOr404(caseId);
  const loadedContentVersion = c.contentVersion;
  const loadedRecordVersion = c.recordVersion || 0;
  assertVersion(c, patch.expectedVersion);
  if (CONTENT_LOCKED_STATES.has(c.state)) throw new ServiceError(409, 'content_locked', `Content cannot change in state ${c.state}`);
  if (actor.role === 'technician') {
    throw new ServiceError(403, 'clinical_content_forbidden', 'Technicians cannot change diagnosis, herbs, dosage or usage');
  }
  if (patch.prescription && actor.role !== 'prescriber') {
    throw new ServiceError(403, 'prescriber_only_clinical', 'Only a prescriber can change herbs, dose, frequency, course or diagnosis');
  }
  if (actor.role === 'prescriber' && c.createdBy?.id !== String(actor.id) && c.prescriber?.userId !== String(actor.id)) {
    throw new ServiceError(403, 'not_own_case', 'Prescribers may only edit their own prescriptions');
  }
  if (['pharmacist_approved', 'patient_confirmed', 'dispensing', 'pharmacist_final_check', 'ready_for_pickup'].includes(c.state) && actor.role === 'prescriber') {
    throw new ServiceError(403, 'signed_content_locked', 'A prescriber cannot change a pharmacist-signed prescription');
  }
  const before = { hash: c.contentHash, snapshot: structuredClone(contentOf(c)) };
  if (patch.patient) c.patient = facts.attachFacts({ ...c.patient, ...patch.patient });
  if (patch.factChange) {
    const applied = facts.applyFactChange(c.patient, { ...patch.factChange, changeId: patch.factChange.changeId || randomId('fch') }, actor);
    c.patient = applied.patient;
  }
  if (patch.prescriber) c.prescriber = resolvePrescriberOnCreate(c.prescriber, patch.prescriber, actor);
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
  const prescriptionChanged = JSON.stringify(before.snapshot.prescription) !== JSON.stringify(c.prescription);
  if (patch.keepOpenClarifications || !prescriptionChanged) clarification.retainOpenOnFactChange(c);
  else clarification.expireStale(c, { prescriptionChanged: true });
  for (const doc of c.educationDocuments || []) {
    if (['draft', 'review_required', 'approved', 'published'].includes(doc.status) && doc.caseContentVersion !== c.contentVersion) {
      doc.status = 'superseded';
      doc.supersededAt = new Date().toISOString();
    }
  }

  let screenTrigger = null;
  if (POST_APPROVAL_STATES.has(c.state) || c.state === 'pharmacist_review_required') {
    invalidateApproval(c, actor, 'content_changed_after_approval');
    screenTrigger = 'content_changed';
  } else if (c.state === 'returned_to_prescriber') {
    transition(c, 'received', SYSTEM, 'prescriber_revision');
    screenTrigger = 'prescriber_revision';
  } else if (c.state === 'information_incomplete') {
    screenTrigger = 'information_supplied';
  } else if (c.state === 'pharmacist_rejected') {
    throw new ServiceError(409, 'rejected_case', 'Rejected cases must be returned to the prescriber before revision');
  }
  persistCase(c, { expectedVersion: loadedContentVersion, expectedRecordVersion: loadedRecordVersion });
  syncPatientMaster(c);
  let analysis = null;
  if (screenTrigger) {
    const fresh = getCaseOr404(caseId);
    if (fresh.contentHash === newHash) analysis = await screen(fresh, screenTrigger);
    persistCase(fresh, { expectedRecordVersion: fresh.recordVersion });
    return { case: repo.getCase(caseId), changed: true, analysis };
  }
  return { case: repo.getCase(caseId), changed: true, analysis };
}

function requireLatest(c, analysisId) {
  const latest = c.analyses.at(-1);
  if (!latest) throw new ServiceError(409, 'no_analysis', 'Case has no screening result');
  if (latest.analysisId !== analysisId) throw new ServiceError(409, 'stale_analysis', 'Decision refers to an outdated analysis; reload the case');
  if (latest.contentHash !== c.contentHash) throw new ServiceError(409, 'stale_analysis', 'Analysis does not match current content');
  return latest;
}

function pharmacistDecision(caseId, body, actor) {
  if (!hasPharmacistCredential(actor) || actor.role !== 'pharmacist') {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Only a pharmacist credential can record review decisions; admin role is not sufficient');
  }
  const c = getCaseOr404(caseId);
  assertVersion(c, body.expectedVersion);
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
    case 'fast_approve':
    case 'approve': {
      needState(reviewStates);
      if (body.action === 'fast_approve' && c.reviewLane !== 'fast') {
        throw new ServiceError(409, 'not_fast_track', 'Fast review is only for the protocol fast lane');
      }
      if (out.abstain && !body.comment && body.action !== 'fast_approve') throw new ServiceError(400, 'comment_required', 'AI abstained; approval requires an independent-review comment');
      if (body.secondReviewerId) {
        throw new ServiceError(400, 'proxy_second_review_forbidden', 'Filling secondReviewerId is not a dual signature; the second pharmacist must log in and submit');
      }
      const dualPending = c.reviewLane === 'dual' || c.secondReview?.status === 'pending';
      if (dualPending && c.secondReview?.status !== 'completed') {
        if (!c.secondReview) {
          c.secondReview = { status: 'pending', requestedBy: 'research_protocol', requestedAt: decision.at, reason: body.comment || 'dual_review', mode: 'dual' };
        }
        const protocolDual = c.secondReview.mode === 'dual' || c.secondReview.requestedBy === 'research_protocol';
        if (protocolDual && !c.secondReview.firstSigner) {
          c.secondReview = { ...c.secondReview, status: 'pending', firstSigner: String(actor.id), firstSignedAt: decision.at, signedInAs: actor.username || null };
          break;
        }
        const blocked = String(c.secondReview.firstSigner || c.secondReview.requestedBy) === String(actor.id);
        if (blocked) {
          throw new ServiceError(409, 'second_review_pending', 'A different pharmacist must complete the requested second review');
        }
        c.secondReview = { ...c.secondReview, status: 'completed', completedBy: String(actor.id), completedAt: decision.at, signedInAs: actor.username || null };
      }
      transition(c, 'pharmacist_approved', actor, body.comment || (body.action === 'fast_approve' ? 'fast_track' : 'approved'));
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
      c.secondReview = {
        status: 'pending',
        requestedBy: String(actor.id),
        requestedAt: decision.at,
        reason: body.comment || null,
        firstSigner: String(actor.id),
        firstSignedAt: decision.at,
      };
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

function issueToken(caseId, purpose, ttlMs, extra = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const rec = {
    caseId, purpose,
    contentVersion: extra.contentVersion ?? null,
    questionVersion: extra.questionVersion ?? null,
    taskId: extra.taskId ?? null,
    patientRef: extra.patientRef ?? null,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    usedAt: null,
    revokedAt: null,
  };
  repo.tokens().put(tokenHash, rec);
  return { token, tokenHash, ...rec };
}

function assertBoundPatient(c, actor) {
  if (!actor || actor.role !== 'patient' || !actor.patientRef) {
    throw new ServiceError(403, 'patient_login_required', 'Patient login required');
  }
  if (!c.patient?.patientRef || c.patient.patientRef !== actor.patientRef) {
    throw new ServiceError(403, 'not_your_case', 'This prescription is not assigned to your account');
  }
}

function notifyPatientInbox(c, kind, extra = {}) {
  c.patientInbox = c.patientInbox || { confirmation: null, notifications: [] };
  const row = { kind, at: new Date().toISOString(), deliveredTo: c.patient?.patientRef || null, ...extra };
  if (kind === 'confirmation') c.patientInbox.confirmation = { status: 'pending', ...row };
  c.patientInbox.notifications = [...(c.patientInbox.notifications || []), row].slice(-40);
}

function issuePatientConfirmation(caseId, actor) {
  const c = getCaseOr404(caseId);
  if (c.state === 'pharmacist_approved') transition(c, 'patient_confirmation_required', actor, 'patient_confirmation_issued');
  else if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'invalid_state', `Patient confirmation requires an approved case (state ${c.state})`);
  if (!c.patient?.patientRef) throw new ServiceError(409, 'patient_not_bound', 'Bind a patientRef before sending the task to the patient account');
  for (const pc of c.patientConfirmations) {
    if (!pc.usedAt && !pc.revokedAt) {
      if (pc.tokenHash) {
        const rec = repo.tokens().get(pc.tokenHash);
        if (rec && !rec.usedAt) repo.tokens().put(pc.tokenHash, { ...rec, revokedAt: new Date().toISOString() });
      }
      pc.revokedAt = new Date().toISOString();
    }
  }
  const t = issueToken(caseId, 'confirmation', PATIENT_TOKEN_TTL_MS(), {
    contentVersion: c.contentVersion, patientRef: c.patient?.patientRef || null,
  });
  c.patientConfirmations.push({
    channel: 'inbox',
    tokenHash: t.tokenHash,
    issuedAt: t.issuedAt,
    expiresAt: t.expiresAt,
    issuedBy: String(actor.id),
    usedAt: null,
    revokedAt: null,
    response: null,
    deliveredTo: c.patient.patientRef,
  });
  notifyPatientInbox(c, 'confirmation', { caseId: c.caseId });
  record(c, 'patient_confirmation_requested', actor, {
    tokenFingerprint: fingerprint(t.tokenHash),
    expiresAt: t.expiresAt,
    deliveredTo: c.patient.patientRef,
    patientSummary: '请在“我的处方”确认个人信息与服务选择',
  });
  repo.saveCase(c);
  return {
    deliveredTo: c.patient.patientRef,
    inboxPath: '/patient/me',
    token: t.token,
    expiresAt: t.expiresAt,
    path: `/patient/confirmation/${t.token}`,
    note: 'Task delivered to the bound patient account. The exclusive link is optional compatibility only.',
  };
}

function resolveToken(token, purpose) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new ServiceError(400, 'invalid_token', 'Invalid link');
  const hash = sha256(token);
  const rec = repo.tokens().get(hash);
  if (!rec || rec.purpose !== purpose) throw new ServiceError(404, 'invalid_token', 'Invalid link');
  if (rec.usedAt) throw new ServiceError(410, 'token_used', 'This link has already been used');
  if (rec.revokedAt) throw new ServiceError(410, 'token_revoked', 'This link has been replaced by a newer one');
  if (Date.parse(rec.expiresAt) <= Date.now()) throw new ServiceError(410, 'token_expired', 'This link has expired');
  if (rec.contentVersion != null) {
    const c = repo.getCase(rec.caseId);
    if (purpose === 'clarification' && c) {
      const task = (c.clarificationTasks || []).find((x) => x.taskId === rec.taskId);
      if (task && ['sent', 'answered'].includes(task.status) && task.caseContentVersion === c.contentVersion) {
        /* fact-only updates keep sibling clarification tokens valid */
      } else if (c.contentVersion !== rec.contentVersion) {
        throw new ServiceError(409, 'stale_token', 'This link is for a previous content version');
      }
    } else if (c && c.contentVersion !== rec.contentVersion) {
      throw new ServiceError(409, 'stale_token', 'This link is for a previous content version');
    }
  }
  return { hash, rec };
}

function patientView(c) {
  const p = facts.attachFacts(c.patient || {});
  const published = education.publishedFor(c);
  return {
    caseRef: c.caseId.slice(-8),
    synthetic: c.synthetic,
    state: c.state,
    contentVersion: c.contentVersion,
    prescription: {
      herbs: (c.prescription.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage, unit: h.unit })),
      doseCount: c.prescription.doseCount ?? null,
      usage: c.prescription.usage ?? c.prescription.frequency ?? null,
      form: c.prescription.form ?? null,
    },
    recordedInformation: {
      ageYears: p.facts.ageYears,
      ageYearsDisplay: p.facts.ageYears?.status === 'reported' ? p.facts.ageYears.value : null,
      allergies: p.facts.allergies,
      allergyLabel: facts.factLabel(p.facts.allergies),
      allergyItems: p.allergyItems || [],
      pregnancy: p.facts.pregnancy,
      pregnancyTri: p.pregnancy || 'unknown',
      lactation: p.facts.lactation,
      lactationTri: p.lactation || 'unknown',
      currentMedications: p.facts.currentMedications,
      medicationLabel: facts.factLabel(p.facts.currentMedications),
      medicationItems: p.medicationItems || [],
      liverImpairment: p.facts.liverImpairment,
      renalImpairment: p.facts.renalImpairment,
      phoneMasked: p.phone ? `${String(p.phone).slice(0, 3)}****${String(p.phone).slice(-4)}` : null,
    },
    explanation: published
      ? { text: published.text, label: published.genericFixedNotice ? '固定提示（非AI已审核说明）' : '经药师审核发布的用药说明', documentId: published.documentId, approvedAt: published.approvedAt }
      : { text: '用药说明尚未由药师审核发布。处方批准不等于说明已审核。', label: null, documentId: null },
    educationStatus: published ? 'published' : 'not_published',
    substitutionAsked: false,
  };
}

function patientFollowUpDto(task) {
  return {
    taskId: task.taskId,
    status: task.status,
    trigger: task.trigger,
    dueAt: task.dueAt,
    notifyNote: task.notifyNote,
    createdAt: task.createdAt,
  };
}

function patientCaseDto(c) {
  const published = education.publishedFor(c);
  return {
    caseId: c.caseId,
    ...patientView(c),
    education: published ? [{
      documentId: published.documentId,
      status: 'published',
      text: published.text,
      approvedAt: published.approvedAt,
    }] : [],
    clarifications: (c.clarificationTasks || []).filter((t) => t.status === 'sent').map((t) => ({
      taskId: t.taskId,
      fieldPath: t.fieldPath,
      question: t.question,
      reason: t.reason,
      status: t.status,
      fieldType: (facts.FIELD_VALUE_SCHEMA[t.fieldPath] || {}).type || 'string',
      unit: (facts.FIELD_VALUE_SCHEMA[t.fieldPath] || {}).unit || null,
      allowedStatuses: facts.FACT_STATUSES,
    })),
    followUps: (c.followUpTasks || []).map(patientFollowUpDto),
    actions: {
      canConfirm: ['pharmacist_approved', 'patient_confirmation_required'].includes(c.state),
      canClarify: (c.clarificationTasks || []).some((t) => t.status === 'sent'),
      canFeedback: ['patient_confirmed', 'dispensing', 'pharmacist_final_check', 'ready_for_pickup', 'completed'].includes(c.state),
    },
    deliveredTo: c.patient?.patientRef || null,
  };
}

function getOwnCase(caseId, actor) {
  const c = getCaseOr404(caseId);
  assertBoundPatient(c, actor);
  return patientCaseDto(c);
}

function reviewClarification(caseId, taskId, actor) {
  if (!hasPharmacistCredential(actor) || actor.role !== 'pharmacist') {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Only a pharmacist can review clarification answers');
  }
  const c = getCaseOr404(caseId);
  const task = clarification.reviewTask(c, taskId, actor);
  const change = (c.patient.factChangeLog || []).find((x) => x.fieldPath === task.fieldPath && x.status === 'pending_verification');
  if (change) c.patient = facts.verifyChange(c.patient, change.changeId, actor);
  record(c, 'clarification_reviewed', actor, { taskId });
  persistCase(c, c.recordVersion != null ? { expectedRecordVersion: c.recordVersion } : {});
  syncPatientMaster(c);
  return task;
}

function setFollowUpPlan(caseId, plan, actor) {
  if (actor.role !== 'pharmacist') throw new ServiceError(403, 'pharmacist_credential_required', 'Follow-up plan requires a pharmacist');
  const c = getCaseOr404(caseId);
  c.followUpPlan = {
    dueAt: plan.dueAt || null,
    ownerId: plan.ownerId ? String(plan.ownerId) : String(actor.id),
    note: plan.note || null,
    setBy: String(actor.id),
    setAt: new Date().toISOString(),
  };
  persistCase(c, c.recordVersion != null ? { expectedRecordVersion: c.recordVersion } : {});
  return c.followUpPlan;
}

function getPatientConfirmation(token) {
  const { rec } = resolveToken(token, 'confirmation');
  const c = getCaseOr404(rec.caseId);
  if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'not_awaiting_confirmation', 'This prescription is not awaiting your confirmation');
  return patientView(c);
}

function reportedTri(v) {
  return v === 'yes' || v === 'no';
}

function safetyChangesFrom(c, body) {
  const changes = [];
  if (body.allergyStatus === 'none') {
    changes.push({ changeId: randomId('fch'), kind: 'correct', fieldPath: 'patient.facts.allergies', newStatus: 'none', newValue: [] });
  }
  if (body.allergyCorrections?.length) {
    for (const item of body.allergyCorrections) {
      if (typeof item === 'string') changes.push({ changeId: randomId('fch'), kind: 'add', fieldPath: 'patient.facts.allergies', newValue: item });
      else changes.push({ changeId: randomId('fch'), kind: item.kind || 'add', fieldPath: 'patient.facts.allergies', oldValue: item.oldValue, newValue: item.name || item.newValue, newStatus: item.status });
    }
  }
  if (body.medicationChanges?.length) {
    for (const item of body.medicationChanges) {
      changes.push({
        changeId: randomId('fch'),
        kind: item.kind || 'add',
        fieldPath: 'patient.facts.currentMedications',
        oldValue: item.oldValue || item.name,
        newValue: item,
      });
    }
  } else if (body.currentMedications?.length) {
    for (const name of body.currentMedications) {
      changes.push({ changeId: randomId('fch'), kind: 'add', fieldPath: 'patient.facts.currentMedications', newValue: { name } });
    }
  }
  // Default "unknown" from the inbox form is not a new report; treating it as a change
  // voids approval and the patient can never finish confirmation.
  if (reportedTri(body.pregnancy)) {
    changes.push({
      changeId: randomId('fch'),
      kind: 'correct',
      fieldPath: 'patient.facts.pregnancy',
      newValue: { status: body.pregnancy === 'no' ? 'none' : 'reported', value: body.pregnancy },
    });
  }
  if (reportedTri(body.lactation)) {
    changes.push({
      changeId: randomId('fch'),
      kind: 'correct',
      fieldPath: 'patient.facts.lactation',
      newValue: { status: body.lactation === 'no' ? 'none' : 'reported', value: body.lactation },
    });
  }
  return changes;
}

async function applyConfirmationDecision(c, body, patient) {
  const now = new Date().toISOString();
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
    return { outcome: 'identity_not_confirmed', state: c.state, message: '身份信息未确认，药房将与您联系。勾选确认不构成专业身份核验。' };
  }
  c.serviceChoices = {
    fulfillment: body.fulfillment || 'pickup',
    substitutionConsent: 'not_applicable',
    contactConfirmed: Boolean(body.contactConfirmed),
    educationReceived: Boolean(body.educationReceived),
    educationUnderstood: Boolean(body.educationUnderstood),
    identityConfirmedCheckbox: Boolean(body.identityConfirmed),
    identityVerifiedProfessionally: false,
    at: now,
  };
  const safetyChanges = safetyChangesFrom(c, body);
  if (safetyChanges.length) {
    let next = c.patient;
    for (const ch of safetyChanges) {
      next = facts.applyFactChange(next, ch, patient).patient;
    }
    record(c, 'patient_reported_safety_information', patient, { fields: safetyChanges.map((x) => x.fieldPath), patientSummary: '您补充的信息已提交药师重新审核' });
    await updateContent(c.caseId, { patient: next, reason: '患者确认时补充安全相关信息' }, patient);
    return { outcome: 'returned_for_review', state: repo.getCase(c.caseId).state, message: '您补充的信息需要药师重新审核，审核后会再次通知您。' };
  }
  transition(c, 'patient_confirmed', patient, '患者确认');
  if (c.patientInbox?.confirmation) c.patientInbox.confirmation.status = 'done';
  record(c, 'patient_confirmed', patient, { choices: c.serviceChoices, patientSummary: '您已确认' });
  const fb = issueToken(c.caseId, 'feedback', FEEDBACK_TOKEN_TTL_MS, {
    contentVersion: c.contentVersion, patientRef: c.patient?.patientRef || null,
  });
  c.feedbackTokenHash = fb.tokenHash;
  repo.saveCase(c);
  return {
    outcome: 'confirmed',
    state: c.state,
    nextAction: '/patient/me',
    feedbackPath: `/patient/feedback/${fb.token}`,
    feedbackExpiresAt: fb.expiresAt,
  };
}

async function submitPatientConfirmation(token, body) {
  const { hash, rec } = resolveToken(token, 'confirmation');
  const c = getCaseOr404(rec.caseId);
  if (c.state !== 'patient_confirmation_required') throw new ServiceError(409, 'not_awaiting_confirmation', 'This prescription is not awaiting your confirmation');
  const now = new Date().toISOString();
  repo.tokens().put(hash, { ...rec, usedAt: now });
  const patient = { role: 'patient', id: `token:${fingerprint(hash)}`, patientRef: rec.patientRef || c.patient?.patientRef };
  const entry = c.patientConfirmations.find((x) => x.tokenHash === hash);
  if (entry) {
    entry.usedAt = now;
    entry.response = { ...body };
  }
  return applyConfirmationDecision(c, body, patient);
}

async function submitOwnConfirmation(caseId, body, actor) {
  const c = getCaseOr404(caseId);
  assertBoundPatient(c, actor);
  if (!['pharmacist_approved', 'patient_confirmation_required'].includes(c.state)) {
    throw new ServiceError(409, 'not_awaiting_confirmation', 'This prescription is not awaiting your confirmation');
  }
  if (c.state === 'pharmacist_approved') {
    transition(c, 'patient_confirmation_required', actor, 'patient_opened_inbox');
  }
  const now = new Date().toISOString();
  c.patientConfirmations.push({
    channel: 'inbox',
    tokenHash: null,
    issuedAt: now,
    usedAt: now,
    issuedBy: 'self',
    response: { ...body },
    deliveredTo: actor.patientRef,
  });
  return applyConfirmationDecision(c, body, actor);
}

function recordFeedback(c, body, patient) {
  const fb = {
    at: new Date().toISOString(),
    intakeStatus: body.intakeStatus || 'unknown',
    takenAt: body.takenAt || null,
    difficulty: body.difficulty || null,
    newSymptom: Boolean(body.newSymptom || body.adverseReaction),
    symptomOnset: body.symptomOnset || null,
    patientSeverity: body.patientSeverity || null,
    contactPreference: body.contactPreference || null,
    effectiveness: body.effectiveness ?? null,
    adverseReactionReported: Boolean(body.adverseReaction || body.newSymptom),
    adverseDescription: body.adverseDescription || null,
    comments: body.comments || null,
    notAdrConfirmation: false,
    notPostDoseIfBeforePickup: c.state !== 'completed' && c.state !== 'ready_for_pickup',
  };
  c.patientFeedback = c.patientFeedback || [];
  c.patientFeedback.push(fb);
  let followUpTask = null;
  if (fb.adverseReactionReported || fb.newSymptom) {
    followUpTask = followUp.createFromFeedback(c, { ...fb, adverseReported: true }, patient);
  }
  record(c, 'patient_feedback_submitted', patient, {
    effectiveness: fb.effectiveness, adverseReaction: fb.adverseReactionReported, patientSummary: '反馈已提交（自报感受，不等于药物不良反应确诊）',
  });
  repo.saveCase(c);
  const next = issueToken(c.caseId, 'feedback', FEEDBACK_TOKEN_TTL_MS, {
    contentVersion: c.contentVersion, patientRef: c.patient?.patientRef || null,
  });
  c.feedbackTokenHash = next.tokenHash;
  repo.saveCase(c);
  return {
    outcome: 'recorded',
    pharmacistFollowUp: Boolean(followUpTask),
    followUpTaskId: followUpTask?.taskId || null,
    nextAction: '/patient/me',
    nextFeedbackPath: `/patient/feedback/${next.token}`,
    note: '疗效评分为患者自报感受；新不适未自动确认为药物不良反应。',
  };
}

function submitPatientFeedback(token, body) {
  const { hash, rec } = resolveToken(token, 'feedback');
  const c = getCaseOr404(rec.caseId);
  repo.tokens().put(hash, { ...rec, usedAt: new Date().toISOString() });
  const patient = { role: 'patient', id: `token:${fingerprint(hash)}`, patientRef: rec.patientRef || c.patient?.patientRef };
  return recordFeedback(c, body, patient);
}

function submitOwnFeedback(caseId, body, actor) {
  const c = getCaseOr404(caseId);
  assertBoundPatient(c, actor);
  if (!['patient_confirmed', 'dispensing', 'pharmacist_final_check', 'ready_for_pickup', 'completed'].includes(c.state)) {
    throw new ServiceError(409, 'feedback_not_available', 'Feedback is available after you confirm the prescription');
  }
  return recordFeedback(c, body, actor);
}

// ---------------------------------------------------------------- dispensing

function dispensingAction(caseId, body, actor) {
  const c = getCaseOr404(caseId);
  assertVersion(c, body.expectedVersion);
  const at = new Date().toISOString();
  const idempotencyKey = body.idempotencyKey || `${body.action}:${c.caseId}:${c.contentVersion}:${c.state}`;
  switch (body.action) {
    case 'start': {
      const already = (c.dispensingRecords || []).find((r) => r.type === 'start' && r.idempotencyKey === idempotencyKey);
      if (already && c.state === 'dispensing') return c;
      const plan = pharmacyOps.planAllocation(c);
      c.allocation = { ...plan, at, by: String(actor.id) };
      transition(c, 'dispensing', actor, body.note || '开始调剂');
      const stock = deductForCase(c, actor, { idempotencyKey: `stock:${idempotencyKey}` });
      c.dispensingRecords.push({ type: 'start', by: String(actor.id), role: actor.role, at, idempotencyKey, stock, allocation: plan });
      break;
    }
    case 'auto_pick': {
      const alreadyPick = (c.dispensingRecords || []).find((r) => r.type === 'weighed' && r.autoPick);
      if (alreadyPick && c.state === 'pharmacist_final_check') return c;
      const plan = pharmacyOps.assertFillable(c);
      c.allocation = { ...plan, at, by: String(actor.id), autoPick: true };
      if (c.state === 'patient_confirmed') {
        transition(c, 'dispensing', actor, body.note || '按方自动配药');
        const stock = deductForCase(c, actor, { idempotencyKey: `stock:${idempotencyKey}` });
        c.dispensingRecords.push({ type: 'start', by: String(actor.id), role: actor.role, at, idempotencyKey, stock, allocation: plan });
      } else if (c.state !== 'dispensing') {
        throw new ServiceError(409, 'invalid_state', 'Auto-pick is only available after the patient confirms');
      }
      const weighedItems = (c.prescription.herbs || []).map((h) => ({ name: h.name, grams: Number(h.dosage || 0) }));
      const perDose = new Map((c.prescription.herbs || []).map((h) => [h.name, h.dosage]));
      const deviations = weighedItems.map((w) => {
        const expected = perDose.get(w.name);
        const dev = expected ? Math.abs(w.grams - expected) / expected : null;
        return { name: w.name, grams: w.grams, expected: expected ?? null, deviation: dev, outOfTolerance: expected == null || dev > DOSE_DEVIATION_TOLERANCE };
      });
      const missing = [...perDose.keys()].filter((n) => !weighedItems.some((w) => w.name === n));
      transition(c, 'pharmacist_final_check', actor, body.note || '按方自动配药，待药师复核');
      c.dispensingRecords.push({ type: 'weighed', by: String(actor.id), role: actor.role, at, items: deviations, missing, autoPick: true });
      break;
    }
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
    case 'handover': {
      const alreadyHandover = (c.dispensingRecords || []).find((r) => r.type === 'handover');
      if (alreadyHandover && c.state === 'completed') return c;
      transition(c, 'completed', actor, body.note || '已交付');
      c.dispensingRecords.push({ type: 'handover', by: String(actor.id), role: actor.role, at, idempotencyKey });
      if (c.followUpPlan?.dueAt || c.followUpPlan?.ownerId) {
        followUp.createScheduled(c, c.followUpPlan, { id: c.followUpPlan.ownerId || actor.id, role: 'pharmacist' });
      }
      break;
    }
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
    ...staffPatientDisplay(c),
    riskTier: c.analyses.at(-1)?.output?.riskTier || null,
    abstain: Boolean(c.analyses.at(-1)?.output?.abstain),
    displaySource: c.analyses.at(-1)?.output?.displaySource || null,
    evidenceStrength: c.analyses.at(-1)?.output?.evidenceStrength || null,
    escalateReasons: priorityReason(c),
    secondReviewPending: Boolean(c.secondReview?.status === 'pending'),
    reviewLane: c.reviewLane || researchProtocol.assignLane(c.analyses.at(-1)?.output),
    firstSigner: c.secondReview?.firstSigner || null,
    analysisId: c.analyses.at(-1)?.analysisId || null,
    recommendation: c.analyses.at(-1)?.output?.recommendation || null,
    synthetic: Boolean(c.synthetic),
  });
  const dual = pending.filter((c) => (c.reviewLane || researchProtocol.assignLane(c.analyses.at(-1)?.output)) === 'dual' || c.secondReview?.status === 'pending');
  const rest = pending.filter((c) => !dual.includes(c));
  return {
    protocol: researchProtocol.getProtocol(),
    secondReview: dual.map(toItem),
    fast: rest.filter((c) => (c.reviewLane || researchProtocol.assignLane(c.analyses.at(-1)?.output)) === 'fast').map(toItem),
    priority: rest.filter((c) => (c.reviewLane || researchProtocol.assignLane(c.analyses.at(-1)?.output)) !== 'fast').map(toItem),
    batch: rest.filter((c) => (c.reviewLane || researchProtocol.assignLane(c.analyses.at(-1)?.output)) === 'fast').map(toItem),
  };
}

function sampleLowRisk(actor, { rate = 0.1, seed } = {}) {
  const { stratifiedSample } = require('./sampling');
  const { randomId } = require('../common/hash');
  const eligible = repo.listCases().filter((c) => {
    const a = c.analyses.at(-1)?.output;
    return a?.riskTier === 'A1' && ['pharmacist_approved', 'patient_confirmed', 'dispensing', 'ready_for_pickup', 'completed'].includes(c.state);
  });
  const sampleSeed = seed || randomId('samp');
  const chosen = stratifiedSample(eligible, { rate, seed: sampleSeed, keyFn: (c) => c.state });
  const picked = chosen.map((c) => ({
    caseId: c.caseId,
    sampledAt: new Date().toISOString(),
    sampledBy: String(actor.id),
    riskTier: 'A1',
    state: c.state,
    purpose: 'low_risk_quality_audit',
    seed: sampleSeed,
  }));
  picked.forEach((row) => repo.learning().addSample(row));
  audit.append({
    eventType: 'low_risk_sample', actorType: actor.role, actorId: actor.id,
    payload: { count: picked.length, eligible: eligible.length, rate, seed: sampleSeed, method: 'stratified_by_state' },
  });
  return { eligible: eligible.length, sampled: picked.length, seed: sampleSeed, method: 'stratified_by_state', cases: picked };
}

function issueClarification(caseId, body, actor) {
  if (!hasPharmacistCredential(actor) || actor.role !== 'pharmacist') {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Only a pharmacist can send clarification tasks');
  }
  const c = getCaseOr404(caseId);
  if (!['information_incomplete', 'pharmacist_review_required', 'received', 'ai_screening'].includes(c.state)) {
    throw new ServiceError(409, 'invalid_state', `Clarification is not available in state ${c.state}`);
  }
  const task = clarification.createTask(c, body, actor);
  if (body.send !== false) clarification.sendTask(c, task.taskId, actor);
  const t = issueToken(c.caseId, 'clarification', PATIENT_TOKEN_TTL_MS(), {
    contentVersion: c.contentVersion,
    taskId: task.taskId,
    questionVersion: task.questionVersion,
    patientRef: c.patient?.patientRef || null,
  });
  task.tokenFingerprint = fingerprint(t.tokenHash);
  if (c.state !== 'information_incomplete') {
    transition(c, 'information_incomplete', actor, `澄清：${task.fieldPath}`);
  }
  record(c, 'clarification_issued', actor, { taskId: task.taskId, fieldPath: task.fieldPath, tokenFingerprint: task.tokenFingerprint });
  repo.saveCase(c);
  return { task, token: t.token, expiresAt: t.expiresAt, path: `/patient/clarification/${t.token}` };
}

function getClarification(token) {
  const { rec } = resolveToken(token, 'clarification');
  const c = getCaseOr404(rec.caseId);
  const task = (c.clarificationTasks || []).find((x) => x.taskId === rec.taskId);
  if (!task) throw new ServiceError(404, 'clarification_not_found', 'Clarification task not found');
  const spec = facts.FIELD_VALUE_SCHEMA[task.fieldPath] || {};
  return {
    ...patientView(c),
    task: {
      taskId: task.taskId,
      fieldPath: task.fieldPath,
      question: task.question,
      reason: task.reason,
      status: task.status,
      allowedStatuses: facts.FACT_STATUSES,
      fieldType: spec.type || 'string',
      unit: spec.unit || null,
    },
  };
}

async function submitClarification(token, body) {
  const { hash, rec } = resolveToken(token, 'clarification');
  const c = getCaseOr404(rec.caseId);
  const loadedContentVersion = c.contentVersion;
  const loadedRecordVersion = c.recordVersion || 0;
  const task = (c.clarificationTasks || []).find((x) => x.taskId === rec.taskId);
  if (!task) throw new ServiceError(404, 'clarification_not_found', 'Clarification task not found');
  if (task.status === 'answered' && rec.usedAt) {
    return { outcome: 'answered', state: c.state, taskId: task.taskId, idempotent: true };
  }
  const patient = { role: 'patient', id: `token:${fingerprint(hash)}` };
  let applied;
  try {
    clarification.answerTask(c, task, body);
    applied = facts.applyFactChange(c.patient, {
      changeId: randomId('fch'),
      kind: body.kind || 'correct',
      fieldPath: task.fieldPath,
      newValue: body.value,
      newStatus: body.status,
      oldValue: body.oldValue,
    }, patient);
  } catch (err) {
    if (err.code === 'invalid_fact_value') throw new ServiceError(400, 'invalid_fact_value', `Invalid value for ${task.fieldPath}`);
    throw err;
  }
  c.patient = applied.patient;
  task.response = {
    ...task.response,
    normalized: { status: body.status, value: applied.change?.newValue ?? body.value },
  };
  repo.tokens().put(hash, { ...rec, usedAt: new Date().toISOString() });
  record(c, 'clarification_answered', patient, { taskId: task.taskId, fieldPath: task.fieldPath });
  const beforeHash = c.contentHash;
  const newHash = hashObject(contentOf(c));
  if (newHash !== beforeHash) {
    c.contentVersion += 1;
    c.contentHash = newHash;
    c.contentHistory.push({
      version: c.contentVersion, contentHash: newHash, changedBy: { role: patient.role, id: patient.id }, at: new Date().toISOString(), reason: `患者澄清 ${task.fieldPath}`,
    });
    clarification.retainOpenOnFactChange(c);
    invalidateApproval(c, patient, 'clarification_updated_facts');
  }
  persistCase(c, { expectedVersion: loadedContentVersion, expectedRecordVersion: loadedRecordVersion });
  syncPatientMaster(c);
  const fresh = getCaseOr404(c.caseId);
  if (['information_incomplete', 'pharmacist_review_required', 'ai_screening'].includes(fresh.state) && newHash !== beforeHash) {
    await screen(fresh, 'information_supplied');
    persistCase(fresh, { expectedRecordVersion: fresh.recordVersion });
  }
  return { outcome: 'answered', state: repo.getCase(c.caseId).state, taskId: task.taskId };
}

async function submitOwnClarification(caseId, taskId, body, actor) {
  const c = getCaseOr404(caseId);
  assertBoundPatient(c, actor);
  const loadedContentVersion = c.contentVersion;
  const loadedRecordVersion = c.recordVersion || 0;
  const task = (c.clarificationTasks || []).find((x) => x.taskId === taskId);
  if (!task) throw new ServiceError(404, 'clarification_not_found', 'Clarification task not found');
  if (task.status === 'answered') return { outcome: 'answered', state: c.state, taskId: task.taskId, idempotent: true };
  if (task.status !== 'sent') throw new ServiceError(409, 'clarification_not_open', `Clarification is ${task.status}`);
  let applied;
  try {
    clarification.answerTask(c, task, body);
    applied = facts.applyFactChange(c.patient, {
      changeId: randomId('fch'),
      kind: body.kind || 'correct',
      fieldPath: task.fieldPath,
      newValue: body.value,
      newStatus: body.status,
      oldValue: body.oldValue,
    }, actor);
  } catch (err) {
    if (err.code === 'invalid_fact_value') throw new ServiceError(400, 'invalid_fact_value', `Invalid value for ${task.fieldPath}`);
    throw err;
  }
  c.patient = applied.patient;
  task.response = { ...task.response, normalized: { status: body.status, value: applied.change?.newValue ?? body.value } };
  record(c, 'clarification_answered', actor, { taskId: task.taskId, fieldPath: task.fieldPath });
  const beforeHash = c.contentHash;
  const newHash = hashObject(contentOf(c));
  if (newHash !== beforeHash) {
    c.contentVersion += 1;
    c.contentHash = newHash;
    c.contentHistory.push({
      version: c.contentVersion, contentHash: newHash, changedBy: { role: actor.role, id: actor.id }, at: new Date().toISOString(), reason: `患者澄清 ${task.fieldPath}`,
    });
    clarification.retainOpenOnFactChange(c);
    invalidateApproval(c, actor, 'clarification_updated_facts');
  }
  persistCase(c, { expectedVersion: loadedContentVersion, expectedRecordVersion: loadedRecordVersion });
  syncPatientMaster(c);
  const fresh = getCaseOr404(c.caseId);
  if (['information_incomplete', 'pharmacist_review_required', 'ai_screening'].includes(fresh.state) && newHash !== beforeHash) {
    await screen(fresh, 'information_supplied');
    persistCase(fresh, { expectedRecordVersion: fresh.recordVersion });
  }
  return { outcome: 'answered', state: repo.getCase(c.caseId).state, taskId: task.taskId };
}

function createEducation(caseId, body, actor) {
  if (!hasPharmacistCredential(actor) || actor.role !== 'pharmacist') {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Education publish requires a pharmacist');
  }
  const c = getCaseOr404(caseId);
  const doc = education.createDraft(c, actor, { text: body.text, source: body.source || 'pharmacist' });
  record(c, 'education_drafted', actor, { documentId: doc.documentId });
  repo.saveCase(c);
  return doc;
}

function decideEducation(caseId, documentId, body, actor) {
  if (!hasPharmacistCredential(actor) || actor.role !== 'pharmacist') {
    throw new ServiceError(403, 'pharmacist_credential_required', 'Education publish requires a pharmacist');
  }
  const c = getCaseOr404(caseId);
  let doc;
  if (body.action === 'approve') doc = education.approve(c, documentId, actor);
  else if (body.action === 'publish') doc = education.publish(c, documentId, actor);
  else throw new ServiceError(400, 'unknown_action', 'Education action must be approve or publish');
  record(c, `education_${body.action}`, actor, { documentId });
  repo.saveCase(c);
  return doc;
}

function followUpAction(caseId, taskId, body, actor) {
  if (actor.role !== 'pharmacist') throw new ServiceError(403, 'pharmacist_credential_required', 'Follow-up disposition requires a pharmacist');
  const c = getCaseOr404(caseId);
  let task;
  if (body.action === 'assign') task = followUp.assign(c, taskId, actor);
  else if (body.action === 'contact') task = followUp.addContact(c, taskId, actor, body.note);
  else if (body.action === 'close') task = followUp.close(c, taskId, actor, body.summary);
  else if (body.action === 'escalate') task = followUp.escalate(c, taskId, actor, body.note);
  else throw new ServiceError(400, 'unknown_action', 'Unknown follow-up action');
  record(c, 'followup_action', actor, { taskId, action: body.action });
  repo.saveCase(c);
  return task;
}

function listFollowUps() {
  return followUp.listOpen(repo.listCases());
}

function issueFeedbackToken(caseId, actor) {
  const c = getCaseOr404(caseId);
  const t = issueToken(c.caseId, 'feedback', FEEDBACK_TOKEN_TTL_MS, {
    contentVersion: c.contentVersion, patientRef: c.patient?.patientRef || null,
  });
  record(c, 'feedback_token_issued', actor, { tokenFingerprint: fingerprint(t.tokenHash) });
  repo.saveCase(c);
  return { token: t.token, expiresAt: t.expiresAt, path: `/patient/feedback/${t.token}` };
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
  submitOwnConfirmation,
  getOwnCase,
  submitPatientFeedback,
  submitOwnFeedback,
  submitOwnClarification,
  dispensingAction,
  patientView,
  reviewQueue,
  sampleLowRisk,
  isPriorityReview,
  issueClarification,
  getClarification,
  submitClarification,
  reviewClarification,
  createEducation,
  decideEducation,
  followUpAction,
  setFollowUpPlan,
  listFollowUps,
  issueFeedbackToken,
  patientCaseDto,
};
