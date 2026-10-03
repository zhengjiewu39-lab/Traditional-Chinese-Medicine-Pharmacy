const { randomId } = require('../common/hash');
const { ServiceError } = require('./errors');

const FIELD_WHITELIST = new Set([
  'patient.facts.allergies',
  'patient.facts.currentMedications',
  'patient.facts.pregnancy',
  'patient.facts.lactation',
  'patient.facts.liverImpairment',
  'patient.facts.renalImpairment',
  'patient.facts.ageYears',
  'patient.facts.weightKg',
  'patient.sex',
]);

const TASK_STATUSES = ['draft', 'sent', 'answered', 'reviewed', 'cancelled', 'expired'];
const SOURCES = ['rule', 'model', 'pharmacist'];
const FORBIDDEN_ANSWER_KEYS = ['herbs', 'dosage', 'doseCount', 'usage', 'role', 'state', 'approval', 'approved'];

function assertField(fieldPath) {
  if (!FIELD_WHITELIST.has(fieldPath)) {
    throw new ServiceError(400, 'field_not_allowed', `Patients may only answer whitelisted fields; ${fieldPath} is not allowed`);
  }
}

function createTask(c, body, actor) {
  assertField(body.fieldPath);
  if (body.source === 'model' && body.requiredForDecision) {
    throw new ServiceError(400, 'model_cannot_set_policy', 'Model-proposed questions cannot be marked requiredForDecision unless a pharmacist confirms or a fixed template is used');
  }
  const source = SOURCES.includes(body.source) ? body.source : 'pharmacist';
  const task = {
    taskId: randomId('clar'),
    caseId: c.caseId,
    caseContentVersion: c.contentVersion,
    fieldPath: body.fieldPath,
    question: String(body.question || '').slice(0, 240),
    reason: String(body.reason || '').slice(0, 300),
    requiredForDecision: Boolean(body.requiredForDecision) && source !== 'model',
    source,
    status: 'draft',
    response: null,
    assignedTo: body.assignedTo || c.patient?.patientRef || null,
    createdBy: String(actor.id),
    createdAt: new Date().toISOString(),
    sentAt: null,
    answeredAt: null,
    reviewedAt: null,
    cancelledAt: null,
    questionVersion: 1,
  };
  c.clarificationTasks = c.clarificationTasks || [];
  c.clarificationTasks.push(task);
  return task;
}

function sendTask(c, taskId, actor) {
  const task = (c.clarificationTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'clarification_not_found', 'Clarification task not found');
  if (task.caseContentVersion !== c.contentVersion) {
    throw new ServiceError(409, 'stale_task', 'Clarification was drafted against a previous content version');
  }
  if (task.source === 'model' && task.requiredForDecision) {
    throw new ServiceError(409, 'unconfirmed_model_question', 'Pharmacist must confirm a model question before it becomes required');
  }
  task.status = 'sent';
  task.sentAt = new Date().toISOString();
  task.sentBy = String(actor.id);
  return task;
}

function answerTask(c, task, body) {
  for (const k of FORBIDDEN_ANSWER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      throw new ServiceError(400, 'forbidden_field', 'Clarification answers cannot change prescription, role or approval');
    }
  }
  assertField(task.fieldPath);
  if (task.status === 'expired' || task.status === 'cancelled') {
    throw new ServiceError(410, 'task_closed', `Clarification is ${task.status}`);
  }
  if (task.caseContentVersion !== c.contentVersion) {
    throw new ServiceError(409, 'stale_task', 'This question belongs to a previous prescription version');
  }
  const disposition = answerDisposition(body);
  task.status = 'answered';
  task.answeredAt = new Date().toISOString();
  task.response = {
    status: body.status,
    value: disposition.inferSafe ? body.value : body.value,
    kind: body.kind || disposition.kind,
    unknownChosen: disposition.kind === 'unknown',
    declined: disposition.kind === 'declined',
    inferSafe: false,
  };
  return task;
}

function reviewTask(c, taskId, actor) {
  const task = (c.clarificationTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'clarification_not_found', 'Clarification task not found');
  task.status = 'reviewed';
  task.reviewedAt = new Date().toISOString();
  task.reviewedBy = String(actor.id);
  return task;
}

function expireStale(c, { prescriptionChanged = false } = {}) {
  for (const task of c.clarificationTasks || []) {
    if (task.status === 'answered' || task.status === 'reviewed') continue;
    if (task.status === 'sent' && task.caseContentVersion !== c.contentVersion) {
      if (prescriptionChanged) task.status = 'expired';
      else task.caseContentVersion = c.contentVersion;
    }
  }
}

function retainOpenOnFactChange(c) {
  expireStale(c, { prescriptionChanged: false });
}

function openRequired(c) {
  return (c.clarificationTasks || []).filter((t) => t.requiredForDecision && ['draft', 'sent'].includes(t.status));
}

const QUESTION_WEIGHTS = {
  version: 1,
  mandatory: 100,
  mayChangePath: 40,
  conflict: 35,
  missingCritical: 30,
  missingNoncritical: 10,
  duplicatePenalty: -25,
  burdenPenalty: -8,
};

function factStatus(c, fieldPath) {
  const key = fieldPath.replace('patient.facts.', '');
  if (fieldPath === 'patient.sex') return c.patient?.facts?.sex?.status || (c.patient?.sex ? 'reported' : 'not_asked');
  return c.patient?.facts?.[key]?.status || 'not_asked';
}

function mandatoryFromRules(c) {
  const out = [];
  const missing = c.analyses?.at(-1)?.output?.missingInformation || [];
  for (const m of missing) {
    const fieldPath = FIELD_WHITELIST.has(m.field) ? m.field : (FIELD_WHITELIST.has(`patient.facts.${m.field}`) ? `patient.facts.${m.field}` : null);
    if (!fieldPath) continue;
    out.push({
      questionId: `q-mand-${fieldPath}`,
      fieldPaths: [fieldPath],
      trigger: m.critical ? 'critical_missing' : 'missing',
      associatedRisk: m.field,
      evidenceIds: [],
      mandatory: Boolean(m.critical) || Boolean(m.source === 'rule'),
      estimatedBurden: 1,
      reason: m.message || '规则要求核实',
      weightsVersion: QUESTION_WEIGHTS.version,
    });
  }
  const preg = factStatus(c, 'patient.facts.pregnancy');
  if (c.patient?.sex === 'female' && (preg === 'not_asked' || preg === 'unknown')) {
    out.push({
      questionId: 'q-mand-pregnancy',
      fieldPaths: ['patient.facts.pregnancy'],
      trigger: 'critical_missing',
      associatedRisk: 'PREGNANCY_STATUS_UNKNOWN',
      evidenceIds: [],
      mandatory: true,
      estimatedBurden: 1,
      reason: '育龄女性妊娠状态未核实',
      weightsVersion: QUESTION_WEIGHTS.version,
    });
  }
  return out;
}

function adaptiveFromFacts(c) {
  const out = [];
  for (const fieldPath of FIELD_WHITELIST) {
    const st = factStatus(c, fieldPath);
    if (!['not_asked', 'unknown', 'conflicting', 'denied'].includes(st)) continue;
    if (st === 'denied') {
      out.push({
        questionId: `q-ad-${fieldPath}-denied`,
        fieldPaths: [fieldPath],
        trigger: 'denied',
        associatedRisk: fieldPath,
        evidenceIds: [],
        mandatory: false,
        estimatedBurden: 1,
        reason: '患者拒绝或否认该资料，需药师判断是否继续',
        weightsVersion: QUESTION_WEIGHTS.version,
      });
      continue;
    }
    out.push({
      questionId: `q-ad-${fieldPath}`,
      fieldPaths: [fieldPath],
      trigger: st === 'conflicting' ? 'conflict' : 'missing',
      associatedRisk: fieldPath,
      evidenceIds: [],
      mandatory: false,
      estimatedBurden: 1,
      reason: st === 'conflicting' ? '该事实存在未解决冲突' : '该事实尚未核实',
      weightsVersion: QUESTION_WEIGHTS.version,
    });
  }
  return out;
}

function scoreQuestion(q, seenFields) {
  let score = 0;
  if (q.mandatory) score += QUESTION_WEIGHTS.mandatory;
  if (q.trigger === 'critical_missing') score += QUESTION_WEIGHTS.missingCritical;
  else if (q.trigger === 'conflict') score += QUESTION_WEIGHTS.conflict;
  else if (q.trigger === 'missing') score += QUESTION_WEIGHTS.missingNoncritical;
  if (q.associatedRisk && /PREGNANCY|ALLERG|TOXIC|HARD/.test(String(q.associatedRisk))) score += QUESTION_WEIGHTS.mayChangePath;
  if (q.fieldPaths.some((f) => seenFields.has(f))) score += QUESTION_WEIGHTS.duplicatePenalty;
  score += QUESTION_WEIGHTS.burdenPenalty * (q.estimatedBurden || 1);
  return score;
}

function selectQuestions(candidates, { mode = 'risk_adaptive', maxBurden = 6 } = {}) {
  const mandatory = candidates.filter((q) => q.mandatory);
  if (mode === 'none') return { selected: [], skipped: candidates.map((q) => ({ ...q, skipReason: 'mode_none' })), stopReason: 'no_questions' };
  if (mode === 'generic') {
    const rest = candidates.filter((q) => !q.mandatory).slice(0, Math.max(0, maxBurden - mandatory.length));
    const selected = [...mandatory, ...rest].slice(0, maxBurden);
    return {
      selected,
      skipped: candidates.filter((q) => !selected.includes(q)).map((q) => ({ ...q, skipReason: 'generic_budget' })),
      stopReason: selected.length ? null : 'nothing_to_ask',
    };
  }
  const seen = new Set();
  const ranked = [...candidates].sort((a, b) => scoreQuestion(b, seen) - scoreQuestion(a, seen));
  const selected = [];
  let burden = 0;
  for (const q of ranked) {
    if (q.mandatory) {
      selected.push({ ...q, selectionReason: 'mandatory' });
      q.fieldPaths.forEach((f) => seen.add(f));
      burden += q.estimatedBurden || 1;
      continue;
    }
    if (burden >= maxBurden) {
      q.skipReason = 'burden_cap';
      continue;
    }
    selected.push({ ...q, selectionReason: 'risk_heuristic' });
    q.fieldPaths.forEach((f) => seen.add(f));
    burden += q.estimatedBurden || 1;
  }
  return {
    selected,
    skipped: ranked.filter((q) => !selected.some((s) => s.questionId === q.questionId)),
    stopReason: burden >= maxBurden ? 'burden_cap' : null,
    weightsVersion: QUESTION_WEIGHTS.version,
    heuristicNote: 'Weights are uncalibrated ordinal heuristics, not information gain or risk probability.',
  };
}

function generateRiskQuestions(c, { mode = 'risk_adaptive', maxBurden = 6, maxRounds = 3 } = {}) {
  const priorRounds = Number(c.clarificationRound || 0);
  const remainingUnknown = [...FIELD_WHITELIST].filter((f) => ['not_asked', 'unknown', 'conflicting'].includes(factStatus(c, f)));
  if (priorRounds >= maxRounds) {
    return {
      selected: [],
      skipped: [],
      stopReason: remainingUnknown.length ? 'round_cap_escalate_pharmacist' : 'round_cap',
      remainingUnknown,
      maxRounds,
      note: 'Round cap is an experimental parameter, not a clinical standard. Stopping questions is not approval.',
    };
  }
  const merged = [];
  const seen = new Set();
  for (const q of [...mandatoryFromRules(c), ...adaptiveFromFacts(c)]) {
    const key = q.fieldPaths.join('|');
    if (seen.has(key)) {
      if (q.mandatory) {
        const idx = merged.findIndex((x) => x.fieldPaths.join('|') === key);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...q, mandatory: true };
      }
      continue;
    }
    seen.add(key);
    merged.push(q);
  }
  const asked = new Set((c.clarificationTasks || []).filter((t) => ['sent', 'answered', 'reviewed'].includes(t.status)).flatMap((t) => [t.fieldPath]));
  const unused = merged.filter((q) => !q.fieldPaths.every((f) => asked.has(f)) || q.mandatory);
  const picked = selectQuestions(unused, { mode, maxBurden });
  return {
    ...picked,
    remainingUnknown,
    clarificationRound: priorRounds + 1,
    maxRounds,
    mode,
  };
}

function recordStop(c, result) {
  c.clarificationStop = {
    stopReason: result.stopReason,
    remainingUnknown: result.remainingUnknown || [],
    at: new Date().toISOString(),
    notApproval: true,
  };
  return c.clarificationStop;
}

function answerDisposition(body) {
  const status = body.status;
  if (status === 'unknown') return { kind: 'unknown', inferSafe: false };
  if (status === 'denied' || body.declined) return { kind: 'declined', inferSafe: false };
  if (body.irrelevant) return { kind: 'irrelevant', inferSafe: false };
  if (status === 'reported' || status === 'none' || status === 'verified') return { kind: 'answered', inferSafe: false };
  return { kind: 'invalid_format', inferSafe: false };
}

module.exports = {
  FIELD_WHITELIST,
  TASK_STATUSES,
  QUESTION_WEIGHTS,
  createTask,
  sendTask,
  answerTask,
  reviewTask,
  expireStale,
  retainOpenOnFactChange,
  openRequired,
  generateRiskQuestions,
  selectQuestions,
  recordStop,
  answerDisposition,
};

