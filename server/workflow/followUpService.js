const { randomId } = require('../common/hash');
const { ServiceError } = require('./errors');

const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'escalated', 'cancelled'];

function createFromFeedback(c, feedback, actor) {
  const task = {
    taskId: randomId('fu'),
    caseId: c.caseId,
    trigger: feedback.adverseReported ? 'patient_new_symptom' : 'scheduled_or_feedback',
    priority: feedback.patientSeverity === 'severe' ? 'high' : 'routine',
    owner: null,
    dueAt: null,
    status: 'open',
    contacts: [],
    dispositionSummary: null,
    closedBy: null,
    closedAt: null,
    createdAt: new Date().toISOString(),
    createdFromFeedbackAt: feedback.at,
    notifyChannel: 'in_app_only',
    notifyNote: '仅站内待办，未发送',
    aiMayClose: false,
  };
  c.followUpTasks = c.followUpTasks || [];
  c.followUpTasks.push(task);
  return task;
}

function createScheduled(c, plan, actor) {
  const task = {
    taskId: randomId('fu'),
    caseId: c.caseId,
    trigger: 'delivery_plus_plan',
    priority: 'routine',
    owner: actor ? String(actor.id) : null,
    dueAt: plan?.dueAt || null,
    status: actor ? 'assigned' : 'open',
    contacts: [],
    dispositionSummary: null,
    closedBy: null,
    closedAt: null,
    createdAt: new Date().toISOString(),
    notifyChannel: 'in_app_only',
    notifyNote: '仅站内待办，未发送',
    aiMayClose: false,
  };
  c.followUpTasks = c.followUpTasks || [];
  c.followUpTasks.push(task);
  return task;
}

function assign(c, taskId, actor) {
  const task = (c.followUpTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'followup_not_found', 'Follow-up task not found');
  task.owner = String(actor.id);
  task.status = 'assigned';
  return task;
}

function addContact(c, taskId, actor, note) {
  const task = (c.followUpTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'followup_not_found', 'Follow-up task not found');
  task.contacts.push({ at: new Date().toISOString(), by: String(actor.id), note: String(note || '').slice(0, 500), channel: 'in_app', delivered: false });
  if (task.status === 'open' || task.status === 'assigned') task.status = 'in_progress';
  return task;
}

function close(c, taskId, actor, summary) {
  if (actor.role === 'ai' || actor.role === 'system') {
    throw new ServiceError(403, 'ai_cannot_close_followup', 'AI cannot close a clinical follow-up task');
  }
  const task = (c.followUpTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'followup_not_found', 'Follow-up task not found');
  if (!summary) throw new ServiceError(400, 'summary_required', 'Closing a follow-up requires a disposition summary');
  task.status = 'resolved';
  task.dispositionSummary = String(summary).slice(0, 1000);
  task.closedBy = String(actor.id);
  task.closedAt = new Date().toISOString();
  return task;
}

function escalate(c, taskId, actor, note) {
  const task = (c.followUpTasks || []).find((t) => t.taskId === taskId);
  if (!task) throw new ServiceError(404, 'followup_not_found', 'Follow-up task not found');
  task.status = 'escalated';
  task.contacts.push({ at: new Date().toISOString(), by: String(actor.id), note: note || 'escalated', channel: 'in_app', delivered: false });
  return task;
}

function listOpen(cases) {
  return cases.flatMap((c) => (c.followUpTasks || []).filter((t) => ['open', 'assigned', 'in_progress', 'escalated'].includes(t.status)).map((t) => ({
    ...t,
    caseId: c.caseId,
    overdue: t.dueAt ? Date.parse(t.dueAt) < Date.now() : false,
    noResponse: t.contacts.some((x) => x.note === 'no_response') || (t.contacts.length > 0 && t.status !== 'resolved' && t.dueAt && Date.parse(t.dueAt) < Date.now()),
  })));
}

module.exports = {
  STATUSES, createFromFeedback, createScheduled, assign, addContact, close, escalate, listOpen,
};
