require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const { getStore } = require('./server/data/store');
const { computeSalesStats } = require('./server/services/stats');
const { analyzePrescription } = require('./server/services/prescriptionAnalyzer');
const {
  requireAuth, authenticate, verifyToken, sanitizeProfileUpdate, ALLOW_DEMO, getUserById,
} = require('./server/security/auth');
const { validateUploadedText, MAX_BYTES } = require('./server/security/uploadValidation');

const inventoryRoutes = require('./server/routes/inventory');
const customerRoutes = require('./server/routes/customers');
const orderRoutes = require('./server/routes/orders');
const patientRoutes = require('./server/routes/patients');
const prescriptionRoutes = require('./server/routes/prescriptions');
const templateRoutes = require('./server/routes/templates');
const billingRoutes = require('./server/routes/billing');
const herbRoutes = require('./server/routes/herbs');
const dashboardRoutes = require('./server/routes/dashboard');
const exportRoutes = require('./server/routes/export');
const traceabilityRoutes = require('./server/routes/traceability');
const aiRoutes = require('./server/routes/ai');
const patientPortalRoutes = require('./server/routes/patientPortal');
const pickupRoutes = require('./server/routes/pickup');
const evaluationRoutes = require('./server/research/evaluationRoutes');
const { roleApiGuard } = require('./server/security/rbac');
const { assertProductionAIConfig, describeProvider } = require('./server/ai/providerAdapter');
const { importIfNeeded } = require('./server/db/migrateFromJson');

try {
  assertProductionAIConfig();
} catch (err) {
  console.error(`[ai] ${err.message}`);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3002;
function archived(req, res) {
  return res.status(410).json({ error: { code: 'archived', message: 'This module was archived. Restore from archive/ or git tag v1.0.0-research / legacy-cdss-v1.' } });
}

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", ...(corsOrigins || [])],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
}));
app.use(cors({
  origin: corsOrigins || (process.env.NODE_ENV === 'production' ? false : true),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 20 },
});

app.use(roleApiGuard);

app.use((req, res, next) => {
  const url = req.url.replace(/\/(confirmation|feedback|clarification)\/[^/?]+/, '/$1/[token]');
  console.log(`${new Date().toISOString()} - ${req.method} ${url}`);
  next();
});

// ── 智能药房（药师监管 · 患者参与 · AI编排） ──
app.use('/api/ai', aiRoutes);
app.use('/api/patient', patientPortalRoutes);
app.use('/api/pickup', pickupRoutes);

// ── 仪表盘 & 搜索 ──
app.use('/api/dashboard', dashboardRoutes);

// ── 销售 ──
app.get('/api/sales/trends', (req, res) => {
  res.json(getStore().sales?.trends || []);
});

app.get('/api/sales/stats', (req, res) => {
  res.json(computeSalesStats(getStore().orders));
});

app.get('/api/sales', (req, res) => {
  const data = getStore();
  res.json({ trends: data.sales?.trends, stats: computeSalesStats(data.orders), orders: data.orders });
});

// ── 类别 ──
app.get('/api/categories', (req, res) => {
  res.json(getStore().categories);
});

app.get('/api/categories/stats', (req, res) => {
  const data = getStore();
  res.json(data.categories.map(c => ({ ...c, value: data.inventory.filter(i => i.category === c.name).length })));
});

// ── 业务路由 ──
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/prescription-templates', templateRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/herbs', herbRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/traceability', traceabilityRoutes);
app.use('/api/research/evaluation', evaluationRoutes);

app.use('/api/simulation', archived);
app.use('/api/analytics', archived);
app.use('/api/research', (req, res, next) => {
  if (req.path.startsWith('/evaluation') || req.originalUrl.startsWith('/api/research/evaluation')) return next();
  return archived(req, res);
});

// 处方文件上传分析
app.post('/api/prescriptions/analyze/file', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: '缺少文件' });
    const checked = validateUploadedText(req.file);
    if (checked.error) return res.status(400).json({ success: false, message: `文件被拒绝：${checked.error}` });
    const { prescription, ...rest } = req.body || {};
    return res.json(analyzePrescription({ ...rest, prescription: prescription || checked.value }));
  });
});

// ── 认证 ──
app.post('/api/auth/login', (req, res) => {
  const { username, password, patientRef } = req.body || {};
  const result = authenticate(username, password, { patientRef });
  if (!result) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  return res.json({ success: true, ...result });
});

app.get('/api/auth/demo-patients', (req, res) => {
  if (!ALLOW_DEMO) return res.status(404).json({ error: { code: 'not_found', message: 'Not available' } });
  const { listDemoPatients } = require('./server/workflow/patientIdentity');
  res.json(listDemoPatients({ q: req.query.q, limit: req.query.limit, offset: req.query.offset }));
});

app.post('/api/auth/assume-patient', (req, res) => {
  if (!ALLOW_DEMO) return res.status(403).json({ error: { code: 'forbidden', message: 'Demo only' } });
  if (req.user?.role !== 'patient') return res.status(403).json({ error: { code: 'forbidden', message: 'Patient login required' } });
  const result = authenticate('patient', process.env.TCM_PATIENT_PASSWORD || 'patient123', { patientRef: req.body?.patientRef });
  if (!result) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown synthetic patient' } });
  return res.json({ success: true, ...result });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: '已成功退出登录' });
});

app.get('/api/auth/me', (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, message: '未授权访问' });
  const fresh = getUserById(user.id);
  if (fresh?.patientRef && !user.patientRef) user.patientRef = fresh.patientRef;
  return res.json(user);
});

app.put('/api/auth/profile', (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: '未授权访问' });
  const update = sanitizeProfileUpdate(req.body);
  if (update.error) return res.status(400).json({ success: false, message: update.error });
  return res.json({ ...req.user, ...update.value });
});

app.post('/api/auth/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: '未授权访问' });
  res.status(501).json({ success: false, message: '密码修改未启用；请联系管理员更新 TCM_USERS_JSON 中的 passwordHash' });
});

app.post('/api/auth/register', (req, res) => {
  res.status(501).json({ message: '请联系管理员开通账号' });
});

app.get('/api/health', (req, res) => {
  const runtime = describeProvider();
  res.json({
    status: 'ok',
    service: 'TCM digital pharmacy research prototype',
    features: ['pharmacist-supervised-ai-support', 'clarification', 'education-approval', 'follow-up', 'sqlite-store', 'synthetic-data-only'],
    archived: ['supply-simulation', 'operations-agent', 'legacy-cdss-research'],
    ai: {
      provider: runtime.provider,
      isMock: runtime.isMock,
      inferenceMode: runtime.isMock ? 'mock' : (runtime.provider === 'disabled' ? 'disabled' : 'real'),
    },
    note: 'Research prototype. Not clinically validated. Mock is not a live model.',
  });
});

const migrated = importIfNeeded();
if (migrated && migrated.ok === false) {
  console.error('[migrate] JSON import failed; refusing to listen so incomplete data is not served:', migrated.error);
  process.exit(1);
}
getStore();
require('./server/workflow/catalogAlign').bootstrap();
require('./server/research/experimentJobs').resumeUnfinished();

const server = app.listen(port, () => {
  console.log(`中药数字药学服务 API http://localhost:${port}`, migrated?.skipped ? '(sqlite already imported)' : '');
  if (ALLOW_DEMO) {
    console.log('  演示账号: admin/admin123 · pharmacist/pharm123 · pharmacist2/pharm456 · prescriber/doc123 · technician/tech123 · researcher/research123 · patient/patient123 (仅 DEV / ALLOW_DEMO_AUTH)');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${port} 已被占用，无法启动后端。`);
    console.error('请先结束旧进程，然后重新启动：');
    console.error(`  npm run stop`);
    console.error(`  npm run server`);
    console.error(`或手动: lsof -i :${port}  →  kill -9 <PID>\n`);
    process.exit(1);
  }
  console.error('服务器启动失败:', err);
  process.exit(1);
});
