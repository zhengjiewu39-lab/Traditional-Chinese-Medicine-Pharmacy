/**
 * Role-based access control. Roles come only from the verified JWT (req.user.role);
 * request bodies can never supply a role, an actor or an approval state.
 * The AI is not a login role and holds no human permission.
 */

const ROLES = ['admin', 'pharmacist', 'technician', 'patient', 'researcher'];

const PERMISSIONS = {
  'case:create': ['admin', 'pharmacist', 'technician'],
  'case:read': ['admin', 'pharmacist', 'technician'],
  'case:update_content': ['admin', 'pharmacist', 'technician'],
  'case:analyze': ['admin', 'pharmacist', 'technician'],
  'case:replay': ['admin', 'pharmacist'],
  'case:audit_read': ['admin', 'pharmacist'],
  'rx:review_decision': ['pharmacist'],
  'rx:final_check': ['pharmacist'],
  'rx:request_information': ['pharmacist'],
  'rx:dispense': ['pharmacist', 'technician'],
  'rx:handover': ['pharmacist', 'technician'],
  'patient:issue_token': ['pharmacist', 'technician'],
  'ai:models_read': ['admin', 'pharmacist', 'researcher'],
  'ai:knowledge_read': ['admin', 'pharmacist', 'researcher'],
  'ai:governance_read': ['admin', 'pharmacist', 'researcher'],
  'ai:kill_switch': ['admin'],
  'ops:propose': ['admin', 'pharmacist', 'technician'],
  'ops:read': ['admin', 'pharmacist', 'technician', 'researcher'],
  'ops:simulate': ['admin', 'pharmacist', 'technician', 'researcher'],
  'ops:approve': ['admin', 'pharmacist'],
  'legacy_rx:approve': ['pharmacist'],
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

/**
 * Coarse API scoping for roles that must not reach the pharmacy business APIs:
 * patients see only the patient portal; researchers see only aggregate, synthetic or simulation data.
 */
const ROLE_API_PREFIXES = {
  patient: ['/api/patient/', '/api/auth/'],
  researcher: ['/api/simulation', '/api/research', '/api/ai/models', '/api/ai/knowledge', '/api/ai/governance/metrics', '/api/ai/operations/analysis', '/api/ai/operations/proposals', '/api/auth/'],
};

function roleApiGuard(req, res, next) {
  const allowed = req.user && ROLE_API_PREFIXES[req.user.role];
  if (!allowed || !req.path.startsWith('/api/')) return next();
  if (allowed.some((p) => req.path.startsWith(p))) return next();
  return sendError(res, 403, 'forbidden', `Role ${req.user.role} cannot access ${req.path.split('/').slice(0, 3).join('/')}`);
}

module.exports = {
  ROLES, PERMISSIONS, ROLE_API_PREFIXES, can, requirePermission, roleApiGuard, sendError,
};
