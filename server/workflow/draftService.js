const repo = require('./workflowRepository');
const audit = require('../audit/auditRepository');
const { hashObject, randomId } = require('../common/hash');
const { analyzeCase } = require('../ai/aiOrchestrator');
const runtime = require('../ai/aiRuntime');
const { parseHerbs } = require('../services/prescriptionAnalyzer');
const { getDataMode, isSyntheticMode } = require('../config/dataMode');
const { ServiceError } = require('./errors');
const { createCase, analyze } = require('./workflowService');
const suggestions = require('./suggestionService');

function parseHerbText(text) {
  if (!text) return [];
  return parseHerbs(text) || [];
}

function contentOf(d) {
  return { patient: d.patient, clinical: d.clinical, prescription: d.prescription };
}

function assertOwner(d, actor) {
  if (actor.role === 'pharmacist' || actor.role === 'admin') return;
  if (d.createdBy.id !== String(actor.id)) throw new ServiceError(403, 'not_own_draft', 'Prescribers may only access their own drafts');
}

function getOr404(id) {
  const d = repo.getDraft(id);
  if (!d) throw new ServiceError(404, 'draft_not_found', 'Draft not found');
  return d;
}

function createDraft(body, actor) {
  if (!['prescriber', 'pharmacist'].includes(actor.role)) {
    throw new ServiceError(403, 'forbidden', 'Only a prescriber can create a prescription draft');
  }
  const now = new Date().toISOString();
  const prescription = { ...(body.prescription || {}) };
  if (!prescription.herbs?.length && body.prescriptionText) prescription.herbs = parseHerbText(body.prescriptionText);
  const d = {
    draftId: randomId('draft'),
    createdAt: now,
    updatedAt: now,
    createdBy: { role: actor.role, id: String(actor.id), name: actor.name },
    dataMode: getDataMode(),
    synthetic: isSyntheticMode(),
    status: 'draft',
    patient: body.patient || {},
    clinical: { diagnosisText: body.diagnosisText || body.diagnosis || '', notes: body.notes || '' },
    prescription: {
      herbs: prescription.herbs || [],
      usage: prescription.usage || '',
      doseCount: prescription.doseCount,
      form: prescription.form || 'decoction',
      decoctionNotes: prescription.decoctionNotes || '',
    },
    prescriptionText: body.prescriptionText || '',
    contentVersion: 1,
    contentHash: null,
    analyses: [],
    suggestionIds: [],
    caseId: null,
    dispositions: [],
  };
  d.contentHash = hashObject(contentOf(d));
  repo.saveDraft(d);
  audit.append({
    eventType: 'draft_created', actorType: actor.role, actorId: actor.id, payload: { draftId: d.draftId, contentHash: d.contentHash },
  });
  return d;
}

function patchDraft(id, body, actor) {
  const d = getOr404(id);
  assertOwner(d, actor);
  if (d.status !== 'draft') throw new ServiceError(409, 'draft_submitted', 'Submitted drafts cannot be edited; create a new draft from the returned case');
  const before = d.contentHash;
  if (body.patient) d.patient = { ...d.patient, ...body.patient };
  if (body.clinical || body.diagnosisText || body.diagnosis) {
    d.clinical = { ...d.clinical, ...(body.clinical || {}), ...(body.diagnosisText || body.diagnosis ? { diagnosisText: body.diagnosisText || body.diagnosis } : {}) };
  }
  if (body.prescription || body.prescriptionText) {
    const prescription = { ...d.prescription, ...(body.prescription || {}) };
    if (body.prescriptionText) {
      d.prescriptionText = body.prescriptionText;
      prescription.herbs = parseHerbText(body.prescriptionText);
    }
    d.prescription = prescription;
  }
  const newHash = hashObject(contentOf(d));
  if (newHash === before) return { draft: d, changed: false };
  d.contentVersion += 1;
  d.contentHash = newHash;
  d.updatedAt = new Date().toISOString();
  d.analyses.forEach((a) => { a.stale = true; });
  suggestions.supersedePending({ draftId: d.draftId });
  repo.saveDraft(d);
  audit.append({ eventType: 'draft_changed', actorType: actor.role, actorId: actor.id, payload: { draftId: d.draftId, fromHash: before, toHash: newHash } });
  return { draft: d, changed: true };
}

function asCaseRecord(d) {
  return {
    caseId: d.draftId,
    source: { channel: 'prescriber_draft' },
    patient: d.patient,
    prescriber: { name: d.createdBy.name, userId: d.createdBy.id, licenseVerified: true },
    prescription: { ...d.prescription, diagnosisText: d.clinical.diagnosisText },
  };
}

async function analyzeDraft(id, actor) {
  const d = getOr404(id);
  assertOwner(d, actor);
  if (d.status !== 'draft') throw new ServiceError(409, 'draft_submitted', 'Cannot analyse a submitted draft');
  const provider = runtime.getProvider();
  const output = await analyzeCase(asCaseRecord(d), {
    provider, aiEnabled: runtime.isAiEnabled(), timeoutMs: runtime.timeoutMs(),
  });
  const analysis = { analysisId: output.analysisId, contentHash: d.contentHash, at: output.generatedAt, output, stale: false };
  d.analyses.push(analysis);
  suggestions.supersedePending({ draftId: d.draftId });
  const created = suggestions.suggestionsFromAnalysis({
    draftId: d.draftId, analysis, inputHash: d.contentHash,
  });
  d.suggestionIds = created.map((s) => s.suggestionId);
  d.updatedAt = new Date().toISOString();
  repo.saveDraft(d);
  audit.append({
    eventType: 'draft_analyzed', actorType: 'ai', actorId: output.modelVersion,
    payload: { draftId: d.draftId, analysisId: output.analysisId, riskTier: output.riskTier, displaySource: output.displaySource },
    modelVersion: output.modelVersion, promptVersion: output.promptVersion, knowledgeBaseVersion: output.knowledgeBaseVersion, ruleSetVersion: output.ruleSetVersion,
  });
  return { draft: d, analysis: output, suggestions: created };
}

function applyProposedChange(d, proposed) {
  if (!proposed || proposed.type !== 'replace_herb') return d;
  d.prescription.herbs = (d.prescription.herbs || []).map((h) => (
    h.name === proposed.from ? { ...h, name: proposed.to, note: `采纳候选：${proposed.from}→${proposed.to}` } : h
  ));
  d.prescriptionText = (d.prescription.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}g`).join('，');
  return d;
}

function disposeSuggestion(draftId, suggestionId, body, actor) {
  const d = getOr404(draftId);
  assertOwner(d, actor);
  const s = repo.getSuggestion(suggestionId);
  if (!s || s.draftId !== draftId) throw new ServiceError(404, 'suggestion_not_found', 'Suggestion not found');
  const beforeHash = d.contentHash;
  if ((body.status === 'accepted' || body.status === 'partially_accepted') && s.proposedChange) {
    applyProposedChange(d, s.proposedChange);
    d.contentHash = hashObject(contentOf(d));
    d.contentVersion += 1;
    d.updatedAt = new Date().toISOString();
    repo.saveDraft(d);
  }
  const decided = suggestions.decide(suggestionId, { ...body, afterHash: d.contentHash }, actor);
  d.dispositions.push({ suggestionId, status: decided.status, at: decided.disposition.decidedAt });
  repo.saveDraft(d);
  return { draft: d, suggestion: decided, contentChanged: beforeHash !== d.contentHash };
}

async function submitDraft(id, actor) {
  const d = getOr404(id);
  assertOwner(d, actor);
  if (d.status !== 'draft') throw new ServiceError(409, 'already_submitted', 'Draft already submitted');
  for (const s of repo.listSuggestions({ draftId: d.draftId, status: 'pending' })) {
    if (s.proposedChange) {
      suggestions.decide(s.suggestionId, { status: 'rejected', reasonCode: 'already_addressed', comment: '提交时未采纳候选改方，按医师原文送审' }, actor);
    } else {
      suggestions.decide(s.suggestionId, { status: 'ignored', comment: '随原文提交药师，提示已转交审核' }, actor);
    }
  }
  const created = createCase({
    source: { channel: 'prescriber_draft', draftId: d.draftId },
    patient: d.patient,
    prescriber: { name: d.createdBy.name, userId: d.createdBy.id, licenseVerified: true },
    prescription: { ...d.prescription, diagnosisText: d.clinical.diagnosisText },
  }, actor);
  const screened = await analyze(created.caseId);
  d.status = 'submitted';
  d.caseId = created.caseId;
  d.updatedAt = new Date().toISOString();
  repo.saveDraft(d);
  for (const s of repo.listSuggestions({ draftId: d.draftId })) {
    repo.saveSuggestion({ ...s, caseId: created.caseId });
  }
  audit.append({
    caseId: created.caseId, eventType: 'draft_submitted', actorType: actor.role, actorId: actor.id,
    payload: { draftId: d.draftId, caseId: created.caseId },
  });
  return { draft: d, case: screened.case, analysis: screened.analysis };
}

module.exports = {
  createDraft, patchDraft, analyzeDraft, disposeSuggestion, submitDraft, getOr404, assertOwner,
};
