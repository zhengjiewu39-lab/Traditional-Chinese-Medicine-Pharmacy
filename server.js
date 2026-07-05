require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const { getStore } = require('./server/data/store');
const { computeSalesStats } = require('./server/services/stats');
const { analyzePrescription } = require('./server/services/prescriptionAnalyzer');
const { requireAuth, authenticate, verifyToken, ALLOW_DEMO } = require('./server/security/auth');

const inventoryRoutes = require('./server/routes/inventory');
const customerRoutes = require('./server/routes/customers');
const orderRoutes = require('./server/routes/orders');
const patientRoutes = require('./server/routes/patients');
const prescriptionRoutes = require('./server/routes/prescriptions');
const templateRoutes = require('./server/routes/templates');
const billingRoutes = require('./server/routes/billing');
const herbRoutes = require('./server/routes/herbs');
const dashboardRoutes = require('./server/routes/dashboard');
const analyticsRoutes = require('./server/routes/analytics');
const exportRoutes = require('./server/routes/export');
const researchRoutes = require('./server/routes/research');

const app = express();
const port = process.env.PORT || 3002;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;

app.use(helmet({ contentSecurityPolicy: false }));
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
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(txt|csv|json|xml)$/i.test(file.originalname);
    cb(ok ? null : new Error('仅支持 .txt / .csv / .json / .xml 文件'), ok);
  },
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/research', researchRoutes);

// 处方文件上传分析
app.post('/api/prescriptions/analyze/file', upload.single('file'), (req, res) => {
  const text = req.body.prescription || req.file?.originalname || '';
  res.json(analyzePrescription({ prescription: text, ...req.body }));
});

// ── 认证 ──
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = authenticate(username, password);
  if (!result) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  return res.json({ success: true, ...result });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: '已成功退出登录' });
});

app.get('/api/auth/me', (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, message: '未授权访问' });
  return res.json(user);
});

app.put('/api/auth/profile', (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: '未授权访问' });
  res.json({ ...req.user, ...req.body });
});

app.post('/api/auth/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: '未授权访问' });
  res.json({ success: true, message: '密码已更新（演示）' });
});

app.post('/api/auth/register', (req, res) => {
  res.status(501).json({ message: '请联系管理员开通账号' });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TCM Pharmacy API', version: '2.0' });
});

app.listen(port, () => {
  getStore();
  console.log(`中药药房 API http://localhost:${port} [持久化 · 全业务 CRUD]`);
  if (ALLOW_DEMO) {
    console.log('  演示账号: admin/admin123 或 pharmacist/pharm123 (仅 DEV / ALLOW_DEMO_AUTH)');
  }
});
