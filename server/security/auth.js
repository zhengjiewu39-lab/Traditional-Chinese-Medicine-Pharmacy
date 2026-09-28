const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_DEMO = !IS_PROD || process.env.ALLOW_DEMO_AUTH === 'true';
const FORBIDDEN_SECRETS = new Set(['change-me-in-production', 'tcm-jwt-dev-only', '']);
const JWT_SECRET = process.env.TCM_JWT_SECRET || (ALLOW_DEMO && !IS_PROD ? 'tcm-jwt-dev-only' : null);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 10;
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const PROFILE_FIELDS = ['name', 'email', 'phone', 'title'];
const VALID_ROLES = new Set(['admin', 'pharmacist', 'prescriber', 'technician', 'patient', 'researcher']);

function assertProductionAuthConfig() {
  if (!IS_PROD) return;
  const secret = process.env.TCM_JWT_SECRET;
  if (!secret || FORBIDDEN_SECRETS.has(secret)) {
    console.error('[security] TCM_JWT_SECRET must be set to a strong unique value in production');
    process.exit(1);
  }
  if (process.env.ALLOW_DEMO_AUTH === 'true') {
    console.warn('[security] ALLOW_DEMO_AUTH=true in production — demo accounts are enabled');
  }
  const users = loadUsers();
  if (!Object.keys(users).length && process.env.ALLOW_DEMO_AUTH !== 'true') {
    console.error('[security] no accounts configured: set TCM_USERS_JSON or ALLOW_DEMO_AUTH=true');
    process.exit(1);
  }
}

assertProductionAuthConfig();

let usersCache = null;

/**
 * Accounts: TCM_USERS_JSON = { username: { passwordHash: '<bcrypt>', user: {...} } }.
 * A plaintext `password` is accepted only in demo mode and is hashed on load; in production it is refused.
 */
function loadUsers() {
  const raw = process.env.TCM_USERS_JSON
    ? JSON.parse(process.env.TCM_USERS_JSON)
    : (ALLOW_DEMO ? {
      admin: {
        password: process.env.TCM_ADMIN_PASSWORD || 'admin123',
        user: { id: 1, username: 'admin', name: '管理员', role: 'admin', credentials: [] },
      },
      pharmacist: {
        password: process.env.TCM_PHARMACIST_PASSWORD || 'pharm123',
        user: { id: 2, username: 'pharmacist', name: '李药师', role: 'pharmacist', credentials: ['pharmacist'] },
      },
      pharmacist2: {
        password: process.env.TCM_PHARMACIST2_PASSWORD || 'pharm456',
        user: { id: 3, username: 'pharmacist2', name: '王药师', role: 'pharmacist', credentials: ['pharmacist'] },
      },
      prescriber: {
        password: process.env.TCM_PRESCRIBER_PASSWORD || 'doc123',
        user: { id: 7, username: 'prescriber', name: '周医师', role: 'prescriber' },
      },
      technician: {
        password: process.env.TCM_TECHNICIAN_PASSWORD || 'tech123',
        user: { id: 4, username: 'technician', name: '赵调剂员', role: 'technician' },
      },
      researcher: {
        password: process.env.TCM_RESEARCHER_PASSWORD || 'research123',
        user: { id: 5, username: 'researcher', name: '研究员', role: 'researcher' },
      },
      patient: {
        password: process.env.TCM_PATIENT_PASSWORD || 'patient123',
        user: { id: 6, username: 'patient', name: '演示患者（合成）', role: 'patient', patientRef: 'P1' },
      },
    } : {});
  const out = {};
  for (const [username, acc] of Object.entries(raw)) {
    let hash = acc.passwordHash;
    if (!hash && acc.password != null) {
      if (!ALLOW_DEMO) {
        console.error(`[security] account ${username}: plaintext password refused outside demo mode; provide passwordHash (bcrypt)`);
        continue;
      }
      hash = bcrypt.hashSync(String(acc.password), BCRYPT_COST);
    }
    if (!hash) continue;
    out[username] = { passwordHash: hash, user: acc.user };
  }
  return out;
}

function getUsers() {
  if (!usersCache) usersCache = loadUsers();
  return usersCache;
}

function hmac(data) {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify(JWT_HEADER)).toString('base64url');
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = hmac(`${header}.${body}`).toString('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(authHeader) {
  if (typeof authHeader !== 'string' || !JWT_SECRET) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  let given;
  try {
    given = Buffer.from(sig, 'base64url');
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (h.alg !== JWT_HEADER.alg || h.typ !== JWT_HEADER.typ) return null;
  } catch {
    return null;
  }
  const expected = hmac(`${header}.${body}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (!VALID_ROLES.has(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

function isPublicPath(path) {
  const p = String(path || '').split('?')[0];
  if (p === '/api/health' || p === '/api/auth/login') return true;
  if (p === '/api/pickup/redeem' || /^\/api\/pickup\/redeem\/?$/.test(p)) return true;
  if (/^\/api\/patient\/(confirmation|feedback)\/[A-Za-z0-9_-]{20,100}$/.test(p)) return true;
  return false;
}

function requireAuth(req, res, next) {
  const p = String(req.originalUrl || req.path || '').split('?')[0];
  if (!p.startsWith('/api/') || isPublicPath(p)) return next();
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, message: '未授权，请先登录' });
  req.user = user;
  return next();
}

function authenticate(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  const account = Object.prototype.hasOwnProperty.call(getUsers(), username) ? getUsers()[username] : null;
  if (!account || !bcrypt.compareSync(password, account.passwordHash)) return null;
  return { user: account.user, token: signToken(account.user) };
}

/**
 * Profile update: only PROFILE_FIELDS (strings ≤ 100 chars) may change. Any attempt to set role,
 * id, username or another field is rejected as a whole.
 */
function sanitizeProfileUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'body must be an object' };
  const forbidden = Object.keys(body).filter((k) => !PROFILE_FIELDS.includes(k));
  if (forbidden.length) return { error: `fields not allowed: ${forbidden.join(', ')}` };
  const out = {};
  for (const k of PROFILE_FIELDS) {
    if (body[k] === undefined) continue;
    if (typeof body[k] !== 'string' || body[k].length > 100) return { error: `${k} must be a string of at most 100 characters` };
    out[k] = body[k];
  }
  return { value: out };
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  authenticate,
  getUsers,
  isPublicPath,
  sanitizeProfileUpdate,
  assertProductionAuthConfig,
  PROFILE_FIELDS,
  ALLOW_DEMO,
  IS_PROD,
};
