/**
 * Role-based access control. Roles and credentials come only from the verified JWT.
 * Request bodies can never supply a role, an actor, a reviewer or an approval state.
 * The AI is not a login role and holds no human permission.
 */

const ROLES = ['admin', 'pharmacist', 'prescriber', 'technician', 'patient', 'researcher'];

function hasPharmacistCredential(user) {
  if (!user) return false;
  if (user.role === 'pharmacist') return true;
  return Array.isArray(user.credentials) && user.credentials.includes('pharmacist');
}

const PERMISSIONS = {
  'case:create': ['admin', 'pharmacist', 'technician', 'prescriber'],
  'case:read': ['admin', 'pharmacist', 'technician', 'prescriber'],
  'case:update_content': ['pharmacist', 'prescriber'],
  'case:analyze': ['admin', 'pharmacist', 'technician', 'prescriber'],
  'case:replay': ['admin', 'pharmacist'],
  'case:audit_read': ['admin', 'pharmacist'],
  'rx:review_decision': ['pharmacist'],
  'rx:final_check': ['pharmacist'],
  'rx:education_publish': ['pharmacist'],
  'rx:followup': ['pharmacist'],
  'patient:clarification': ['pharmacist'],
  'research:evaluation': ['researcher', 'admin'],
  'rx:request_information': ['pharmacist'],
  'rx:dispense': ['pharmacist', 'technician'],
  'rx:handover': ['pharmacist', 'technician'],
  'rx:pickup_issue': ['pharmacist', 'technician'],
  'draft:create': ['prescriber', 'pharmacist'],
  'draft:read': ['prescriber', 'pharmacist', 'admin'],
  'draft:update': ['prescriber', 'pharmacist'],
  'draft:analyze': ['prescriber', 'pharmacist'],
  'draft:submit': ['prescriber', 'pharmacist'],
  'patient:issue_token': ['pharmacist', 'technician'],
  'ai:models_read': ['admin', 'pharmacist', 'researcher'],
  'ai:knowledge_read': ['admin', 'pharmacist', 'researcher', 'prescriber'],
  'ai:governance_read': ['admin', 'pharmacist', 'researcher'],
  'ai:kill_switch': ['admin'],
  'ai:runtime_configure': ['admin'],
  'ai:learning_export': ['admin', 'pharmacist', 'researcher'],
  'ai:learning_review': ['pharmacist'],
  'ai:model_publish': ['admin'],
  'ops:propose': [],
  'ops:read': [],
  'ops:simulate': [],
  'ops:approve': [],
  'legacy_rx:read': ['admin', 'pharmacist', 'technician', 'prescriber'],
  'legacy_rx:create': ['prescriber', 'pharmacist', 'technician'],
  'legacy_rx:update': ['pharmacist', 'prescriber'],
  'legacy_rx:delete': ['pharmacist', 'admin'],
  'legacy_rx:approve': ['pharmacist'],
  'legacy_rx:dispense': ['pharmacist', 'technician'],
};

function can(role, permission) {
  return Boolean(role && PERMISSIONS[permission]?.includes(role));
}

function sendError(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 401, 'unauthenticated', 'Login required');
    if (!can(req.user.role, permission)) {
      return sendError(res, 403, 'forbidden', `Role ${req.user.role} lacks permission ${permission}`);
    }
    return next();
  };
}

function requirePharmacistCredential(req, res, next) {
  if (!req.user) return sendError(res, 401, 'unauthenticated', 'Login required');
  if (!hasPharmacistCredential(req.user)) {
    return sendError(res, 403, 'pharmacist_credential_required', 'Clinical sign-off requires a pharmacist credential; admin role is not sufficient');
  }
  return next();
}

const ROLE_API_PREFIXES = {
  patient: ['/api/patient/', '/api/auth/', '/api/pickup/'],
  researcher: ['/api/research/evaluation', '/api/ai/models', '/api/ai/knowledge', '/api/ai/governance/metrics', '/api/ai/learning', '/api/auth/'],
};

function roleApiGuard(req, res, next) {
  const allowed = req.user && ROLE_API_PREFIXES[req.user.role];
  if (!allowed || !req.path.startsWith('/api/')) return next();
  if (allowed.some((p) => req.path.startsWith(p))) return next();
  return sendError(res, 403, 'forbidden', `Role ${req.user.role} cannot access ${req.path.split('/').slice(0, 3).join('/')}`);
}

const CLINICAL_FIELDS = new Set(['herbs', 'prescriptionText', 'diagnosis', 'diagnosisText', 'usage', 'doseCount', 'form', 'decoctionNotes', 'patientAge', 'patientGender']);

function stripsClinicalPatch(patch) {
  return Object.keys(patch || {}).some((k) => CLINICAL_FIELDS.has(k) || k === 'prescription' || k === 'patient');
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_API_PREFIXES,
  CLINICAL_FIELDS,
  can,
  requirePermission,
  requirePharmacistCredential,
  hasPharmacistCredential,
  roleApiGuard,
  sendError,
  stripsClinicalPatch,
};
