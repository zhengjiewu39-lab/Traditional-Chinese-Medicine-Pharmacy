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
  task.status = 'answered';
  task.answeredAt = new Date().toISOString();
  task.response = {
    status: body.status,
    value: body.value,
    kind: body.kind || 'correct',
    unknownChosen: body.status === 'unknown',
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

module.exports = {
  FIELD_WHITELIST,
  TASK_STATUSES,
  createTask,
  sendTask,
  answerTask,
  reviewTask,
  expireStale,
  retainOpenOnFactChange,
  openRequired,
};
