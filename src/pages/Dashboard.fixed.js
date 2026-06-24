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

// 扩展模拟数据
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

  // 其他数据部分省略...
};

// 区块链安全说明内容
const blockchainDesc = `本系统已集成区块链技术，所有药品库存、订单、客户等关键数据均加密上链，防篡改、可追溯，保障数据安全与合规。每次药品出入库、订单处理、客户变更等操作均生成区块链记录，确保数据真实可信。`;

// 其他函数和组件实现省略...

function Dashboard() {
  // 组件状态和逻辑省略...
  
  return (
    <Box p={3}>
      {/* 组件渲染代码省略 */}
      <div>Dashboard组件内容</div>
    </Box>
  );
}

export default Dashboard; 