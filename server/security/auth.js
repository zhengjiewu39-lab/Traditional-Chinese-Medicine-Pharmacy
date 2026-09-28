const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_DEMO = !IS_PROD || process.env.ALLOW_DEMO_AUTH === 'true';
const JWT_SECRET = process.env.TCM_JWT_SECRET || (ALLOW_DEMO ? 'tcm-jwt-dev-only' : null);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 10;
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const PROFILE_FIELDS = ['name', 'email', 'phone', 'title'];

if (IS_PROD && !process.env.TCM_JWT_SECRET) {
  console.error('[security] TCM_JWT_SECRET is required when NODE_ENV=production');
  process.exit(1);
}

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
        user: { id: 1, username: 'admin', name: '管理员', role: 'admin' },
      },
      pharmacist: {
        password: process.env.TCM_PHARMACIST_PASSWORD || 'pharm123',
        user: { id: 2, username: 'pharmacist', name: '李药师', role: 'pharmacist' },
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
    return payload;
  } catch {
    return null;
  }
}

function isPublicPath(path) {
  if (path === '/api/health' || path === '/api/auth/login') return true;
  if (/^\/api\/prescriptions\/pickup\/[^/]+$/i.test(path) && path !== '/api/prescriptions/pickup/queue') {
    return true;
  }
  return false;
}

function requireAuth(req, res, next) {
  if (!req.path.startsWith('/api/') || isPublicPath(req.path)) return next();
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
  PROFILE_FIELDS,
  ALLOW_DEMO,
  IS_PROD,
};
