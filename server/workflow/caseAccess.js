/**
 * One access check for case detail, analysis, desk assist, lists and counts.
 * Adding an AI route must not widen who can see a case.
 */
const { ServiceError } = require('./errors');

const ASSIST_LANES = {
  screening: ['pharmacist', 'prescriber', 'admin', 'researcher'],
  dispensing: ['pharmacist', 'technician', 'admin'],
  admin: ['admin'],
};

function ownsAsPrescriber(c, actor) {
  const id = String(actor.id);
  return c.createdBy?.id === id || c.prescriber?.userId === id;
}

function caseVisibleTo(c, actor) {
  if (!c || !actor) return false;
  if (actor.role === 'prescriber') return ownsAsPrescriber(c, actor);
  if (actor.role === 'patient') {
    return Boolean(c.patient?.patientRef && c.patient.patientRef === actor.patientRef);
  }
  return ['pharmacist', 'technician', 'admin', 'researcher'].includes(actor.role);
}

function assertCaseAccess(c, actor) {
  if (!caseVisibleTo(c, actor)) {
    throw new ServiceError(403, 'not_own_case', 'This case is outside your access scope');
  }
  return c;
}

function assertAssistLane(lane, actor) {
  const allowed = ASSIST_LANES[lane];
  if (!allowed) throw new ServiceError(400, 'unknown_lane', 'lane must be screening, dispensing or admin');
  if (!actor || !allowed.includes(actor.role)) {
    throw new ServiceError(403, 'forbidden', `Lane ${lane} is not available to this role`);
  }
}

function listFilterFor(actor) {
  if (actor?.role === 'prescriber') return { createdById: String(actor.id) };
  return {};
}

module.exports = {
  ASSIST_LANES, caseVisibleTo, assertCaseAccess, assertAssistLane, listFilterFor, ownsAsPrescriber,
};
