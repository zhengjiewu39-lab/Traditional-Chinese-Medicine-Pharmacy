const crypto = require('crypto');

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_DEMO = !IS_PROD || process.env.ALLOW_DEMO_AUTH === 'true';
const JWT_SECRET = process.env.TCM_JWT_SECRET || (ALLOW_DEMO ? 'tcm-jwt-dev-only' : null);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

if (IS_PROD && !process.env.TCM_JWT_SECRET) {
  console.error('[security] TCM_JWT_SECRET is required when NODE_ENV=production');
  process.exit(1);
}

function getUsers() {
  if (process.env.TCM_USERS_JSON) {
    return JSON.parse(process.env.TCM_USERS_JSON);
  }
  if (!ALLOW_DEMO) return {};
  return {
    admin: {
      password: process.env.TCM_ADMIN_PASSWORD || 'admin123',
      user: { id: 1, username: 'admin', name: '管理员', role: 'admin' },
    },
    pharmacist: {
      password: process.env.TCM_PHARMACIST_PASSWORD || 'pharm123',
      user: { id: 2, username: 'pharmacist', name: '李药师', role: 'pharmacist' },
    },
  };
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(authHeader) {
  if (!authHeader || !JWT_SECRET) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (ALLOW_DEMO && token.startsWith('tcm-token-')) {
    const account = getUsers()[token.replace('tcm-token-', '')];
    return account ? account.user : null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
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
  const account = getUsers()[username];
  if (account && account.password === password) {
    return { user: account.user, token: signToken(account.user) };
  }
  return null;
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  authenticate,
  getUsers,
  isPublicPath,
  ALLOW_DEMO,
  IS_PROD,
};
