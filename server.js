const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3001;

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 模拟数据
const mockData = {
  // 销售数据
  sales: {
    trends: [
      { month: '一月', sales: 5000 },
      { month: '二月', sales: 6200 },
      { month: '三月', sales: 7800 },
      { month: '四月', sales: 8500 },
      { month: '五月', sales: 9100 },
      { month: '六月', sales: 10500 },
    ],
    stats: {
      totalSales: 47100,
      growth: 12.5,
      mostSoldItem: '六味地黄丸',
      leastSoldItem: '藿香正气水',
    }
  },
  
  // 库存数据
  inventory: [
    { id: 1, name: '六味地黄丸', category: '丸剂', stock: 1200, unit: '瓶', price: 35.5, minStock: 500, supplier: '同仁堂' },
    { id: 2, name: '藿香正气水', category: '合剂', stock: 800, unit: '瓶', price: 22.8, minStock: 400, supplier: '广州白云山' },
    { id: 3, name: '人参', category: '中药材', stock: 50, unit: '克', price: 120, minStock: 30, supplier: '吉林参厂' },
    { id: 4, name: '板蓝根颗粒', category: '颗粒剂', stock: 2000, unit: '盒', price: 15.6, minStock: 800, supplier: '一方制药' },
    { id: 5, name: '复方丹参片', category: '片剂', stock: 1500, unit: '盒', price: 32.5, minStock: 600, supplier: '天士力' },
  ],
  
  // 库存统计
  inventoryStats: {
    totalItems: 5,
    totalValue: 135600,
    lowStockItems: 1,
    mostValuableCategory: '中药材',
  },
  
  // 客户数据
  customers: [
    { id: 1, name: '张三', gender: '男', age: 45, phone: '13812345678', lastVisit: '2023-05-15', visits: 12, spending: 1560 },
    { id: 2, name: '李四', gender: '女', age: 32, phone: '13987654321', lastVisit: '2023-05-10', visits: 5, spending: 780 },
    { id: 3, name: '王五', gender: '男', age: 65, phone: '13612345678', lastVisit: '2023-05-12', visits: 20, spending: 3200 },
    { id: 4, name: '赵六', gender: '女', age: 28, phone: '13712345678', lastVisit: '2023-05-01', visits: 2, spending: 350 },
    { id: 5, name: '钱七', gender: '男', age: 52, phone: '13512345678', lastVisit: '2023-04-25', visits: 8, spending: 1200 },
  ],
  
  // 客户统计
  customerStats: {
    totalCustomers: 5,
    newCustomersThisMonth: 2,
    averageSpending: 1418,
    mostFrequentCustomer: '王五',
  },
  
  // 订单数据
  orders: [
    { id: 1, customer: '张三', items: 3, total: 235.5, status: '已完成', date: '2023-05-15' },
    { id: 2, customer: '李四', items: 2, total: 180.2, status: '处理中', date: '2023-05-14' },
    { id: 3, customer: '王五', items: 5, total: 420.8, status: '已完成', date: '2023-05-12' },
    { id: 4, customer: '赵六', items: 1, total: 85.5, status: '待支付', date: '2023-05-11' },
    { id: 5, customer: '钱七', items: 4, total: 320.6, status: '已完成', date: '2023-05-10' },
  ],
  
  // 类别数据
  categories: [
    { id: 1, name: '丸剂', count: 15, popularity: '高' },
    { id: 2, name: '合剂', count: 8, popularity: '中' },
    { id: 3, name: '中药材', count: 50, popularity: '高' },
    { id: 4, name: '颗粒剂', count: 12, popularity: '高' },
    { id: 5, name: '片剂', count: 20, popularity: '中' },
    { id: 6, name: '胶囊剂', count: 10, popularity: '低' },
  ],
  
  // 处方记录
  prescriptions: [
    { id: 1, patient: '张三', doctor: '李医生', date: '2023-05-15', items: ['人参', '黄芪', '当归'], status: '已审核' },
    { id: 2, patient: '李四', doctor: '王医生', date: '2023-05-14', items: ['板蓝根', '金银花', '连翘'], status: '已审核' },
    { id: 3, patient: '王五', doctor: '张医生', date: '2023-05-12', items: ['川芎', '白芍', '熟地黄'], status: '待审核' },
  ]
};

// API 路由
// 销售数据相关API
app.get('/api/sales/trends', (req, res) => {
  res.json(mockData.sales.trends);
});

app.get('/api/sales/stats', (req, res) => {
  res.json(mockData.sales.stats);
});

// 库存数据相关API
app.get('/api/inventory', (req, res) => {
  res.json(mockData.inventory);
});

app.get('/api/inventory/stats', (req, res) => {
  res.json(mockData.inventoryStats);
});

app.get('/api/inventory/low-stock', (req, res) => {
  const lowStockItems = mockData.inventory.filter(item => item.stock <= item.minStock);
  res.json(lowStockItems);
});

// 客户数据相关API
app.get('/api/customers', (req, res) => {
  res.json(mockData.customers);
});

app.get('/api/customers/stats', (req, res) => {
  res.json(mockData.customerStats);
});

// 订单数据相关API
app.get('/api/orders', (req, res) => {
  res.json(mockData.orders);
});

// 类别数据相关API
app.get('/api/categories', (req, res) => {
  res.json(mockData.categories);
});

// 处方数据相关API
app.get('/api/prescriptions', (req, res) => {
  res.json(mockData.prescriptions);
});

// 认证相关API
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      token: 'mock-jwt-token',
      user: {
        id: 1,
        username: 'admin',
        name: '管理员',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: '已成功退出登录'
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 在实际应用中，这里会验证token的有效性
    res.json({
      id: 1,
      username: 'admin',
      name: '管理员',
      role: 'admin'
    });
  } else {
    res.status(401).json({
      success: false,
      message: '未授权访问'
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`模拟API服务器运行在端口 ${port}`);
}); 