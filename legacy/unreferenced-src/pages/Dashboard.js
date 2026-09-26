import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  FormControl,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  AlertTitle,
  Snackbar,
  Chip,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  Checkbox,
  Slider,
  InputLabel,
  FormControlLabel,
  Switch,
  FormGroup,
  LinearProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart,
} from 'recharts';
import {
  Download,
  FilterList,
  Settings,
  Warning,
  LocalPharmacy,
  Inventory,
  People,
  Assignment,
  Business,
  Security,
  LocalShipping,
  AttachMoney,
  Timeline,
  Assessment,
  Notifications,
  Star,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
  Info,
  Psychology as AIIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import NotificationsIcon from '@mui/icons-material/Notifications';

// 生成模拟数据数组
function generateArray(base, count, generator) {
  return Array.from({ length: count }, (_, i) => generator(i, base));
}

const productNames = [
  '人参', '灵芝', '当归', '黄芪', '枸杞', '川芎', '白术', '三七', '丹参', '天麻',
  '五味子', '牛膝', '肉苁蓉', '附子', '薏苡仁', '板蓝根', '金银花', '菊花', '党参', '白术',
  '防风', '柴胡', '桂枝', '苓苏', '泽泻', '石斛', '麦冬', '天冬', '知母', '黄连',
  '黄柏', '连翘', '紫苏', '苏叶', '桑叶', '桑葚', '地黄', '熟地', '山药', '山茱萸',
  '杜仲', '女贞子', '何首乌', '百合', '芍药', '竹沥', '竹叶', '甘草', '陈皮', '半夏'
];

const customerNames = generateArray('客户', 50, (i) => `客户${i + 1}`);
const orderStatus = ['pending', 'completed', 'cancelled', 'processing'];

const mockData = {
  // 销售数据
  salesData: [
    { name: '1月', 销售额: 250000, 成本: 150000, 利润: 100000, 目标: 280000 },
    { name: '2月', 销售额: 230000, 成本: 145000, 利润: 85000, 目标: 280000 },
    { name: '3月', 销售额: 260000, 成本: 152000, 利润: 108000, 目标: 280000 },
    { name: '4月', 销售额: 290000, 成本: 160000, 利润: 130000, 目标: 300000 },
    { name: '5月', 销售额: 310000, 成本: 168000, 利润: 142000, 目标: 300000 },
    { name: '6月', 销售额: 350000, 成本: 185000, 利润: 165000, 目标: 300000 },
    { name: '7月', 销售额: 320000, 成本: 175000, 利润: 145000, 目标: 320000 },
    { name: '8月', 销售额: 340000, 成本: 180000, 利润: 160000, 目标: 320000 },
    { name: '9月', 销售额: 380000, 成本: 195000, 利润: 185000, 目标: 320000 },
    { name: '10月', 销售额: 420000, 成本: 210000, 利润: 210000, 目标: 350000 },
    { name: '11月', 销售额: 450000, 成本: 220000, 利润: 230000, 目标: 350000 },
    { name: '12月', 销售额: 500000, 成本: 240000, 利润: 260000, 目标: 350000 }
  ],

  // 库存数据
  inventoryData: {
    total: 5000,
    lowStock: 12,
    categories: [
      { name: '中药', value: 2000 },
      { name: '西药', value: 1500 },
      { name: '保健品', value: 1000 },
      { name: '医疗器械', value: 500 },
    ],
    topProducts: generateArray(null, 50, (i) => ({
      name: productNames[i % productNames.length],
      stock: Math.floor(Math.random() * 200) + 10,
      sales: Math.floor(Math.random() * 300) + 20,
      price: Math.floor(Math.random() * 500) + 20
    })),
    stockAlerts: generateArray(null, 10, (i) => ({
      name: productNames[(i * 3) % productNames.length],
      current: Math.floor(Math.random() * 10) + 1,
      min: Math.floor(Math.random() * 20) + 10
    })),
  },

  // 客户数据
  customerData: {
    total: 5000,
    new: 120,
    active: 4200,
    inactive: 800,
    growth: generateArray(null, 12, (i) => ({
      name: `${i + 1}月`,
      新客户: Math.floor(Math.random() * 200) + 50,
      老客户: Math.floor(Math.random() * 400) + 100
    })),
    topCustomers: generateArray(null, 50, (i) => ({
      name: customerNames[i],
      purchases: Math.floor(Math.random() * 60) + 10,
      total: Math.floor(Math.random() * 20000) + 2000,
      lastVisit: `2024-06-${(i % 30) + 1}`,
    })),
  },

  // 订单数据
  ordersData: {
    total: 1200,
    pending: 30,
    completed: 1100,
    cancelled: 70,
    recentOrders: generateArray(null, 50, (i) => ({
      id: `ORD${1000 + i}`,
      customer: customerNames[i % customerNames.length],
      amount: Math.floor(Math.random() * 1000) + 100,
      status: orderStatus[Math.floor(Math.random() * orderStatus.length)],
      date: `2024-06-${(i % 30) + 1}`,
    })),
  },

  // 其他数据省略...
};

// 创建模拟组织结构数据
const mockOrganizationData = {
    departments: [
    { name: '管理层', staff: 5, budget: 800000 },
    { name: '采购部', staff: 8, budget: 1200000 },
    { name: '销售部', staff: 12, budget: 1500000 },
    { name: '财务部', staff: 6, budget: 500000 },
    { name: '仓储部', staff: 10, budget: 700000 },
    { name: '质控部', staff: 7, budget: 600000 },
    ],
    performance: [
    { name: '管理层', 完成率: 95, 质量: 96, 效率: 92 },
    { name: '采购部', 完成率: 88, 质量: 92, 效率: 86 },
    { name: '销售部', 完成率: 92, 质量: 85, 效率: 90 },
    { name: '财务部', 完成率: 96, 质量: 97, 效率: 85 },
    { name: '仓储部', 完成率: 85, 质量: 90, 效率: 88 },
    { name: '质控部', 完成率: 90, 质量: 98, 效率: 82 },
  ],
  hierarchy: {
    name: "总经理",
    title: "张总",
    children: [
      {
        name: "采购总监",
        title: "王主管",
        children: [
          { name: "中药采购", title: "李经理" },
          { name: "西药采购", title: "刘经理" }
        ]
      },
      {
        name: "销售总监",
        title: "赵主管",
        children: [
          { name: "门店销售", title: "孙经理" },
          { name: "网络销售", title: "周经理" }
        ]
      },
      {
        name: "仓储主管",
        title: "吴主管",
        children: [
          { name: "库存管理", title: "郑经理" },
          { name: "物流配送", title: "钱经理" }
        ]
      },
      {
        name: "财务总监",
        title: "陈主管",
        children: [
          { name: "会计", title: "谢经理" },
          { name: "出纳", title: "马经理" }
        ]
      }
    ]
  },
  staffDistribution: [
    { name: '30岁以下', value: 15 },
    { name: '30-40岁', value: 22 },
    { name: '40-50岁', value: 12 },
    { name: '50岁以上', value: 5 },
  ],
  employeeTrends: Array.from({ length: 12 }, (_, i) => ({
    month: `${i + 1}月`,
    入职: 2 + Math.floor(Math.random() * 3),
    离职: Math.floor(Math.random() * 2),
    净增长: 2 + Math.floor(Math.random() * 3) - Math.floor(Math.random() * 2)
  })),
};

// 区块链安全说明内容
const blockchainDesc = `本系统已集成区块链技术，所有药品库存、订单、客户等关键数据均加密上链，防篡改、可追溯，保障数据安全与合规。每次药品出入库、订单处理、客户变更等操作均生成区块链记录，确保数据真实可信。`;

function Dashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('6个月');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [salesData, setSalesData] = useState([]);
  const [inventoryData, setInventoryData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [distributionData, setDistributionData] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [chartSettings, setChartSettings] = useState({
    salesChart: {
      showCost: true,
      showProfit: true,
      showSales: true,
    },
    customerChart: {
      showNew: true,
      showActive: true,
    },
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 新增药材弹窗
  const [addMedicineOpen, setAddMedicineOpen] = useState(false);
  const [newMedicine, setNewMedicine] = useState({ name: '', stock: '', sales: '', price: '' });
  // 新增客户弹窗
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', purchases: '', total: '', lastVisit: '' });

  // 消息通知
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'warning', message: '人参库存低于预警线，请及时补货！', time: '2024-06-01 10:00' },
    { id: 2, type: 'info', message: '订单ORD1005已完成。', time: '2024-06-01 09:30' },
    { id: 3, type: 'error', message: '订单ORD1010支付异常，请人工处理。', time: '2024-06-01 09:00' },
  ]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  // 药材详情弹窗
  const [medicineDetailOpen, setMedicineDetailOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  // 客户详情弹窗
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // 订单详情弹窗
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // AI预测弹窗
  const [aiPredictOpen, setAiPredictOpen] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  
  // 处方详情弹窗
  const [prescriptionDetailOpen, setPrescriptionDetailOpen] = useState(false);
  const [prescriptionAnalysisOpen, setPrescriptionAnalysisOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // 区块链安全弹窗
  const [blockchainOpen, setBlockchainOpen] = useState(false);
  // AI订单预测弹窗
  const [aiOrderPredictOpen, setAiOrderPredictOpen] = useState(false);
  const [aiOrderForecast, setAiOrderForecast] = useState([]);

  // 添加盈利能力分析相关状态
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [profitabilityTab, setProfitabilityTab] = useState(0);
  const [optimizationDialogOpen, setOptimizationDialogOpen] = useState(false);
  const [selectedOptimization, setSelectedOptimization] = useState(null);
  const [aiProfitSimulationOpen, setAiProfitSimulationOpen] = useState(false);
  const [profitSimulationResults, setProfitSimulationResults] = useState(null);

  // 部门详情对话框
  const [departmentDetailOpen, setDepartmentDetailOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  // 员工详情随机数据
  const generateEmployeeData = (dept) => {
    if (!dept) return [];
    return Array.from({ length: dept.staff }, (_, i) => ({
      id: `EMP${1000 + i}`,
      name: `${['张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴'][i % 10]}${['明', '华', '芳', '军', '强', '英', '伟', '娜', '秀英', '建国'][Math.floor(i / 10)]}`,
      position: i === 0 ? '部门主管' : ['高级员工', '中级员工', '初级员工'][i % 3],
      age: 25 + Math.floor(Math.random() * 20),
      joinDate: `2020-${(i % 12) + 1}-${(i % 28) + 1}`,
      performance: 70 + Math.floor(Math.random() * 30),
      salary: 8000 + Math.floor(Math.random() * 12000)
    }));
  };

  // AI智能分配逻辑
  const handleAIAssign = () => {
    // 优先分配库存给高销量/高预测药材
    const sorted = [...aiResults].sort((a, b) => b.predict - a.predict);
    let totalStock = inventoryData.topProducts.reduce((sum, p) => sum + p.stock, 0);
    const assigned = sorted.map(r => {
      const assign = Math.min(r.suggestStock, totalStock);
      totalStock -= assign;
      return { ...r, assignedStock: assign };
    });
    setAiResults(assigned);
    showSnackbar('AI已智能分配库存！');
  };

  // 添加盈利能力分析相关处理函数
  const handleProfitabilityTabChange = (event, newValue) => {
    setProfitabilityTab(newValue);
  };

  // AI预测逻辑
  const handleAIPredict = () => {
    // 假设每个药材有monthly销量数据
    const results = (inventoryData.topProducts || []).map(prod => {
      // 随机生成近6个月销量
      const monthly = prod.monthly || Array.from({ length: 6 }, () => Math.floor(Math.random() * 300) + 20);
      const avg = monthly.reduce((a, b) => a + b, 0) / monthly.length;
      const fluct = Math.max(...monthly) - Math.min(...monthly);
      const predict = Math.round(avg + fluct * 0.2);
      const suggestStock = Math.round(predict * 1.2);
      return {
        name: prod.name,
        last6: monthly,
        predict,
        suggestStock,
        current: prod.stock
      };
    });
    setAiResults(results);
    setAiPredictOpen(true);
  };

  // 一键应用建议库存
  const handleApplySuggestStock = () => {
    setInventoryData(prev => ({
      ...prev,
      topProducts: prev.topProducts.map(prod => {
        const ai = aiResults.find(r => r.name === prod.name);
        return ai ? { ...prod, stock: ai.suggestStock } : prod;
      })
    }));
    setAiPredictOpen(false);
    showSnackbar('已应用AI建议库存！');
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };

  // 处理标签页切换
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 显示消息通知
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // 处理筛选对话框
  const handleFilterDialogOpen = () => {
    setFilterDialogOpen(true);
  };

  const handleFilterDialogClose = () => {
    setFilterDialogOpen(false);
  };

  // 处理设置对话框
  const handleSettingsDialogOpen = () => {
    setSettingsDialogOpen(true);
  };

  const handleSettingsDialogClose = () => {
    setSettingsDialogOpen(false);
  };

  // 处理AI订单预测
  const handleAIOrderPredict = () => {
    // 生成AI订单预测结果
    setAiOrderForecast([
      { month: '本月', orders: 450, revenue: 125000 },
      { month: '下月', orders: 480, revenue: 135000 },
      { month: '两月后', orders: 520, revenue: 148000 },
    ]);
    setAiOrderPredictOpen(true);
  };

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 使用模拟数据
        setSalesData(mockData.salesData);
        setInventoryData(mockData.inventoryData);
        setCustomersData(mockData.customerData);
        setOrdersData(mockData.ordersData);
        setOrganizationData(mockOrganizationData);
        setDistributionData(mockData.distributionData);
        setComplianceData(mockData.complianceData);
        setProfitabilityData(mockData.profitabilityData); // 加载盈利能力数据

        // 模拟加载延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        setError('数据加载失败，请稍后重试');
        console.error('Dashboard data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timeRange]);

  // 渲染仪表盘
    return (
    <Box p={3}>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
          <Typography variant="h6" ml={2}>数据加载中...</Typography>
      </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          {/* 标题栏 */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4">管理仪表盘</Typography>
            <Box>
              <FormControl sx={{ minWidth: 120, mr: 1 }}>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              size="small"
            >
              <MenuItem value="1个月">最近1个月</MenuItem>
              <MenuItem value="3个月">最近3个月</MenuItem>
              <MenuItem value="6个月">最近6个月</MenuItem>
              <MenuItem value="1年">最近1年</MenuItem>
            </Select>
          </FormControl>
              <IconButton onClick={() => setNotificationOpen(true)}>
                <Badge badgeContent={notifications.length} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              <IconButton onClick={handleFilterDialogOpen}>
                <FilterList />
              </IconButton>
              <IconButton onClick={handleSettingsDialogOpen}>
                <Settings />
              </IconButton>
            </Box>
      </Box>

          {/* 标签页 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="销售分析" icon={<AttachMoney />} iconPosition="start" />
              <Tab label="库存管理" icon={<Inventory />} iconPosition="start" />
              <Tab label="订单管理" icon={<Assignment />} iconPosition="start" />
              <Tab label="客户分析" icon={<People />} iconPosition="start" />
              <Tab label="组织结构" icon={<Business />} iconPosition="start" />
              <Tab label="合规风控" icon={<Security />} iconPosition="start" />
              <Tab label="配送分析" icon={<LocalShipping />} iconPosition="start" />
              <Tab label="盈利能力" icon={<Timeline />} iconPosition="start" />
      </Tabs>
          </Box>

          {/* 销售分析 */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
              {/* 销售统计卡片 */}
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>本月销售额</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    ¥{salesData[salesData.length - 1]?.销售额.toLocaleString()}
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月增长 {((salesData[salesData.length - 1]?.销售额 / salesData[salesData.length - 2]?.销售额 - 1) * 100).toFixed(1)}%
                    </Typography>
              </Box>
            </Paper>
          </Grid>
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>本月成本</Typography>
                  <Typography variant="h4" fontWeight={700} color="#ed6c02">
                    ¥{salesData[salesData.length - 1]?.成本.toLocaleString()}
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="error.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月增长 {((salesData[salesData.length - 1]?.成本 / salesData[salesData.length - 2]?.成本 - 1) * 100).toFixed(1)}%
              </Typography>
                  </Box>
            </Paper>
          </Grid>
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>本月利润</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                ¥{salesData[salesData.length - 1]?.利润.toLocaleString()}
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月增长 {((salesData[salesData.length - 1]?.利润 / salesData[salesData.length - 2]?.利润 - 1) * 100).toFixed(1)}%
              </Typography>
                  </Box>
            </Paper>
          </Grid>
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>销售目标达成率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    {((salesData[salesData.length - 1]?.销售额 / salesData[salesData.length - 1]?.目标) * 100).toFixed(1)}%
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      目标: ¥{salesData[salesData.length - 1]?.目标.toLocaleString()}
              </Typography>
                  </Box>
            </Paper>
          </Grid>

              {/* 销售趋势图 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">销售趋势分析</Typography>
                    <FormControl sx={{ minWidth: 120 }}>
                      <Select
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        size="small"
                      >
                        <MenuItem value="1个月">最近1个月</MenuItem>
                        <MenuItem value="3个月">最近3个月</MenuItem>
                        <MenuItem value="6个月">最近6个月</MenuItem>
                        <MenuItem value="1年">最近1年</MenuItem>
                      </Select>
                    </FormControl>
          </Box>
                  <Box height={400}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip 
                          formatter={(value, name) => [`¥${value.toLocaleString()}`, name]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="销售额" fill="#1976d2" name="销售额" />
                        <Bar yAxisId="left" dataKey="成本" fill="#ed6c02" name="成本" />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="利润"
                          stroke="#2e7d32"
                          strokeWidth={2}
                          name="利润"
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="目标"
                          stroke="#9c27b0"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          name="销售目标"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* 销售环比同比分析 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>销售环比同比分析</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                      <Box height={300}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[
                            // 今年数据
                            ...salesData.map(item => ({
                              月份: item.name,
                              今年销售额: item.销售额,
                              去年销售额: Math.round(item.销售额 * 0.85), // 模拟去年数据
                              前年销售额: Math.round(item.销售额 * 0.7),  // 模拟前年数据
                            }))
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="月份" />
                    <YAxis />
                            <RechartsTooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                    <Legend />
                            <Line type="monotone" dataKey="今年销售额" stroke="#1976d2" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="去年销售额" stroke="#ed6c02" />
                            <Line type="monotone" dataKey="前年销售额" stroke="#9c27b0" />
                          </LineChart>
                </ResponsiveContainer>
              </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" gutterBottom>同比环比分析</Typography>
                      <List>
                        <ListItem>
                          <ListItemText 
                            primary="月环比增长率" 
                            secondary={`${((salesData[salesData.length - 1]?.销售额 / salesData[salesData.length - 2]?.销售额 - 1) * 100).toFixed(1)}%`} 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="年同比增长率" 
                            secondary="17.6%" 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="销售增长趋势" 
                            secondary="持续增长" 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="AI趋势预测" 
                            secondary="预计Q3增长22.5%" 
                          />
                        </ListItem>
                      </List>
                      <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<AIIcon />}
                        onClick={handleAIPredict}
                        fullWidth
                        sx={{ mt: 2 }}
                      >
                        AI销售预测分析
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* 库存管理 */}
          {activeTab === 1 && (
          <Grid container spacing={3}>
              {/* 库存统计卡片 */}
              <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>总库存量</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {inventoryData?.total || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      库存种类: {inventoryData?.topProducts?.length || 0}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>低库存预警</Typography>
                  <Typography variant="h4" fontWeight={700} color="#f44336">
                    {inventoryData?.lowStock || 0}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="error.main">
                      <Warning fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      需要紧急补货
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>周转率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    4.2
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月提升 0.3
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>库存价值</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    ¥{(inventoryData?.topProducts?.reduce((sum, item) => sum + item.price * item.stock, 0) || 0).toLocaleString()}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      平均单价: ¥{Math.round(
                        (inventoryData?.topProducts?.reduce((sum, item) => sum + item.price, 0) || 0) / 
                        (inventoryData?.topProducts?.length || 1)
                      )}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* 库存分类 */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>库存分类</Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                          data={inventoryData?.categories || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                          {(inventoryData?.categories || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042"][index % 4]} />
                        ))}
                      </Pie>
                        <RechartsTooltip formatter={(value, name) => [`${value} 件`, name]} />
                        <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 库存变化趋势 */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>库存变化趋势</Typography>
                  <Box height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={Array.from({ length: 12 }, (_, i) => ({
                          month: `${i + 1}月`,
                          库存量: 4000 + Math.floor(Math.random() * 1000) - 500 + i * 30,
                          预警线: 3500
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="库存量" stroke="#1976d2" activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="预警线" stroke="#f44336" strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* 库存列表 */}
              <Grid item xs={12}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">库存管理</Typography>
                    <Box>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AIIcon />}
                        onClick={handleAIPredict}
                        sx={{ mr: 1 }}
                      >
                        AI库存预测
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => setAddMedicineOpen(true)}
                        sx={{ mr: 1 }}
                      >
                        新增药材
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Download />}
                      >
                        导出数据
                      </Button>
                    </Box>
                  </Box>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>药材名称</TableCell>
                          <TableCell align="right">库存数量</TableCell>
                          <TableCell align="right">销量</TableCell>
                          <TableCell align="right">单价</TableCell>
                          <TableCell align="right">库存价值</TableCell>
                          <TableCell align="right">状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(inventoryData?.topProducts || []).slice(0, 10).map((product) => (
                          <TableRow key={product.name} hover>
                            <TableCell>{product.name}</TableCell>
                            <TableCell align="right">{product.stock}</TableCell>
                            <TableCell align="right">{product.sales}</TableCell>
                            <TableCell align="right">¥{product.price}</TableCell>
                            <TableCell align="right">¥{(product.stock * product.price).toLocaleString()}</TableCell>
                            <TableCell align="right">
                              {product.stock < 50 ? (
                                <Chip label="低库存" color="error" size="small" />
                              ) : product.stock > 150 ? (
                                <Chip label="充足" color="success" size="small" />
                              ) : (
                                <Chip label="正常" color="primary" size="small" />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => {
                                setSelectedMedicine({...product, original: product});
                                setMedicineDetailOpen(true);
                              }}>
                                <Settings fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
              </Paper>
            </Grid>
            </Grid>
          )}

          {/* 订单管理 */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              {/* 订单统计卡片 */}
              <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>总订单数</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {ordersData?.total || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      增长 15%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>待处理订单</Typography>
                  <Typography variant="h4" fontWeight={700} color="#f44336">
                    {ordersData?.pending || 0}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="error.main">
                      <Warning fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      需要立即处理
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>已完成订单</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    {ordersData?.completed || 0}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <CheckCircle fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      完成率 {ordersData ? Math.round((ordersData.completed / ordersData.total) * 100) : 0}%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>已取消订单</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    {ordersData?.cancelled || 0}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      取消率 {ordersData ? Math.round((ordersData.cancelled / ordersData.total) * 100) : 0}%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* 订单状态分布 */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>订单状态分布</Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: '待处理', value: ordersData?.pending || 0 },
                            { name: '已完成', value: ordersData?.completed || 0 },
                            { name: '已取消', value: ordersData?.cancelled || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#f44336" />
                          <Cell fill="#4caf50" />
                          <Cell fill="#9c27b0" />
                        </Pie>
                        <RechartsTooltip formatter={(value, name) => [`${value} 个订单`, name]} />
                      <Legend />
                      </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 订单趋势 */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>订单趋势</Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={Array.from({ length: 12 }, (_, i) => ({
                          month: `${i + 1}月`,
                          订单数: 80 + Math.floor(Math.random() * 40) + i * 5,
                        }))}
                      >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                        <Line type="monotone" dataKey="订单数" stroke="#1976d2" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 订单列表 */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">最近订单</Typography>
                    <Box>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AIIcon />}
                        onClick={handleAIOrderPredict}
                        sx={{ mr: 1 }}
                      >
                        AI订单预测
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Download />}
                      >
                        导出数据
                      </Button>
                </Box>
                  </Box>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>订单编号</TableCell>
                          <TableCell>客户</TableCell>
                          <TableCell align="right">金额</TableCell>
                          <TableCell align="right">日期</TableCell>
                          <TableCell align="right">状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(ordersData?.recentOrders || []).slice(0, 10).map((order) => (
                          <TableRow key={order.id} hover>
                            <TableCell>{order.id}</TableCell>
                            <TableCell>{order.customer}</TableCell>
                            <TableCell align="right">¥{order.amount.toLocaleString()}</TableCell>
                            <TableCell align="right">{order.date}</TableCell>
                            <TableCell align="right">
                              {order.status === 'pending' ? (
                                <Chip label="待处理" color="warning" size="small" />
                              ) : order.status === 'completed' ? (
                                <Chip label="已完成" color="success" size="small" />
                              ) : order.status === 'cancelled' ? (
                                <Chip label="已取消" color="error" size="small" />
                              ) : (
                                <Chip label="处理中" color="info" size="small" />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => {
                                setSelectedOrder({...order, original: order});
                                setOrderDetailOpen(true);
                              }}>
                                <Settings fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
              </Paper>
            </Grid>
            </Grid>
          )}

          {/* 客户分析 */}
          {activeTab === 3 && (
            <Grid container spacing={3}>
            {/* 客户统计卡片 */}
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>总客户数</Typography>
                <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {customersData?.total || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      增长 8.5%
                    </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>新增客户</Typography>
                  <Typography variant="h4" fontWeight={700} color="#4caf50">
                    {customersData?.new || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      增长 12.3%
                </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>活跃客户</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    {customersData?.active || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      活跃率 {customersData ? Math.round((customersData.active / customersData.total) * 100) : 0}%
                </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>非活跃客户</Typography>
                  <Typography variant="h4" fontWeight={700} color="#f44336">
                    {customersData?.inactive || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="error.main">
                      <TrendingDown fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      非活跃率 {customersData ? Math.round((customersData.inactive / customersData.total) * 100) : 0}%
                </Typography>
                  </Box>
              </Paper>
            </Grid>

              {/* 客户活跃度分析 */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>客户活跃度分析</Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                          data={[
                            { name: '活跃客户', value: customersData?.active || 0 },
                            { name: '非活跃客户', value: customersData?.inactive || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#4caf50" />
                          <Cell fill="#f44336" />
                      </Pie>
                        <RechartsTooltip formatter={(value, name) => [`${value} 人`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 客户增长趋势 */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>客户增长趋势</Typography>
                  <Box height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={customersData?.growth || []}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip formatter={(value, name) => [`${value} 人`, name]} />
                        <Legend />
                        <Area type="monotone" dataKey="新客户" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="老客户" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* AI客户增长预测 */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>AI客户增长预测</Typography>
                  <Box height={280}>
                <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: '下月', 预测客户: Math.round(customersData?.growth?.[customersData.growth.length - 1]?.新客户 * 1.05) || 0 },
                          { name: '2个月后', 预测客户: Math.round(customersData?.growth?.[customersData.growth.length - 1]?.新客户 * 1.08) || 0 },
                          { name: '3个月后', 预测客户: Math.round(customersData?.growth?.[customersData.growth.length - 1]?.新客户 * 1.12) || 0 }
                        ]}
                      >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                        <RechartsTooltip formatter={(value) => [`${value} 人`, '新增客户']} />
                    <Legend />
                        <Bar dataKey="预测客户" fill="#8884d8" />
                      </BarChart>
                </ResponsiveContainer>
              </Box>
                  <Box mt={2} display="flex" justifyContent="center">
                    <Button 
                      variant="contained" 
                      color="primary" 
                      startIcon={<AIIcon />}
                    >
                      AI客户分析
                    </Button>
                  </Box>
                </Paper>
              </Grid>

              {/* 客户价值分析 */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>客户价值分析</Typography>
                  <Box height={280}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="purchases" name="购买次数" />
                        <YAxis type="number" dataKey="total" name="总消费" />
                        <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value) => value} content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div style={{ background: 'white', padding: '5px', border: '1px solid #ccc' }}>
                                <p>{`客户: ${payload[0].payload.name}`}</p>
                                <p>{`购买次数: ${payload[0].value}`}</p>
                                <p>{`总消费: ¥${payload[1].value.toLocaleString()}`}</p>
                                <p>{`最后访问: ${payload[0].payload.lastVisit}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Scatter name="客户价值" data={customersData?.topCustomers?.slice(0, 30) || []} fill="#8884d8" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box mt={2} display="flex" justifyContent="center">
                    <Button 
                      variant="contained" 
                      color="success" 
                      onClick={() => setAddCustomerOpen(true)}
                    >
                      新增客户
                    </Button>
                  </Box>
                </Paper>
              </Grid>

              {/* 高价值客户列表 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">高价值客户</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                    >
                      导出数据
                    </Button>
                  </Box>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>客户名称</TableCell>
                          <TableCell align="right">购买次数</TableCell>
                          <TableCell align="right">总消费</TableCell>
                          <TableCell align="right">最后访问</TableCell>
                          <TableCell align="right">状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(customersData?.topCustomers || [])
                          .sort((a, b) => b.total - a.total)
                          .slice(0, 10)
                          .map((customer) => (
                            <TableRow key={customer.name} hover>
                              <TableCell>{customer.name}</TableCell>
                              <TableCell align="right">{customer.purchases}</TableCell>
                              <TableCell align="right">¥{customer.total.toLocaleString()}</TableCell>
                              <TableCell align="right">{customer.lastVisit}</TableCell>
                              <TableCell align="right">
                                {new Date(customer.lastVisit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? (
                                  <Chip label="活跃" color="success" size="small" />
                                ) : new Date(customer.lastVisit) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? (
                                  <Chip label="一般" color="primary" size="small" />
                                ) : (
                                  <Chip label="不活跃" color="warning" size="small" />
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => {
                                  setSelectedCustomer({...customer, original: customer});
                                  setCustomerDetailOpen(true);
                                }}>
                                  <Settings fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* 组织结构 */}
          {activeTab === 4 && (
          <Grid container spacing={3}>
              {/* 组织结构统计卡片 */}
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>部门数量</Typography>
                <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {organizationData?.departments?.length || 0}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      员工总数: {organizationData?.departments?.reduce((sum, dep) => sum + dep.staff, 0) || 0}
                    </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>总预算</Typography>
                  <Typography variant="h4" fontWeight={700} color="#4caf50">
                    ¥{(organizationData?.departments?.reduce((sum, dep) => sum + dep.budget, 0) || 0).toLocaleString()}
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上年增长 12%
                </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>人均效率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    92.5%
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上季度提升 3.2%
                </Typography>
                  </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>成本控制指数</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    88.3
                </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      高于行业平均 5.2%
                </Typography>
                  </Box>
              </Paper>
            </Grid>

              {/* 组织架构图 */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>组织架构图</Typography>
                  <Box height={500} sx={{ position: 'relative', overflow: 'auto' }}>
                    <Box sx={{ 
                      position: 'relative', 
                      width: '100%', 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      pt: 2
                    }}>
                      {/* 总经理 */}
                      <Box sx={{
                        width: '200px',
                        p: 2,
                        mb: 4,
                        bgcolor: '#1976d2',
                        color: 'white',
                        borderRadius: 2,
                        textAlign: 'center',
                        position: 'relative',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: '-20px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '2px',
                          height: '20px',
                          bgcolor: '#666'
                        }
                      }}>
                        <Typography variant="subtitle1" fontWeight="bold">{organizationData?.hierarchy?.name}</Typography>
                        <Typography variant="body2">{organizationData?.hierarchy?.title}</Typography>
                      </Box>
                      
                      {/* 分隔线 */}
                      <Box sx={{ width: '80%', height: '2px', bgcolor: '#666', mb: 4 }} />
                      
                      {/* 部门主管 */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-around', 
                        width: '100%',
                        mb: 4,
                        flexWrap: 'wrap',
                        gap: 2
                      }}>
                        {organizationData?.hierarchy?.children?.map((director, idx) => (
                          <Box key={idx} sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}>
                            <Box sx={{
                              width: '180px',
                              p: 1.5,
                              bgcolor: '#4caf50',
                              color: 'white',
                              borderRadius: 2,
                              textAlign: 'center',
                              mb: 4,
                              position: 'relative',
                              '&::after': {
                                content: '""',
                                position: 'absolute',
                                bottom: '-20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '2px',
                                height: '20px',
                                bgcolor: '#666'
                              }
                            }}>
                              <Typography variant="subtitle2" fontWeight="bold">{director.name}</Typography>
                              <Typography variant="body2">{director.title}</Typography>
                            </Box>
                            
                            {/* 经理 */}
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-around', 
                              width: '100%',
                              gap: 2
                            }}>
                              {director.children?.map((manager, midx) => (
                                <Box key={midx} sx={{
                                  width: '150px',
                                  p: 1,
                                  bgcolor: '#ff9800',
                                  color: 'white',
                                  borderRadius: 2,
                                  textAlign: 'center'
                                }}>
                                  <Typography variant="subtitle2" fontWeight="bold">{manager.name}</Typography>
                                  <Typography variant="body2">{manager.title}</Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    
                    {/* 操作按钮 */}
                    <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 1 }}>
                      <Tooltip title="放大">
                        <IconButton size="small">
                          <TrendingUp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="缩小">
                        <IconButton size="small">
                          <TrendingDown fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="下载图表">
                        <IconButton size="small">
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
              </Paper>
            </Grid>

              {/* 部门预算分布 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>部门预算分布</Typography>
                  <Box height={350}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                          data={organizationData?.departments?.map(dep => ({
                            name: dep.name,
                            value: dep.budget
                          })) || []}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {(organizationData?.departments || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"][index % 6]} />
                        ))}
                      </Pie>
                        <RechartsTooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 员工年龄分布 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>员工年龄分布</Typography>
                  <Box height={350}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={organizationData?.staffDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                        <RechartsTooltip formatter={(value, name) => [`${value}人`, '人数']} />
                      <Legend />
                        <Bar dataKey="value" name="人数" fill="#8884d8">
                          {(organizationData?.staffDistribution || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042"][index % 4]} />
                          ))}
                        </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 部门绩效分析 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>部门绩效分析</Typography>
                  <Box height={350}>
                  <ResponsiveContainer width="100%" height="100%">
                      <RadarChart outerRadius={120} data={organizationData?.performance || []}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="完成率" dataKey="完成率" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <Radar name="质量" dataKey="质量" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                        <Radar name="效率" dataKey="效率" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                      <Legend />
                        <RechartsTooltip />
                      </RadarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

              {/* 员工增长趋势 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>员工变动趋势</Typography>
                  <Box height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={organizationData?.employeeTrends || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="入职" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="离职" stackId="a" fill="#ff8042" />
                        <Line type="monotone" dataKey="净增长" stroke="#8884d8" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* AI组织效率优化 */}
          <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">AI组织效率优化建议</Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AIIcon />}
                    >
                      生成更多建议
                    </Button>
              </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom>
                            采购部成本控制建议
                          </Typography>
                          <Typography variant="body2" paragraph>
                            基于历史采购数据分析，建议采用季度批量采购模式，可降低单位采购成本约8.5%。
                          </Typography>
                          <Typography variant="body2" paragraph>
                            推荐与主要供应商建立长期战略合作关系，锁定关键药材价格，规避市场波动风险。
                          </Typography>
                          <Typography variant="body2">
                            预计年度成本节省：¥324,000
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', backgroundColor: 'rgba(76, 175, 80, 0.05)' }}>
                        <CardContent>
                          <Typography variant="h6" color="success" gutterBottom>
                            销售部效率提升建议
                          </Typography>
                          <Typography variant="body2" paragraph>
                            销售人员时间分配分析显示，简化内部报表流程可节省每位销售15%工作时间。
                          </Typography>
                          <Typography variant="body2" paragraph>
                            建议实施客户分级管理，将80%资源集中于贡献最高的20%客户，提升整体转化率。
                          </Typography>
                          <Typography variant="body2">
                            预计年度收入增长：¥562,000
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', backgroundColor: 'rgba(156, 39, 176, 0.05)' }}>
                        <CardContent>
                          <Typography variant="h6" color="secondary" gutterBottom>
                            仓储部优化建议
                          </Typography>
                          <Typography variant="body2" paragraph>
                            库存布局优化模拟显示，按照取用频率重新规划货架布局可减少28%的取货时间。
                          </Typography>
                          <Typography variant="body2" paragraph>
                            实施智能库存预警系统，可减少断货情况发生率85%，提高客户满意度。
                          </Typography>
                          <Typography variant="body2">
                            预计年度效率提升：32%
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
            </Paper>
          </Grid>

              {/* 部门详情表格 */}
          <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">部门详情</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                    >
                      导出数据
                    </Button>
                  </Box>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>部门名称</TableCell>
                          <TableCell align="right">员工数量</TableCell>
                          <TableCell align="right">年度预算</TableCell>
                          <TableCell align="right">绩效评分</TableCell>
                          <TableCell align="right">人均产值</TableCell>
                          <TableCell align="right">状态</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(organizationData?.departments || []).map((dept, index) => {
                          const perf = organizationData?.performance?.[index];
                          const avgPerf = perf ? Math.round((perf.完成率 + perf.质量 + perf.效率) / 3) : 0;
                          const productionPerEmployee = Math.round(dept.budget / dept.staff);
                          
                          return (
                            <TableRow key={dept.name} hover>
                              <TableCell>{dept.name}</TableCell>
                              <TableCell align="right">{dept.staff}</TableCell>
                              <TableCell align="right">¥{dept.budget.toLocaleString()}</TableCell>
                              <TableCell align="right">{avgPerf}</TableCell>
                              <TableCell align="right">¥{productionPerEmployee.toLocaleString()}</TableCell>
                              <TableCell align="right">
                                {avgPerf >= 90 ? (
                                  <Chip label="优秀" color="success" size="small" />
                                ) : avgPerf >= 80 ? (
                                  <Chip label="良好" color="primary" size="small" />
                                ) : (
                                  <Chip label="待提升" color="warning" size="small" />
                                )}
                                <IconButton 
                                  size="small" 
                                  sx={{ ml: 1 }}
                                  onClick={() => {
                                    setSelectedDepartment(dept);
                                    setDepartmentDetailOpen(true);
                                  }}
                                >
                                  <Settings fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

          {/* 合规风控 */}
          {activeTab === 5 && (
        <Grid container spacing={3}>
              {/* 合规风控统计卡片 */}
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>合规评分</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {complianceData?.score || 96.5}
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上季度提升 2.5%
                    </Typography>
                  </Box>
            </Paper>
          </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>未解决风险</Typography>
                  <Typography variant="h4" fontWeight={700} color="#f44336">
                    {complianceData?.openIssues || 3}
              </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="error.main">
                      <Warning fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      需要立即解决
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>解决的风险</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    {complianceData?.resolvedIssues || 28}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <CheckCircle fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      本月解决 {complianceData?.resolvedThisMonth || 5} 项
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>审计完成率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    {complianceData?.auditCompletion || 100}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <CheckCircle fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      所有审计项目已完成
                    </Typography>
                  </Box>
            </Paper>
          </Grid>

              {/* 区块链安全认证 */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>区块链安全认证</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <Security sx={{ fontSize: 80, color: '#2e7d32', mb: 2 }} />
                    <Typography variant="h5" color="success.main" gutterBottom>
                      数据安全区块链认证
              </Typography>
                    <Typography align="center" paragraph>
                      {blockchainDesc}
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="primary"
                      startIcon={<Info />}
                      onClick={() => setBlockchainOpen(true)}
                    >
                      查看详情
                    </Button>
                  </Box>
            </Paper>
          </Grid>

              {/* 合规检查趋势 */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>合规检查趋势</Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={Array.from({ length: 12 }, (_, i) => ({
                          month: `${i + 1}月`,
                          合规评分: 85 + Math.min(i, 10) + Math.floor(Math.random() * 5),
                          行业平均: 82 + Math.min(i * 0.5, 5) + Math.floor(Math.random() * 3),
                        }))}
                      >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                        <YAxis domain={[80, 100]} />
                    <RechartsTooltip />
                    <Legend />
                        <Line type="monotone" dataKey="合规评分" stroke="#1976d2" activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="行业平均" stroke="#f44336" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>

              {/* 风险警告 */}
              <Grid item xs={12}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">风险警告</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                    >
                      导出报告
                    </Button>
              </Box>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>风险项目</TableCell>
                          <TableCell>类型</TableCell>
                          <TableCell>严重程度</TableCell>
                          <TableCell>发现日期</TableCell>
                          <TableCell>状态</TableCell>
                          <TableCell>负责人</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { id: 1, name: '某批次药材检测报告缺失', type: '文档合规', severity: '高', date: '2024-06-02', status: 'open', owner: '张医师' },
                          { id: 2, name: '中药材保存温度超标', type: '存储合规', severity: '高', date: '2024-06-05', status: 'open', owner: '王仓管' },
                          { id: 3, name: '处方记录不完整', type: '处方合规', severity: '中', date: '2024-06-08', status: 'open', owner: '李药师' },
                          { id: 4, name: '供应商资质过期', type: '供应链合规', severity: '低', date: '2024-05-28', status: 'resolved', owner: '赵经理' },
                          { id: 5, name: '处方审核流程未遵循', type: '流程合规', severity: '中', date: '2024-05-25', status: 'resolved', owner: '李药师' },
                        ].map((risk) => (
                          <TableRow key={risk.id} hover>
                            <TableCell>{risk.name}</TableCell>
                            <TableCell>{risk.type}</TableCell>
                            <TableCell>
                              {risk.severity === '高' ? (
                                <Chip label="高" color="error" size="small" />
                              ) : risk.severity === '中' ? (
                                <Chip label="中" color="warning" size="small" />
                              ) : (
                                <Chip label="低" color="info" size="small" />
                              )}
                            </TableCell>
                            <TableCell>{risk.date}</TableCell>
                            <TableCell>
                              {risk.status === 'open' ? (
                                <Chip label="未解决" color="error" size="small" />
                              ) : (
                                <Chip label="已解决" color="success" size="small" />
                              )}
                            </TableCell>
                            <TableCell>{risk.owner}</TableCell>
                            <TableCell align="right">
                              <IconButton size="small">
                                <Settings fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
            </Paper>
          </Grid>
            </Grid>
          )}

          {/* 配送分析 */}
          {activeTab === 6 && (
            <Grid container spacing={3}>
              {/* 配送统计卡片 */}
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>配送完成率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {distributionData?.completionRate || 98.5}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月提升 1.2%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>平均配送时间</Typography>
                  <Typography variant="h4" fontWeight={700} color="#4caf50">
                    {distributionData?.avgDeliveryTime || 28}分钟
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingDown fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上月降低 5分钟
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>当前配送中</Typography>
                  <Typography variant="h4" fontWeight={700} color="#f44336">
                    {distributionData?.currentDeliveries || 12}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      <Info fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      全部正常进行中
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>客户满意度</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    {distributionData?.satisfactionRate || 96}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <Star fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      5星评价率 {distributionData?.fiveStarRate || 85}%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* 配送区域热力图 */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>配送区域热力图</Typography>
                  <Box height={400} sx={{ position: 'relative' }}>
                    <img 
                      src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*_GFNQoH78LwAAAAAAAAAAAAADmJ7AQ/original" 
                      alt="配送热力图"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <Box 
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Typography variant="h5" color="white" fontWeight="bold">
                        热力图加载中...（示例图片）
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* 配送绩效 */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>配送绩效</Typography>
                  <Box height={400}>
                <ResponsiveContainer width="100%" height="100%">
                      <RadarChart outerRadius={120} data={[
                        { name: '准时率', 值: 95 },
                        { name: '完整率', 值: 98 },
                        { name: '服务态度', 值: 92 },
                        { name: '包装完好', 值: 96 },
                        { name: '药品质量', 值: 99 },
                      ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="配送绩效" dataKey="值" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Legend />
                        <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>

              {/* 配送路线优化 */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">AI路线优化建议</Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AIIcon />}
                    >
                      重新生成路线
                </Button>
              </Box>
              <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" color="primary" gutterBottom>
                            当前配送路线
                        </Typography>
                          <Box height={250} sx={{ position: 'relative' }}>
                            <img 
                              src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*I34kT5kEyU8AAAAAAAAAAAAADmJ7AQ/fmt.webp" 
                              alt="当前配送路线"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ mt: 2 }}>
                            配送效率: 72%
                        </Typography>
                        <Typography variant="body2">
                            平均配送时间: 35分钟
                        </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="h6" color="success" gutterBottom>
                            AI优化路线
                          </Typography>
                          <Box height={250} sx={{ position: 'relative' }}>
                            <img 
                              src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*I34kT5kEyU8AAAAAAAAAAAAADmJ7AQ/fmt.webp" 
                              alt="AI优化路线"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                            />
                          </Box>
                          <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
                            优化后效率: 94% (+22%)
                          </Typography>
                          <Typography variant="body2" color="success.main">
                            优化后平均配送时间: 23分钟 (-34%)
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
              </Grid>
            </Paper>
          </Grid>
            </Grid>
          )}

          {/* 盈利能力 */}
          {activeTab === 7 && (
            <Grid container spacing={3}>
              {/* 盈利能力统计卡片 */}
              <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>毛利率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#1976d2">
                    {profitabilityData?.grossMargin || 42.5}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上年增长 2.3%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>净利率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#4caf50">
                    {profitabilityData?.netMargin || 28.2}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上年增长 1.8%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>资产回报率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#9c27b0">
                    {profitabilityData?.roa || 22.6}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      高于行业平均 5.4%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography color="textSecondary" gutterBottom>投资回报率</Typography>
                  <Typography variant="h4" fontWeight={700} color="#2e7d32">
                    {profitabilityData?.roi || 36.8}%
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                      较上年增长 3.2%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* 盈利能力标签页 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={profitabilityTab} onChange={handleProfitabilityTabChange}>
                      <Tab label="药材盈利分析" />
                      <Tab label="客户贡献分析" />
                      <Tab label="成本结构分析" />
                      <Tab label="AI盈利优化" />
                    </Tabs>
                  </Box>
                  
                  {/* 药材盈利分析 */}
                  {profitabilityTab === 0 && (
                    <Box p={2}>
                      <Box height={400}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={(inventoryData?.topProducts || [])
                              .slice(0, 10)
                              .map(p => ({
                                name: p.name,
                                销售额: p.sales * p.price,
                                成本: p.sales * p.price * 0.55,
                                利润: p.sales * p.price * 0.45,
                                利润率: 45,
                              }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" orientation="left" />
                            <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip />
                <Legend />
                            <Bar yAxisId="left" dataKey="销售额" fill="#1976d2" />
                            <Bar yAxisId="left" dataKey="成本" fill="#f44336" />
                            <Bar yAxisId="left" dataKey="利润" fill="#4caf50" />
                            <Line yAxisId="right" type="monotone" dataKey="利润率" stroke="#ff9800" />
              </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  )}
                  
                  {/* 客户贡献分析 */}
                  {profitabilityTab === 1 && (
                    <Box p={2}>
                      <Box height={400}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={(customersData?.topCustomers || [])
                              .slice(0, 10)
                              .map(c => ({
                                name: c.name,
                                贡献收入: c.total,
                                贡献利润: c.total * 0.42,
                                客户价值: c.total / c.purchases,
                              }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="贡献收入" fill="#1976d2" />
                            <Bar yAxisId="left" dataKey="贡献利润" fill="#4caf50" />
                            <Line yAxisId="right" type="monotone" dataKey="客户价值" stroke="#ff9800" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  )}
                  
                  {/* 成本结构分析 */}
                  {profitabilityTab === 2 && (
                    <Box p={2}>
                      <Box height={400}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: '原材料成本', value: 45 },
                                { name: '人工成本', value: 25 },
                                { name: '运营成本', value: 15 },
                                { name: '营销成本', value: 10 },
                                { name: '其他成本', value: 5 },
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={150}
                              fill="#8884d8"
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              <Cell fill="#1976d2" />
                              <Cell fill="#f44336" />
                              <Cell fill="#4caf50" />
                              <Cell fill="#ff9800" />
                              <Cell fill="#9c27b0" />
                            </Pie>
                            <RechartsTooltip formatter={(value) => `${value}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  )}
                  
                  {/* AI盈利优化 */}
                  {profitabilityTab === 3 && (
                    <Box p={2}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                          <Card sx={{ height: '100%', backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
                            <CardContent>
                              <Typography variant="h6" color="primary" gutterBottom>
                                定价优化
                              </Typography>
                              <Typography variant="body2" paragraph>
                                AI分析显示，当前10种主要药材定价偏低，建议提高5-8%，预计可提升总体毛利率2.3%。
                              </Typography>
                              <Typography variant="body2" paragraph>
                                人参、灵芝等高端药材可考虑溢价销售，提供品质保证和追溯服务。
                              </Typography>
                              <Button 
                                variant="contained" 
                                color="primary"
                                fullWidth
                                onClick={() => {
                                  setSelectedOptimization({type: '定价优化'});
                                  setOptimizationDialogOpen(true);
                                }}
                              >
                                查看详情
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card sx={{ height: '100%', backgroundColor: 'rgba(76, 175, 80, 0.05)' }}>
                            <CardContent>
                              <Typography variant="h6" color="success" gutterBottom>
                                成本优化
                              </Typography>
                              <Typography variant="body2" paragraph>
                                采购优化可降低3.5%原料成本，主要通过季节性采购和供应商整合实现。
                              </Typography>
                              <Typography variant="body2" paragraph>
                                能源成本可通过改进库存管理系统降低12%，预计年节省¥78,000。
                              </Typography>
                              <Button 
                                variant="contained" 
                                color="success"
                                fullWidth
                                onClick={() => {
                                  setSelectedOptimization({type: '成本优化'});
                                  setOptimizationDialogOpen(true);
                                }}
                              >
                                查看详情
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card sx={{ height: '100%', backgroundColor: 'rgba(156, 39, 176, 0.05)' }}>
                            <CardContent>
                              <Typography variant="h6" color="secondary" gutterBottom>
                                产品组合优化
                              </Typography>
                              <Typography variant="body2" paragraph>
                                根据季节性需求调整产品库存比例，可提高库存周转率18%，降低库存成本。
                              </Typography>
                              <Typography variant="body2" paragraph>
                                增加高毛利保健产品比例，预计可提升整体毛利率3.2%。
                              </Typography>
                              <Button 
                                variant="contained" 
                                color="secondary"
                                fullWidth
                                onClick={() => {
                                  setSelectedOptimization({type: '产品组合优化'});
                                  setOptimizationDialogOpen(true);
                                }}
                              >
                                查看详情
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12}>
                          <Box display="flex" justifyContent="center" mt={2}>
                            <Button 
                              variant="contained" 
                              startIcon={<AIIcon />}
                              onClick={() => setAiProfitSimulationOpen(true)}
                              sx={{ px: 4, py: 1 }}
                            >
                              运行AI盈利模拟
                            </Button>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* 盈利能力趋势 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                  <Typography variant="h6" gutterBottom>盈利能力趋势</Typography>
                  <Box height={400}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={Array.from({ length: 12 }, (_, i) => ({
                          month: `${i + 1}月`,
                          毛利率: 35 + Math.min(i * 0.7, 10) + Math.floor(Math.random() * 3),
                          净利率: 22 + Math.min(i * 0.5, 8) + Math.floor(Math.random() * 2),
                          ROI: 30 + Math.min(i * 0.6, 9) + Math.floor(Math.random() * 3),
                          行业平均毛利率: 32 + Math.min(i * 0.3, 5) + Math.floor(Math.random() * 2),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 60]} />
                        <RechartsTooltip formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="毛利率" stroke="#1976d2" activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="净利率" stroke="#4caf50" />
                        <Line type="monotone" dataKey="ROI" stroke="#9c27b0" />
                        <Line type="monotone" dataKey="行业平均毛利率" stroke="#f44336" strokeDasharray="5 5" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
            </Paper>
          </Grid>
        </Grid>
          )}
        </>
      )}

      {/* 各种对话框... */}

      {/* 消息通知 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* AI库存预测对话框 */}
      <Dialog
        open={aiPredictOpen}
        onClose={() => setAiPredictOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AIIcon sx={{ mr: 1, color: 'primary.main' }} />
            AI智能库存预测
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            基于历史销售数据和季节性波动，AI预测未来30天药材需求量：
          </Typography>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>药材名称</TableCell>
                  <TableCell align="right">当前库存</TableCell>
                  <TableCell align="right">预测销量</TableCell>
                  <TableCell align="right">建议库存</TableCell>
                  <TableCell align="right">状态</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aiResults.slice(0, 10).map((item) => (
                  <TableRow key={item.name} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.current}</TableCell>
                    <TableCell align="right">{item.predict}</TableCell>
                    <TableCell align="right">{item.suggestStock}</TableCell>
                    <TableCell align="right">
                      {item.current < item.suggestStock ? (
                        <Chip label="需补货" color="error" size="small" />
                      ) : (
                        <Chip label="充足" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>AI销售趋势预测</Typography>
            <Box height={250}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={Array.from({ length: 6 }, (_, i) => ({
                    month: `月份${i+1}`,
                    销量: 200 + Math.floor(Math.random() * 100) + i * 20,
                    预测: 220 + Math.floor(Math.random() * 100) + i * 25,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="销量" stroke="#1976d2" name="历史销量" />
                  <Line type="monotone" dataKey="预测" stroke="#f44336" strokeDasharray="5 5" name="AI预测" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAIAssign} color="primary">
            智能分配库存
          </Button>
          <Button onClick={handleApplySuggestStock} color="success" variant="contained">
            一键应用建议库存
          </Button>
          <Button onClick={() => setAiPredictOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI订单预测对话框 */}
      <Dialog
        open={aiOrderPredictOpen}
        onClose={() => setAiOrderPredictOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AIIcon sx={{ mr: 1, color: 'primary.main' }} />
            AI智能订单预测
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            基于历史订单数据、季节性因素和市场趋势，AI预测未来30天订单情况：
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" gutterBottom>预计订单量</Typography>
                <Typography variant="h3" color="primary.main">457</Typography>
                <Typography variant="body2" color="success.main">
                  <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                  较上月增长 12%
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  <strong>高峰期：</strong> 6月15日至6月25日
                </Typography>
                <Typography variant="body2">
                  <strong>预计日均订单：</strong> 15.2单
                </Typography>
              </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" gutterBottom>预计销售额</Typography>
                <Typography variant="h3" color="success.main">¥124,850</Typography>
                <Typography variant="body2" color="success.main">
                  <TrendingUp fontSize="small" sx={{verticalAlign: 'middle', mr: 0.5}} />
                  较上月增长 15%
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  <strong>客单价预测：</strong> ¥273.2
                </Typography>
                <Typography variant="body2">
                  <strong>转化率预测：</strong> 32%
                </Typography>
              </Paper>
                </Grid>
            <Grid item xs={12}>
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={Array.from({ length: 30 }, (_, i) => ({
                      day: `${i + 1}日`,
                      订单数: 10 + Math.floor(Math.random() * 15) + (i > 15 && i < 25 ? 10 : 0),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" interval={4} />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="订单数" stroke="#1976d2" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
              </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>畅销药材预测</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>排名</TableCell>
                      <TableCell>药材名称</TableCell>
                      <TableCell align="right">预测销量</TableCell>
                      <TableCell align="right">预测销售额</TableCell>
                      <TableCell align="right">增长趋势</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productNames.slice(0, 5).map((name, idx) => (
                      <TableRow key={name} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell align="right">{30 + Math.floor(Math.random() * 70)}</TableCell>
                        <TableCell align="right">¥{(1000 + Math.floor(Math.random() * 5000)).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {Math.random() > 0.3 ? (
                            <TrendingUp fontSize="small" color="success" />
                          ) : (
                            <TrendingDown fontSize="small" color="error" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiOrderPredictOpen(false)}>
            关闭
          </Button>
          <Button variant="contained" color="primary">
            导出预测报告
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI盈利模拟对话框 */}
      <Dialog
        open={aiProfitSimulationOpen}
        onClose={() => setAiProfitSimulationOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AIIcon sx={{ mr: 1, color: 'primary.main' }} />
            AI盈利能力模拟
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            AI根据多种盈利优化策略组合进行模拟，预测最优策略组合效果：
              </Typography>
          <Box height={300} sx={{ mt: 3 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: '当前状态', 毛利率: 42.5, 净利率: 28.2, ROI: 36.8 },
                  { name: '策略1: 定价优化', 毛利率: 44.8, 净利率: 29.5, ROI: 38.2 },
                  { name: '策略2: 成本优化', 毛利率: 43.9, 净利率: 30.1, ROI: 39.5 },
                  { name: '策略3: 产品组合优化', 毛利率: 45.7, 净利率: 29.8, ROI: 40.2 },
                  { name: '综合策略优化', 毛利率: 48.2, 净利率: 32.4, ROI: 43.6 },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="毛利率" fill="#1976d2" />
                <Bar dataKey="净利率" fill="#4caf50" />
                <Bar dataKey="ROI" fill="#9c27b0" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="h6" color="primary.main" gutterBottom>
                AI推荐最优策略组合
              </Typography>
              <Typography variant="body1" paragraph>
                综合考虑实施难度、投入成本和预期收益，AI推荐采用综合策略优化方案：
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="调整高毛利药材定价策略，对人参、灵芝等高端产品提供品质溯源增值服务"
                    secondary="预计提升毛利率2.3%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="优化供应链，实施季节性集中采购，与3-5家核心供应商建立战略合作"
                    secondary="预计降低采购成本5.2%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="增加高毛利保健品比例，开发中药衍生产品系列"
                    secondary="预计提高客单价15%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="优化库存结构，加强高周转产品比例"
                    secondary="预计提高资金利用率18%"
                  />
                </ListItem>
              </List>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1" fontWeight="bold">
                  预计年度增加利润：¥482,500
                </Typography>
                <Typography variant="body1" fontWeight="bold" color="success.main">
                  投资回报率：435%
                </Typography>
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiProfitSimulationOpen(false)}>
            关闭
          </Button>
          <Button variant="contained" color="primary" startIcon={<SaveIcon />}>
            保存方案
          </Button>
        </DialogActions>
      </Dialog>

      {/* 区块链安全对话框 */}
      <Dialog
        open={blockchainOpen}
        onClose={() => setBlockchainOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Security sx={{ mr: 1, color: 'success.main' }} />
            区块链安全认证系统
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" paragraph>
            本系统采用区块链技术保证数据安全性、真实性和可追溯性：
              </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" color="primary.main" gutterBottom>
                  药材溯源保障
                </Typography>
                <Typography variant="body2" paragraph>
                  每批次药材从采购到销售的全流程数据上链，确保药材来源可追溯。
                </Typography>
                <Typography variant="body2" paragraph>
                  所有检验报告、质量证书数据加密存储，防篡改、可验证。
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <img 
                    src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*NNs6QY-nlsgAAAAAAAAAAAAADmJ7AQ/original" 
                    alt="区块链药材溯源"
                    style={{ width: '100%', maxHeight: '150px', objectFit: 'contain' }}
                  />
            </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" color="primary.main" gutterBottom>
                  交易安全保障
                </Typography>
                <Typography variant="body2" paragraph>
                  每笔订单交易信息加密上链，确保订单真实性，防止篡改。
                </Typography>
                <Typography variant="body2" paragraph>
                  智能合约自动触发库存变更、付款确认等关键业务流程。
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <img 
                    src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*hZARQK2CbDcAAAAAAAAAAAAADmJ7AQ/original" 
                    alt="区块链交易安全"
                    style={{ width: '100%', maxHeight: '150px', objectFit: 'contain' }}
                  />
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" color="primary.main" gutterBottom>
                  区块链状态概览
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary.main">124,568</Typography>
                      <Typography variant="body2">区块总数</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">100%</Typography>
                      <Typography variant="body2">节点在线率</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary.main">56,782</Typography>
                      <Typography variant="body2">交易总数</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">0.8秒</Typography>
                      <Typography variant="body2">平均确认时间</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockchainOpen(false)}>
            关闭
          </Button>
          <Button variant="contained" color="primary">
            查看区块链浏览器
          </Button>
        </DialogActions>
      </Dialog>

      {/* 药材详情对话框 */}
      <Dialog
        open={medicineDetailOpen}
        onClose={() => setMedicineDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <LocalPharmacy sx={{ mr: 1, color: 'primary.main' }} />
            药材详情
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedMedicine && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="药材名称"
                  value={selectedMedicine.name}
                  onChange={(e) => setSelectedMedicine({...selectedMedicine, name: e.target.value})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="库存数量"
                  type="number"
                  value={selectedMedicine.stock}
                  onChange={(e) => setSelectedMedicine({...selectedMedicine, stock: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="销量"
                  type="number"
                  value={selectedMedicine.sales}
                  onChange={(e) => setSelectedMedicine({...selectedMedicine, sales: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="单价"
                  type="number"
                  value={selectedMedicine.price}
                  onChange={(e) => setSelectedMedicine({...selectedMedicine, price: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    startAdornment: <Box component="span" sx={{ mr: 1 }}>¥</Box>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box mt={2}>
                  <Typography variant="body2" gutterBottom>库存状态</Typography>
                  <Box display="flex" alignItems="center">
                    {selectedMedicine.stock < 50 ? (
                      <Chip label="低库存" color="error" size="small" />
                    ) : selectedMedicine.stock > 150 ? (
                      <Chip label="充足" color="success" size="small" />
                    ) : (
                      <Chip label="正常" color="primary" size="small" />
                    )}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>历史数据</Typography>
                <Box height={200}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={Array.from({ length: 12 }, (_, i) => ({
                        month: `${i + 1}月`,
                        销量: Math.max(5, Math.floor(selectedMedicine.sales * (0.8 + Math.random() * 0.4))),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="销量" stroke="#1976d2" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMedicineDetailOpen(false)}>
            取消
          </Button>
                      <Button 
            variant="contained" 
            color="error"
                        onClick={() => {
              // 这里应有删除药材的逻辑
              setMedicineDetailOpen(false);
              showSnackbar('药材已删除');
            }}
            sx={{ mr: 1 }}
          >
            删除
                      </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              // 这里应有保存药材修改的逻辑
              setInventoryData(prev => ({
                ...prev,
                topProducts: prev.topProducts.map(p => 
                  p.name === selectedMedicine.original.name ? selectedMedicine : p
                )
              }));
              setMedicineDetailOpen(false);
              showSnackbar('药材信息已更新');
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 客户详情对话框 */}
      <Dialog
        open={customerDetailOpen}
        onClose={() => setCustomerDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <People sx={{ mr: 1, color: 'primary.main' }} />
            客户详情
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCustomer && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="客户名称"
                  value={selectedCustomer.name}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, name: e.target.value})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="购买次数"
                  type="number"
                  value={selectedCustomer.purchases}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, purchases: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="总消费"
                  type="number"
                  value={selectedCustomer.total}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, total: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    startAdornment: <Box component="span" sx={{ mr: 1 }}>¥</Box>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="最后访问日期"
                  type="date"
                  value={selectedCustomer.lastVisit}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, lastVisit: e.target.value})}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box mt={1}>
                  <Typography variant="body2" gutterBottom>客户状态</Typography>
                  <Box display="flex" alignItems="center">
                    {new Date(selectedCustomer.lastVisit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? (
                      <Chip label="活跃" color="success" size="small" />
                    ) : new Date(selectedCustomer.lastVisit) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? (
                      <Chip label="一般" color="primary" size="small" />
                    ) : (
                      <Chip label="不活跃" color="warning" size="small" />
                    )}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>消费历史</Typography>
                <Box height={200}>
            <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={Array.from({ length: 12 }, (_, i) => ({
                        month: `${i + 1}月`,
                        消费额: Math.max(100, Math.floor(selectedCustomer.total / 12 * (0.8 + Math.random() * 0.4))),
                      }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                      <Line type="monotone" dataKey="消费额" stroke="#1976d2" />
                    </LineChart>
            </ResponsiveContainer>
          </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDetailOpen(false)}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={() => {
              // 这里应有删除客户的逻辑
              setCustomerDetailOpen(false);
              showSnackbar('客户已删除');
            }}
            sx={{ mr: 1 }}
          >
            删除
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              // 这里应有保存客户修改的逻辑
              setCustomersData(prev => ({
                ...prev,
                topCustomers: prev.topCustomers.map(c => 
                  c.name === selectedCustomer.original.name ? selectedCustomer : c
                )
              }));
              setCustomerDetailOpen(false);
              showSnackbar('客户信息已更新');
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 订单详情对话框 */}
      <Dialog
        open={orderDetailOpen}
        onClose={() => setOrderDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Assignment sx={{ mr: 1, color: 'primary.main' }} />
            订单详情
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="订单编号"
                  value={selectedOrder.id}
                  disabled
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="客户"
                  value={selectedOrder.customer}
                  onChange={(e) => setSelectedOrder({...selectedOrder, customer: e.target.value})}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="金额"
                  type="number"
                  value={selectedOrder.amount}
                  onChange={(e) => setSelectedOrder({...selectedOrder, amount: parseInt(e.target.value) || 0})}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    startAdornment: <Box component="span" sx={{ mr: 1 }}>¥</Box>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="日期"
                  type="date"
                  value={selectedOrder.date}
                  onChange={(e) => setSelectedOrder({...selectedOrder, date: e.target.value})}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>订单状态</InputLabel>
                  <Select
                    value={selectedOrder.status}
                    onChange={(e) => setSelectedOrder({...selectedOrder, status: e.target.value})}
                    label="订单状态"
                  >
                    <MenuItem value="pending">待处理</MenuItem>
                    <MenuItem value="processing">处理中</MenuItem>
                    <MenuItem value="completed">已完成</MenuItem>
                    <MenuItem value="cancelled">已取消</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>订单明细</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>药材名称</TableCell>
                        <TableCell align="right">数量</TableCell>
                        <TableCell align="right">单价</TableCell>
                        <TableCell align="right">小计</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.from({ length: 3 }, (_, i) => ({
                        name: productNames[Math.floor(Math.random() * productNames.length)],
                        quantity: Math.floor(Math.random() * 5) + 1,
                        price: Math.floor(Math.random() * 200) + 50,
                      })).map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{item.name}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">¥{item.price}</TableCell>
                          <TableCell align="right">¥{item.quantity * item.price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDetailOpen(false)}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={() => {
              // 这里应有删除订单的逻辑
              setOrderDetailOpen(false);
              showSnackbar('订单已删除');
            }}
            sx={{ mr: 1 }}
          >
            删除
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              // 这里应有保存订单修改的逻辑
              setOrdersData(prev => ({
                ...prev,
                recentOrders: prev.recentOrders.map(o => 
                  o.id === selectedOrder.original.id ? selectedOrder : o
                )
              }));
              setOrderDetailOpen(false);
              showSnackbar('订单信息已更新');
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 筛选对话框 */}
      <Dialog
        open={filterDialogOpen}
        onClose={handleFilterDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <FilterList sx={{ mr: 1, color: 'primary.main' }} />
            数据筛选
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>时间范围</Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>选择时间范围</InputLabel>
                <Select
                  value={timeRange}
                  onChange={handleTimeRangeChange}
                  label="选择时间范围"
                >
                  <MenuItem value="1个月">最近1个月</MenuItem>
                  <MenuItem value="3个月">最近3个月</MenuItem>
                  <MenuItem value="6个月">最近6个月</MenuItem>
                  <MenuItem value="1年">最近1年</MenuItem>
                  <MenuItem value="custom">自定义...</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {timeRange === 'custom' && (
              <>
                <Grid item xs={12} sm={6}>
            <TextField
                    label="开始日期"
                    type="date"
                    fullWidth
                    margin="normal"
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="结束日期"
                    type="date"
                    fullWidth
                    margin="normal"
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom>数据筛选</Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>药材分类</InputLabel>
                <Select
                  multiple
                  value={[]}
                  label="药材分类"
                  renderValue={(selected) => selected.join(', ')}
                >
                  {(inventoryData?.categories || []).map((category) => (
                    <MenuItem key={category.name} value={category.name}>
                      <Checkbox checked={false} />
                      <ListItemText primary={category.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>订单状态</InputLabel>
                <Select
                  multiple
                  value={[]}
                  label="订单状态"
                  renderValue={(selected) => selected.join(', ')}
                >
                  <MenuItem value="pending">
                    <Checkbox checked={false} />
                    <ListItemText primary="待处理" />
                  </MenuItem>
                  <MenuItem value="completed">
                    <Checkbox checked={false} />
                    <ListItemText primary="已完成" />
                  </MenuItem>
                  <MenuItem value="cancelled">
                    <Checkbox checked={false} />
                    <ListItemText primary="已取消" />
                  </MenuItem>
                  <MenuItem value="processing">
                    <Checkbox checked={false} />
                    <ListItemText primary="处理中" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>价格范围</Typography>
                <Slider
                  value={[0, 1000]}
                  min={0}
                  max={1000}
                  step={10}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `¥${value}`}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFilterDialogClose}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              handleFilterDialogClose();
              showSnackbar('筛选条件已应用');
            }}
          >
            应用筛选
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 设置对话框 */}
      <Dialog
        open={settingsDialogOpen}
        onClose={handleSettingsDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Settings sx={{ mr: 1, color: 'primary.main' }} />
            仪表盘设置
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>显示设置</Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch 
                  checked={chartSettings.salesChart.showSales}
                  onChange={(e) => setChartSettings(prev => ({
                    ...prev,
                    salesChart: {
                      ...prev.salesChart,
                      showSales: e.target.checked
                    }
                  }))}
                />
              }
              label="显示销售额"
            />
            <FormControlLabel
              control={
                <Switch 
                  checked={chartSettings.salesChart.showCost}
                  onChange={(e) => setChartSettings(prev => ({
                    ...prev,
                    salesChart: {
                      ...prev.salesChart,
                      showCost: e.target.checked
                    }
                  }))}
                />
              }
              label="显示成本"
            />
            <FormControlLabel
              control={
                <Switch 
                  checked={chartSettings.salesChart.showProfit}
                  onChange={(e) => setChartSettings(prev => ({
                    ...prev,
                    salesChart: {
                      ...prev.salesChart,
                      showProfit: e.target.checked
                    }
                  }))}
                />
              }
              label="显示利润"
            />
          </FormGroup>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>数据刷新设置</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>自动刷新间隔</InputLabel>
            <Select
              value="5"
              label="自动刷新间隔"
            >
              <MenuItem value="0">不自动刷新</MenuItem>
              <MenuItem value="1">每1分钟</MenuItem>
              <MenuItem value="5">每5分钟</MenuItem>
              <MenuItem value="15">每15分钟</MenuItem>
              <MenuItem value="30">每30分钟</MenuItem>
              <MenuItem value="60">每小时</MenuItem>
            </Select>
          </FormControl>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>数据导出设置</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>默认导出格式</InputLabel>
            <Select
              value="excel"
              label="默认导出格式"
            >
              <MenuItem value="excel">Excel (.xlsx)</MenuItem>
              <MenuItem value="csv">CSV (.csv)</MenuItem>
              <MenuItem value="pdf">PDF (.pdf)</MenuItem>
              <MenuItem value="json">JSON (.json)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsDialogClose}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              handleSettingsDialogClose();
              showSnackbar('设置已保存');
            }}
          >
            保存设置
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 添加药材对话框 */}
      <Dialog
        open={addMedicineOpen}
        onClose={() => setAddMedicineOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <LocalPharmacy sx={{ mr: 1, color: 'primary.main' }} />
            添加新药材
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="药材名称"
                value={newMedicine.name}
                onChange={(e) => setNewMedicine({...newMedicine, name: e.target.value})}
                fullWidth
                margin="normal"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="库存数量"
              type="number"
                value={newMedicine.stock}
                onChange={(e) => setNewMedicine({...newMedicine, stock: e.target.value})}
              fullWidth
              margin="normal"
                required
            />
            </Grid>
            <Grid item xs={12} sm={6}>
            <TextField
                label="销量"
              type="number"
                value={newMedicine.sales}
                onChange={(e) => setNewMedicine({...newMedicine, sales: e.target.value})}
              fullWidth
              margin="normal"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="单价"
                type="number"
                value={newMedicine.price}
                onChange={(e) => setNewMedicine({...newMedicine, price: e.target.value})}
                fullWidth
                margin="normal"
                required
                InputProps={{
                  startAdornment: <Box component="span" sx={{ mr: 1 }}>¥</Box>,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>药材分类</InputLabel>
                <Select
                  value="中药"
                  label="药材分类"
                >
                  {(inventoryData?.categories || []).map((category) => (
                    <MenuItem key={category.name} value={category.name}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMedicineOpen(false)}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              if (newMedicine.name && newMedicine.stock && newMedicine.price) {
                // 添加新药材到库存
                setInventoryData(prev => ({
                  ...prev,
                  topProducts: [...prev.topProducts, {
                    name: newMedicine.name,
                    stock: parseInt(newMedicine.stock) || 0,
                    sales: parseInt(newMedicine.sales) || 0,
                    price: parseInt(newMedicine.price) || 0,
                  }]
                }));
                // 重置表单
                setNewMedicine({ name: '', stock: '', sales: '', price: '' });
                setAddMedicineOpen(false);
                showSnackbar('新药材已添加');
              } else {
                showSnackbar('请填写所有必填字段');
              }
            }}
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 添加客户对话框 */}
      <Dialog
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <People sx={{ mr: 1, color: 'primary.main' }} />
            添加新客户
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="客户名称"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                fullWidth
                margin="normal"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="购买次数"
                type="number"
                value={newCustomer.purchases}
                onChange={(e) => setNewCustomer({...newCustomer, purchases: e.target.value})}
                fullWidth
                margin="normal"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="总消费"
                type="number"
                value={newCustomer.total}
                onChange={(e) => setNewCustomer({...newCustomer, total: e.target.value})}
                fullWidth
                margin="normal"
                required
                InputProps={{
                  startAdornment: <Box component="span" sx={{ mr: 1 }}>¥</Box>,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="最后访问日期"
                type="date"
                value={newCustomer.lastVisit}
                onChange={(e) => setNewCustomer({...newCustomer, lastVisit: e.target.value})}
                fullWidth
                margin="normal"
                required
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>客户类型</InputLabel>
                <Select
                  value="个人"
                  label="客户类型"
                >
                  <MenuItem value="个人">个人</MenuItem>
                  <MenuItem value="企业">企业</MenuItem>
                  <MenuItem value="医院">医院</MenuItem>
                  <MenuItem value="药店">药店</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCustomerOpen(false)}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              if (newCustomer.name && newCustomer.purchases && newCustomer.total && newCustomer.lastVisit) {
                // 添加新客户
                setCustomersData(prev => ({
                  ...prev,
                  topCustomers: [...prev.topCustomers, {
                    name: newCustomer.name,
                    purchases: parseInt(newCustomer.purchases) || 0,
                    total: parseInt(newCustomer.total) || 0,
                    lastVisit: newCustomer.lastVisit,
                  }]
                }));
                // 重置表单
                setNewCustomer({ name: '', purchases: '', total: '', lastVisit: '' });
                setAddCustomerOpen(false);
                showSnackbar('新客户已添加');
              } else {
                showSnackbar('请填写所有必填字段');
              }
            }}
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 优化建议详情对话框 */}
      <Dialog
        open={optimizationDialogOpen}
        onClose={() => setOptimizationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            {selectedOptimization?.type === '定价优化' && (
              <AttachMoney sx={{ mr: 1, color: 'primary.main' }} />
            )}
            {selectedOptimization?.type === '成本优化' && (
              <TrendingDown sx={{ mr: 1, color: 'success.main' }} />
            )}
            {selectedOptimization?.type === '产品组合优化' && (
              <Assessment sx={{ mr: 1, color: 'secondary.main' }} />
            )}
            {selectedOptimization?.type || '优化建议详情'}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedOptimization?.type === '定价优化' && (
            <>
              <Typography variant="subtitle1" paragraph>
                基于市场需求、竞争定价和成本结构分析，AI建议对以下药材进行定价调整：
            </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>药材名称</TableCell>
                      <TableCell align="right">当前定价</TableCell>
                      <TableCell align="right">建议定价</TableCell>
                      <TableCell align="right">调整幅度</TableCell>
                      <TableCell align="right">预计收益增长</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productNames.slice(0, 8).map((name, idx) => {
                      const currentPrice = 100 + Math.floor(Math.random() * 400);
                      const adjustment = 1 + (Math.random() * 0.08);
                      const suggestedPrice = Math.round(currentPrice * adjustment);
                      return (
                        <TableRow key={name} hover>
                          <TableCell>{name}</TableCell>
                          <TableCell align="right">¥{currentPrice}</TableCell>
                          <TableCell align="right">¥{suggestedPrice}</TableCell>
                          <TableCell align="right">{((adjustment - 1) * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right">¥{Math.round((suggestedPrice - currentPrice) * 30)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>预期效果分析</Typography>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: '当前', 收入: 1000000, 利润: 420000 },
                        { name: '调整后', 收入: 1050000, 利润: 472500 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="收入" fill="#1976d2" />
                      <Bar dataKey="利润" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </>
          )}
          {selectedOptimization?.type === '成本优化' && (
            <>
              <Typography variant="subtitle1" paragraph>
                基于供应链分析和运营效率评估，AI建议通过以下措施优化成本结构：
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="实施季节性批量采购策略" 
                    secondary="针对人参、灵芝等季节性明显的药材，在价格低谷期批量采购，预计可降低原料成本5.2%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="优化供应商结构" 
                    secondary="整合供应商数量从12家减少到8家，与核心供应商建立战略合作关系，预计可降低采购成本3.8%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="改进库存管理系统" 
                    secondary="更新智能库存预警系统，减少库存积压和紧急采购，预计可降低库存成本7.5%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="能源使用优化" 
                    secondary="更新冷藏设备和照明系统，预计可降低能源成本12%，年节省¥78,000"
                  />
                </ListItem>
              </List>
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>成本结构对比</Typography>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '优化后成本', value: 68 },
                          { name: '节省成本', value: 32 },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#4caf50" />
                        <Cell fill="#f44336" />
                      </Pie>
                      <RechartsTooltip formatter={(value) => `${value}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
          </Box>
              </Box>
            </>
          )}
          {selectedOptimization?.type === '产品组合优化' && (
            <>
              <Typography variant="subtitle1" paragraph>
                基于市场趋势和销售数据分析，AI建议优化产品组合结构：
              </Typography>
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>当前vs建议产品组合</Typography>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: '中药材', 当前占比: 65, 建议占比: 55 },
                        { name: '中成药', 当前占比: 20, 建议占比: 20 },
                        { name: '保健品', 当前占比: 10, 建议占比: 18 },
                        { name: '医疗器械', 当前占比: 5, 建议占比: 7 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => `${value}%`} />
                      <Legend />
                      <Bar dataKey="当前占比" fill="#1976d2" />
                      <Bar dataKey="建议占比" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>重点发展产品</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>产品类别</TableCell>
                        <TableCell>推荐原因</TableCell>
                        <TableCell align="right">毛利率</TableCell>
                        <TableCell align="right">市场增长率</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell>高端滋补类保健品</TableCell>
                        <TableCell>高毛利,市场需求稳定增长</TableCell>
                        <TableCell align="right">62%</TableCell>
                        <TableCell align="right">15%</TableCell>
                      </TableRow>
                      <TableRow hover>
                        <TableCell>中药材礼盒装</TableCell>
                        <TableCell>节日销售旺季,提高客单价</TableCell>
                        <TableCell align="right">55%</TableCell>
                        <TableCell align="right">20%</TableCell>
                      </TableRow>
                      <TableRow hover>
                        <TableCell>精品中药饮片</TableCell>
                        <TableCell>精细加工,高附加值</TableCell>
                        <TableCell align="right">58%</TableCell>
                        <TableCell align="right">12%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizationDialogOpen(false)}>
            关闭
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              setOptimizationDialogOpen(false);
              showSnackbar('优化方案已保存');
            }}
          >
            采纳建议
          </Button>
        </DialogActions>
      </Dialog>

      {/* 通知对话框 */}
      <Dialog
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Notifications sx={{ mr: 1, color: 'primary.main' }} />
            系统通知
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <List>
            {notifications.map((notification) => (
              <React.Fragment key={notification.id}>
                <ListItem>
                  <ListItemIcon>
                    {notification.type === 'warning' && <Warning color="warning" />}
                    {notification.type === 'info' && <Info color="info" />}
                    {notification.type === 'error' && <Error color="error" />}
                  </ListItemIcon>
                  <ListItemText 
                    primary={notification.message} 
                    secondary={notification.time} 
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNotifications([]);
            setNotificationOpen(false);
            showSnackbar('所有通知已标记为已读');
          }}>
            全部标记为已读
          </Button>
          <Button onClick={() => setNotificationOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 部门详情对话框 */}
      <Dialog
        open={departmentDetailOpen}
        onClose={() => setDepartmentDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Business sx={{ mr: 1, color: 'primary.main' }} />
            部门详情: {selectedDepartment?.name}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDepartment && (
            <Grid container spacing={2}>
              {/* 部门基本信息 */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>基本信息</Typography>
                <Box component="form" noValidate autoComplete="off">
                  <TextField
                    fullWidth
                    label="部门名称"
                    value={selectedDepartment.name}
                    margin="normal"
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    fullWidth
                    label="员工数量"
                    type="number"
                    value={selectedDepartment.staff}
                    margin="normal"
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    fullWidth
                    label="年度预算"
                    value={`¥${selectedDepartment.budget.toLocaleString()}`}
                    margin="normal"
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    fullWidth
                    label="人均产值"
                    value={`¥${Math.round(selectedDepartment.budget / selectedDepartment.staff).toLocaleString()}`}
                    margin="normal"
                    InputProps={{ readOnly: true }}
                  />
                </Box>
              </Grid>
              
              {/* 部门绩效信息 */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>绩效信息</Typography>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                      outerRadius={90} 
                      data={[
                        { 
                          name: selectedDepartment.name, 
                          完成率: organizationData?.performance?.find(p => p.name === selectedDepartment.name)?.完成率 || 0,
                          质量: organizationData?.performance?.find(p => p.name === selectedDepartment.name)?.质量 || 0,
                          效率: organizationData?.performance?.find(p => p.name === selectedDepartment.name)?.效率 || 0
                        }
                      ]}
                    >
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="完成率" dataKey="完成率" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Radar name="质量" dataKey="质量" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                      <Radar name="效率" dataKey="效率" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                      <Legend />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              {/* 员工列表 */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>员工列表</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>工号</TableCell>
                        <TableCell>姓名</TableCell>
                        <TableCell>职位</TableCell>
                        <TableCell align="right">年龄</TableCell>
                        <TableCell align="right">入职日期</TableCell>
                        <TableCell align="right">绩效评分</TableCell>
                        <TableCell align="right">薪资</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {generateEmployeeData(selectedDepartment).map((employee) => (
                        <TableRow key={employee.id} hover>
                          <TableCell>{employee.id}</TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>{employee.position}</TableCell>
                          <TableCell align="right">{employee.age}</TableCell>
                          <TableCell align="right">{employee.joinDate}</TableCell>
                          <TableCell align="right">
                            <Box display="flex" alignItems="center">
                              <Box width="60%" mr={1}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={employee.performance} 
                                  color={
                                    employee.performance >= 90 ? "success" : 
                                    employee.performance >= 70 ? "primary" : 
                                    "warning"
                                  }
                                  sx={{ height: 10, borderRadius: 5 }}
                                />
                              </Box>
                              <Typography variant="body2">{employee.performance}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">¥{employee.salary.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              
              {/* 部门建议 */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>AI优化建议</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <AlertTitle>人力资源优化</AlertTitle>
                  通过分析该部门的工作内容和绩效数据，AI建议进行以下调整：
                  {selectedDepartment.staff > 8 ? (
                    '人员配置合理，建议对低绩效员工进行针对性培训，提升整体效率。'
                  ) : (
                    '部门人员偏少，工作量较大，建议增加2-3名专业人员，提高团队产能。'
                  )}
        </Alert>
                <Alert severity="success">
                  <AlertTitle>预算分配优化</AlertTitle>
                  通过对部门预算使用情况分析，建议：
                  {selectedDepartment.budget > 1000000 ? (
                    '合理控制非必要开支，建议将预算的15%投入到人员培训和技术更新中，提升长期收益。'
                  ) : (
                    '预算偏紧张，建议下季度增加10-15%的资金支持，以满足业务发展需要。'
                  )}
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentDetailOpen(false)}>
            关闭
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              setDepartmentDetailOpen(false);
              showSnackbar('部门信息已更新');
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard; 