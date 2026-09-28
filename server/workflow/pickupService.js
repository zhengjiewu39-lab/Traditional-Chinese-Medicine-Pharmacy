const crypto = require('crypto');
const { sha256, randomId } = require('../common/hash');
const { fingerprint } = require('../ai/redaction');
const repo = require('./workflowRepository');
const audit = require('../audit/auditRepository');
const { ServiceError } = require('./errors');

const TTL_MS = () => (Number(process.env.PICKUP_TOKEN_TTL_MINUTES) || 30) * 60000;
const MAX_FAILS = Number(process.env.PICKUP_MAX_FAILURES) || 5;
const LOCK_MS = 15 * 60 * 1000;

function issuePickupToken(caseId, actor) {
  const c = repo.getCase(caseId);
  if (!c) throw new ServiceError(404, 'case_not_found', 'Case not found');
  if (c.state !== 'ready_for_pickup') {
    throw new ServiceError(409, 'not_ready', 'Pickup token is issued only after pharmacist sign-off, patient confirmation and final check');
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const tokenHash = sha256(token);
  const rec = {
    caseId,
    purpose: 'pickup',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TTL_MS()).toISOString(),
    usedAt: null,
    revokedAt: null,
    issuedBy: String(actor.id),
  };
  for (const [hash, existing] of Object.entries(repo._store.read().pickupTokens || {})) {
    if (existing.caseId === caseId && !existing.usedAt && !existing.revokedAt) {
      repo.pickupTokens().put(hash, { ...existing, revokedAt: rec.issuedAt });
    }
  }
  repo.pickupTokens().put(tokenHash, rec);
  c.pickup = { tokenHash, issuedAt: rec.issuedAt, expiresAt: rec.expiresAt, tokenFingerprint: fingerprint(tokenHash) };
  repo.saveCase(c);
  audit.append({
    caseId, eventType: 'pickup_token_issued', actorType: actor.role, actorId: actor.id,
    payload: { tokenFingerprint: fingerprint(tokenHash), expiresAt: rec.expiresAt },
  });
  return { token, expiresAt: rec.expiresAt, caseRef: c.caseId.slice(-8) };
}

function failKey(req) {
  return req?.ip || 'unknown';
}

function redeem(token, req) {
  const key = failKey(req);
  const fails = repo.pickupFailures().get(key);
  if (fails.lockedUntil && Date.parse(fails.lockedUntil) > Date.now()) {
    throw new ServiceError(429, 'pickup_locked', 'Too many failed pickup attempts; try later');
  }
  if (typeof token !== 'string' || token.length < 16 || token.length > 80) {
    registerFail(key, fails);
    throw new ServiceError(400, 'invalid_token', 'Invalid pickup token');
  }
  const hash = sha256(token);
  const rec = repo.pickupTokens().get(hash);
  if (!rec || rec.purpose !== 'pickup') {
    registerFail(key, fails);
    audit.append({ eventType: 'pickup_redeem_failed', actorType: 'anonymous', actorId: key, payload: { reason: 'not_found' } });
    throw new ServiceError(404, 'invalid_token', 'Invalid or expired pickup token');
  }
  if (rec.usedAt) throw new ServiceError(410, 'token_used', 'This pickup token has already been used');
  if (rec.revokedAt) throw new ServiceError(410, 'token_revoked', 'This pickup token was replaced');
  if (Date.parse(rec.expiresAt) <= Date.now()) throw new ServiceError(410, 'token_expired', 'This pickup token has expired');
  const c = repo.getCase(rec.caseId);
  if (!c || c.state !== 'ready_for_pickup') throw new ServiceError(409, 'not_ready', 'Prescription is not ready for pickup');
  repo.pickupTokens().put(hash, { ...rec, usedAt: new Date().toISOString() });
  repo.pickupFailures().put(key, { count: 0, lockedUntil: null });
  audit.append({
    caseId: c.caseId, eventType: 'pickup_redeemed', actorType: 'anonymous', actorId: key,
    payload: { tokenFingerprint: fingerprint(hash), caseRef: c.caseId.slice(-8) },
  });
  return {
    caseRef: c.caseId.slice(-8),
    ready: true,
    herbs: (c.prescription.herbs || []).map((h) => ({ name: h.name, dosage: h.dosage, unit: h.unit || 'g' })),
    doseCount: c.prescription.doseCount ?? null,
    form: c.prescription.form ?? null,
    expiresAt: rec.expiresAt,
    synthetic: Boolean(c.synthetic),
  };
}

function registerFail(key, fails) {
  const count = (fails.count || 0) + 1;
  const lockedUntil = count >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  repo.pickupFailures().put(key, { count, lockedUntil, lastAt: new Date().toISOString() });
}

module.exports = { issuePickupToken, redeem, randomId };
