/** Shared HTTP helpers for the AI and patient routes: body limits, validation, errors, access audit. */
const rateLimit = require('express-rate-limit');
const { check } = require('../common/schema');
const { forbiddenFieldsIn } = require('../workflow/caseSchemas');
const { sendError } = require('../security/rbac');
const audit = require('../audit/auditRepository');

const MAX_BODY_BYTES = 64 * 1024;

function limitBody(maxBytes = MAX_BODY_BYTES) {
  return (req, res, next) => {
    const declared = Number(req.headers['content-length'] || 0);
    const actual = req.body ? Buffer.byteLength(JSON.stringify(req.body)) : 0;
    if (declared > maxBytes || actual > maxBytes) return sendError(res, 413, 'payload_too_large', `Body exceeds ${maxBytes} bytes`);
    return next();
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) return sendError(res, 400, 'invalid_body', 'Body must be a JSON object');
    const forbidden = forbiddenFieldsIn(body);
    if (forbidden.length) return sendError(res, 400, 'forbidden_fields', `Clients may not set: ${forbidden.join(', ')}`, { fields: forbidden });
    const { valid, errors } = check(schema, body);
    if (!valid) return sendError(res, 400, 'validation_failed', 'Request body failed validation', { errors: errors.slice(0, 20) });
    return next();
  };
}

function limiter(max, windowMs = 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => sendError(res, 429, 'rate_limited', 'Too many requests'),
  });
}

/** Record every API call on the audit chain (method, route pattern, status); never bodies or tokens. */
function accessAudit(area) {
  return (req, res, next) => {
    res.on('finish', () => {
      try {
        const route = `${req.baseUrl}${req.route?.path || ''}`.replace(/\/(confirmation|feedback)\/[^/]+/, '/$1/:token');
        audit.append({
          caseId: req.params?.id || null,
          eventType: 'api_request',
          actorType: req.user?.role || (area === 'patient' ? 'patient' : 'system'),
          actorId: req.user?.id ?? (area === 'patient' ? 'token-holder' : 'anonymous'),
          payload: { method: req.method, route, status: res.statusCode },
        });
      } catch {
        /* audit failures must not crash the response path */
      }
    });
    next();
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err.status && err.code) return sendError(res, err.status, err.code, err.message, err.details);
      return sendError(res, 500, 'internal_error', 'Internal error');
    }
  };
}

module.exports = {
  limitBody, validateBody, limiter, accessAudit, handle, MAX_BODY_BYTES,
};
