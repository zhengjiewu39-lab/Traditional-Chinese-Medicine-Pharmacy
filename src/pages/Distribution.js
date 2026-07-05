import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  Rating,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  TrendingUp as TrendingUpIcon,
  Map as MapIcon,
  People as PeopleIcon,
  LocalShipping as ShippingIcon,
  Assessment as AssessmentIcon,
  StarBorder as StarBorderIcon,
  Star as StarIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import ProvinceCoverageView from '../components/ProvinceCoverageView';
import NetworkStructureChart from '../components/NetworkStructureChart';

// 扩展分销商数据
const initialDistributors = [
  {
    id: 'DIST001',
    name: '九州通医药集团',
    region: '华中地区',
    address: '湖北省武汉市汉阳区',
    contact: '张经理',
    phone: '027-12345678',
    email: 'zhang@jiuzhoutong.com',
    status: 'active',
    salesTarget: 5000000,
    currentSales: 4500000,
    joinDate: '2022-08-15',
    coverage: '湖北省、湖南省、河南省',
    performance: 90,
    type: '一级分销商',
  },
  {
    id: 'DIST002',
    name: '国药控股股份有限公司',
    region: '华东地区',
    address: '上海市浦东新区',
    contact: '李总',
    phone: '021-87654321',
    email: 'li@sinopharm.com',
    status: 'active',
    salesTarget: 8000000,
    currentSales: 7200000,
    joinDate: '2021-05-20',
    coverage: '上海市、江苏省、浙江省',
    performance: 92,
    type: '战略合作伙伴',
  },
  {
    id: 'DIST003',
    name: '华润医药商业集团',
    region: '华南地区',
    address: '广东省深圳市南山区',
    contact: '王总监',
    phone: '0755-11223344',
    email: 'wang@crpharm.com',
    status: 'active',
    salesTarget: 6000000,
    currentSales: 5800000,
    joinDate: '2022-01-10',
    coverage: '广东省、广西省、福建省',
    performance: 95,
    type: '一级分销商',
  },
  {
    id: 'DIST004',
    name: '瑞康医药集团',
    region: '山东区域',
    address: '山东省济南市历下区',
    contact: '孙经理',
    phone: '0531-55667788',
    email: 'sun@realcan.com.cn',
    status: 'inactive',
    salesTarget: 3000000,
    currentSales: 1500000,
    joinDate: '2023-03-01',
    coverage: '山东省',
    performance: 75,
    type: '二级分销商',
  },
  // 新增分销商数据
  {
    id: 'DIST005',
    name: '上药控股有限公司',
    region: '华东地区',
    address: '上海市静安区',
    contact: '周总监',
    phone: '021-98765432',
    email: 'zhou@spg.com.cn',
    status: 'active',
    salesTarget: 7000000,
    currentSales: 6800000,
    joinDate: '2022-03-15',
    coverage: '上海市、安徽省、江西省',
    performance: 97,
    type: '一级分销商',
  },
  {
    id: 'DIST006',
    name: '北京同仁堂医药有限公司',
    region: '华北地区',
    address: '北京市东城区',
    contact: '刘经理',
    phone: '010-87654321',
    email: 'liu@tongrentang.com',
    status: 'active',
    salesTarget: 6500000,
    currentSales: 5900000,
    joinDate: '2021-08-20',
    coverage: '北京市、河北省、天津市',
    performance: 91,
    type: '战略合作伙伴',
  },
  {
    id: 'DIST007',
    name: '广州医药有限公司',
    region: '华南地区',
    address: '广东省广州市越秀区',
    contact: '陈总',
    phone: '020-12345678',
    email: 'chen@gzpharm.com',
    status: 'active',
    salesTarget: 5500000,
    currentSales: 5300000,
    joinDate: '2022-04-10',
    coverage: '广东省、海南省',
    performance: 96,
    type: '一级分销商',
  },
  {
    id: 'DIST008',
    name: '重庆医药集团',
    region: '西南地区',
    address: '重庆市渝中区',
    contact: '赵总',
    phone: '023-87654321',
    email: 'zhao@cqpharm.com',
    status: 'active',
    salesTarget: 4000000,
    currentSales: 3600000,
    joinDate: '2022-07-15',
    coverage: '重庆市、四川省',
    performance: 90,
    type: '一级分销商',
  },
  {
    id: 'DIST009',
    name: '天津医药集团',
    region: '华北地区',
    address: '天津市和平区',
    contact: '郑经理',
    phone: '022-12345678',
    email: 'zheng@tjpharm.com',
    status: 'active',
    salesTarget: 3500000,
    currentSales: 3200000,
    joinDate: '2023-01-20',
    coverage: '天津市、河北省',
    performance: 91,
    type: '二级分销商',
  },
  {
    id: 'DIST010',
    name: '浙江英特药业',
    region: '华东地区',
    address: '浙江省杭州市西湖区',
    contact: '吴经理',
    phone: '0571-87654321',
    email: 'wu@zjinter.com',
    status: 'active',
    salesTarget: 4500000,
    currentSales: 4300000,
    joinDate: '2022-09-10',
    coverage: '浙江省',
    performance: 95,
    type: '一级分销商',
  },
  {
    id: 'DIST011',
    name: '辽宁成大医药',
    region: '东北地区',
    address: '辽宁省沈阳市沈河区',
    contact: '马总',
    phone: '024-12345678',
    email: 'ma@lncp.com',
    status: 'active',
    salesTarget: 3000000,
    currentSales: 2400000,
    joinDate: '2023-02-15',
    coverage: '辽宁省、吉林省',
    performance: 80,
    type: '二级分销商',
  },
  {
    id: 'DIST012',
    name: '陕西医药控股集团',
    region: '西北地区',
    address: '陕西省西安市雁塔区',
    contact: '钱总',
    phone: '029-87654321',
    email: 'qian@sxpharm.com',
    status: 'inactive',
    salesTarget: 2500000,
    currentSales: 1800000,
    joinDate: '2023-03-05',
    coverage: '陕西省、甘肃省',
    performance: 72,
    type: '二级分销商',
  },
  {
    id: 'DIST013',
    name: '河南九州通医药',
    region: '华中地区',
    address: '河南省郑州市金水区',
    contact: '孟经理',
    phone: '0371-12345678',
    email: 'meng@hnpharm.com',
    status: 'active',
    salesTarget: 3800000,
    currentSales: 3500000,
    joinDate: '2022-11-10',
    coverage: '河南省',
    performance: 92,
    type: '一级分销商',
  },
  {
    id: 'DIST014',
    name: '山西太原医药',
    region: '华北地区',
    address: '山西省太原市小店区',
    contact: '冯总',
    phone: '0351-87654321',
    email: 'feng@sxtymed.com',
    status: 'inactive',
    salesTarget: 2000000,
    currentSales: 1400000,
    joinDate: '2023-04-20',
    coverage: '山西省',
    performance: 70,
    type: '二级分销商',
  },
  {
    id: 'DIST015',
    name: '四川科伦药业',
    region: '西南地区',
    address: '四川省成都市高新区',
    contact: '唐经理',
    phone: '028-12345678',
    email: 'tang@kelun.com',
    status: 'active',
    salesTarget: 5000000,
    currentSales: 4800000,
    joinDate: '2022-02-25',
    coverage: '四川省、云南省',
    performance: 96,
    type: '战略合作伙伴',
  }
];

// 更新销售区域数据以匹配新增的分销商
const salesRegionData = [
  { name: '华东', sales: 18000000, distributors: 7, growthRate: 15.2 },
  { name: '华南', sales: 15000000, distributors: 6, growthRate: 12.8 },
  { name: '华中', sales: 12500000, distributors: 5, growthRate: 10.5 },
  { name: '华北', sales: 12000000, distributors: 6, growthRate: 9.1 },
  { name: '西南', sales: 8500000, distributors: 4, growthRate: 18.5 },
  { name: '西北', sales: 4500000, distributors: 2, growthRate: 8.2 },
  { name: '东北', sales: 5500000, distributors: 3, growthRate: 7.5 },
];

// 绩效指标数据
const performanceMetricsData = [
  { name: '销售达成率', value: 87 },
  { name: '客户满意度', value: 92 },
  { name: '市场覆盖率', value: 78 },
  { name: '库存周转率', value: 85 },
  { name: '新客户开发', value: 72 },
];

// 绩效趋势数据
const performanceTrendData = [
  { month: '1月', performance: 75 },
  { month: '2月', performance: 78 },
  { month: '3月', performance: 82 },
  { month: '4月', performance: 80 },
  { month: '5月', performance: 85 },
  { month: '6月', performance: 83 },
  { month: '7月', performance: 87 },
  { month: '8月', performance: 89 },
  { month: '9月', performance: 86 },
  { month: '10月', performance: 88 },
  { month: '11月', performance: 90 },
  { month: '12月', performance: 92 },
];

// 雷达图数据
const radarData = [
  {
    subject: '销售额',
    A: 85,
    fullMark: 100,
  },
  {
    subject: '新客户',
    A: 72,
    fullMark: 100,
  },
  {
    subject: '回头率',
    A: 90,
    fullMark: 100,
  },
  {
    subject: '交付时间',
    A: 88,
    fullMark: 100,
  },
  {
    subject: '客诉处理',
    A: 93,
    fullMark: 100,
  },
  {
    subject: '成本控制',
    A: 80,
    fullMark: 100,
  },
];

// 饼图颜色
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#83a6ed'];

const DISTRIBUTOR_COLORS = {
  active: '#2563eb',
  inactive: '#94a3b8',
};

const DistributionNetwork = () => {
  const [distributors, setDistributors] = useState(initialDistributors);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState({});
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // 新增状态
  const [openMapDialog, setOpenMapDialog] = useState(false);
  const [openPerformanceDialog, setOpenPerformanceDialog] = useState(false);
  const [performanceTabValue, setPerformanceTabValue] = useState(0);
  const [mapTabValue, setMapTabValue] = useState(0);

  const handleOpenDialog = (distributor = null) => {
    setDialogType(distributor ? 'edit' : 'add');
    setSelectedDistributor(distributor);
    setFormData(distributor ? { ...distributor } : {
      name: '',
      region: '',
      address: '',
      contact: '',
      phone: '',
      email: '',
      status: 'active',
      salesTarget: 0,
      currentSales: 0,
      joinDate: new Date().toISOString().split('T')[0],
      coverage: '',
      performance: 80,
      type: '二级分销商'
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSaveDistributor = () => {
    if (dialogType === 'add') {
      setDistributors([...distributors, { ...formData, id: `DIST${Date.now()}` }]);
    } else {
      setDistributors(distributors.map(d => d.id === selectedDistributor.id ? { ...selectedDistributor, ...formData } : d));
    }
    handleCloseDialog();
  };

  const handleDeleteDistributor = (id) => {
    if(window.confirm('确认删除此分销商吗？')) {
      setDistributors(distributors.filter(d => d.id !== id));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const filteredDistributors = distributors.filter(d => 
    (filterRegion === 'all' || d.region === filterRegion) &&
    (filterStatus === 'all' || d.status === filterStatus)
  );

  const handleMapDialogOpen = () => {
    setOpenMapDialog(true);
  };

  const handleMapDialogClose = () => {
    setOpenMapDialog(false);
  };

  const handlePerformanceDialogOpen = () => {
    setOpenPerformanceDialog(true);
  };

  const handlePerformanceDialogClose = () => {
    setOpenPerformanceDialog(false);
  };

  const handlePerformanceTabChange = (event, newValue) => {
    setPerformanceTabValue(newValue);
  };

  const handleMapTabChange = (event, newValue) => {
    setMapTabValue(newValue);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          分销网络管理
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          添加分销商
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>区域筛选</InputLabel>
              <Select
                value={filterRegion}
                label="区域筛选"
                onChange={(e) => setFilterRegion(e.target.value)}
              >
                <MenuItem value="all">全部区域</MenuItem>
                {[...new Set(initialDistributors.map(d => d.region))].map(region => (
                  <MenuItem key={region} value={region}>{region}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>状态筛选</InputLabel>
              <Select
                value={filterStatus}
                label="状态筛选"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">全部状态</MenuItem>
                <MenuItem value="active">活跃</MenuItem>
                <MenuItem value="inactive">非活跃</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: 'right' }}>
            <Button 
              startIcon={<MapIcon />} 
              sx={{ mr: 1 }} 
              onClick={handleMapDialogOpen}
              variant="outlined"
            >
              查看覆盖详情
            </Button>
            <Button 
              startIcon={<AssessmentIcon />} 
              onClick={handlePerformanceDialogOpen}
              variant="outlined"
            >
              绩效分析报告
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={700}>
          全国省份覆盖
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          按大区展示各省分销覆盖情况，悬停可查看对应分销商
        </Typography>
        <ProvinceCoverageView distributors={filteredDistributors} />
      </Paper>

      <Grid container spacing={3}>
        {/* 销售区域分析 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                销售区域分析
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesRegionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#8884d8" name="销售额(元)" />
                  <Bar dataKey="distributors" fill="#82ca9d" name="分销商数量" />
                  <Bar dataKey="growthRate" fill="#ffc658" name="增长率(%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 分销商列表 */}
        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>分销商名称</TableCell>
                  <TableCell>区域</TableCell>
                  <TableCell>联系人</TableCell>
                  <TableCell>联系电话</TableCell>
                  <TableCell>销售目标</TableCell>
                  <TableCell>当前销售额</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDistributors.map((distributor) => (
                  <TableRow key={distributor.id}>
                    <TableCell>{distributor.name}</TableCell>
                    <TableCell>{distributor.region}</TableCell>
                    <TableCell>{distributor.contact}</TableCell>
                    <TableCell>{distributor.phone}</TableCell>
                    <TableCell>¥{distributor.salesTarget.toLocaleString()}</TableCell>
                    <TableCell>¥{distributor.currentSales.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={distributor.status === 'active' ? '活跃' : '非活跃'}
                        color={distributor.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => handleOpenDialog(distributor)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => handleDeleteDistributor(distributor.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="查看覆盖范围">
                        <IconButton size="small">
                          <LocationIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      {/* 分销地图对话框 */}
      <Dialog
        open={openMapDialog}
        onClose={handleMapDialogClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <MapIcon sx={{ mr: 1 }} />
            <Typography variant="h6">全国分销网络</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={mapTabValue || 0} onChange={handleMapTabChange} sx={{ mb: 2 }}>
            <Tab icon={<MapIcon />} label="省份覆盖" />
            <Tab icon={<AccountTreeIcon />} label="网络结构" />
            <Tab icon={<AssessmentIcon />} label="区域统计" />
          </Tabs>

          {mapTabValue === 0 && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                按大区展示各省分销覆盖，绿色边框表示已有分销商
              </Typography>
              <Box sx={{ mt: 2 }}>
                <ProvinceCoverageView distributors={distributors} />
              </Box>
            </>
          )}

          {/* 分销商关系图 */}
          {mapTabValue === 1 && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                显示各区域分销商规模分布，方块大小代表销售额，颜色深浅代表活跃状态
              </Typography>

              <Box sx={{ mt: 2 }}>
                <NetworkStructureChart distributors={distributors} />
              </Box>
              
              {/* 备用表格视图 - 区域分销商列表 */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" gutterBottom>
                  区域分销商列表
                </Typography>
                <TableContainer component={Paper} sx={{ mt: 1, maxHeight: 300 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>区域</TableCell>
                        <TableCell>分销商名称</TableCell>
                        <TableCell align="right">销售额 (元)</TableCell>
                        <TableCell>状态</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {distributors.sort((a, b) => {
                        // 先按区域排序，再按销售额降序排序
                        if (a.region !== b.region) return a.region.localeCompare(b.region);
                        return b.currentSales - a.currentSales;
                      }).map((dist) => (
                        <TableRow key={dist.id} 
                          sx={{ 
                            backgroundColor: dist.status === 'active' 
                              ? 'rgba(136, 132, 216, 0.05)' 
                              : 'rgba(0, 0, 0, 0.02)' 
                          }}
                        >
                          <TableCell>{dist.region}</TableCell>
                          <TableCell>{dist.name}</TableCell>
                          <TableCell align="right">¥{dist.currentSales.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={dist.status === 'active' ? '活跃' : '非活跃'}
                              color={dist.status === 'active' ? 'primary' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  分销商网络结构
                </Typography>
                <Typography variant="body2">
                  上图展示了分销商在各区域的销售规模分布。方块大小表示销售额大小，颜色深浅表示分销商状态。
                  通过此图可以直观了解各区域的分销网络结构和重要分销商的分布情况。
                </Typography>
                <Box sx={{ mt: 2, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", mr: 3 }}>
                    <Box sx={{ width: 12, height: 12, backgroundColor: DISTRIBUTOR_COLORS.active, mr: 1 }} />
                    <Typography variant="body2">活跃分销商</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box sx={{ width: 12, height: 12, backgroundColor: DISTRIBUTOR_COLORS.inactive, mr: 1 }} />
                    <Typography variant="body2">非活跃分销商</Typography>
                  </Box>
                </Box>
              </Box>
            </>
          )}

          {/* 区域统计视图 */}
          {mapTabValue === 2 && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                各区域分销商覆盖统计
              </Typography>
              
              {/* 分销商数量统计图 */}
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>分销商数量分布</Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={salesRegionData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="distributors" fill="#8884d8" name="分销商数量" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>销售额占比</Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={salesRegionData}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="sales"
                              nameKey="name"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {salesRegionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* 分销商区域分布表 */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  分销商区域分布表
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>区域</TableCell>
                        <TableCell>分销商数量</TableCell>
                        <TableCell>主要分销商</TableCell>
                        <TableCell>覆盖省份</TableCell>
                        <TableCell>销售总额</TableCell>
                        <TableCell>增长率</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salesRegionData.map((region) => {
                        // 获取该区域的分销商
                        const regionDistributors = distributors.filter(d => 
                          d.region.includes(region.name.substring(0, 2))
                        );
                        // 获取前两个主要分销商名称
                        const mainDistributors = regionDistributors
                          .sort((a, b) => b.currentSales - a.currentSales)
                          .slice(0, 2)
                          .map(d => d.name)
                          .join(", ");
                        
                        // 获取该地区覆盖的省份
                        const provinces = new Set();
                        regionDistributors.forEach(d => {
                          d.coverage.split('、').forEach(p => provinces.add(p));
                        });
                        
                        return (
                          <TableRow key={region.name}>
                            <TableCell>{region.name}</TableCell>
                            <TableCell>{region.distributors}</TableCell>
                            <TableCell>{mainDistributors}</TableCell>
                            <TableCell>{Array.from(provinces).join('、')}</TableCell>
                            <TableCell>¥{region.sales.toLocaleString()}</TableCell>
                            <TableCell>{region.growthRate}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
            
          <Divider sx={{ my: 3 }} />
            
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              分销商覆盖区域统计
            </Typography>
            <Grid container spacing={2}>
              {salesRegionData.map((region) => (
                <Grid item xs={6} sm={4} md={3} key={region.name}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        {region.name}
                      </Typography>
                      <Typography variant="body2">
                        分销商数量: {region.distributors}
                      </Typography>
                      <Typography variant="body2">
                        销售额: ¥{region.sales.toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        增长率: {region.growthRate}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMapDialogClose}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 绩效报告对话框 */}
      <Dialog
        open={openPerformanceDialog}
        onClose={handlePerformanceDialogClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AssessmentIcon sx={{ mr: 1 }} />
            <Typography variant="h6">分销网络绩效分析报告</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs 
            value={performanceTabValue} 
            onChange={handlePerformanceTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label="绩效概览" />
            <Tab label="趋势分析" />
            <Tab label="分销商比较" />
            <Tab label="区域分析" />
          </Tabs>
          
          {/* 绩效概览 */}
          {performanceTabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    绩效指标得分
                  </Typography>
                  {performanceMetricsData.map((item) => (
                    <Box key={item.name} sx={{ my: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{item.name}</Typography>
                        <Typography variant="body2">{item.value}/100</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={item.value} 
                        sx={{ 
                          height: 8, 
                          borderRadius: 1,
                          bgcolor: '#edf2f7',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: item.value >= 90 ? '#48bb78' : item.value >= 75 ? '#4299e1' : '#f56565',
                            borderRadius: 1,
                          }
                        }}
                      />
                    </Box>
                  ))}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    整体绩效评估
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                      <ResponsiveContainer width={250} height={250}>
                        <PieChart>
                          <Pie
                            data={performanceMetricsData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            label
                          >
                            {performanceMetricsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          85%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body1" sx={{ textAlign: 'center' }}>
                      总体绩效评分
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                      <Rating
                        value={4.5}
                        precision={0.5}
                        readOnly
                        emptyIcon={<StarBorderIcon fontSize="inherit" />}
                        icon={<StarIcon fontSize="inherit" />}
                      />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        优秀
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              {/* 雷达图 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    多维度绩效分析
                  </Typography>
                  <Box sx={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="绩效" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <RechartsTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* 趋势分析 */}
          {performanceTabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    分销网络绩效趋势 (过去12个月)
                  </Typography>
                  <Box sx={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[60, 100]} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="performance" stroke="#8884d8" activeDot={{ r: 8 }} name="绩效评分" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    关键绩效指标趋势分析
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    数据显示，整体网络绩效在过去一年中稳步提升，第四季度表现尤为突出。主要增长点来自于华东和华南区域的分销商。
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      绩效提升亮点
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="primary">
                              销售额增长
                            </Typography>
                            <Typography variant="h4" sx={{ my: 1 }}>
                              +15.2%
                            </Typography>
                            <Typography variant="body2">
                              同比增长，主要来自华东地区
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="primary">
                              客户满意度
                            </Typography>
                            <Typography variant="h4" sx={{ my: 1 }}>
                              92%
                            </Typography>
                            <Typography variant="body2">
                              比上年同期提高5个百分点
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="primary">
                              市场覆盖率
                            </Typography>
                            <Typography variant="h4" sx={{ my: 1 }}>
                              78%
                            </Typography>
                            <Typography variant="body2">
                              较去年扩大10个百分点
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="primary">
                              新增分销商
                            </Typography>
                            <Typography variant="h4" sx={{ my: 1 }}>
                              8家
                            </Typography>
                            <Typography variant="body2">
                              战略合作伙伴增长明显
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* 分销商比较 */}
          {performanceTabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    分销商绩效对比
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart 
                      data={distributors.filter(d => d.status === 'active')}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={150} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="performance" name="绩效评分" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    优秀分销商分析
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>分销商名称</TableCell>
                          <TableCell>绩效评分</TableCell>
                          <TableCell>销售达成率</TableCell>
                          <TableCell>优势领域</TableCell>
                          <TableCell>改进建议</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {distributors
                          .filter(d => d.status === 'active')
                          .sort((a, b) => b.performance - a.performance)
                          .slice(0, 3)
                          .map((distributor) => (
                            <TableRow key={distributor.id}>
                              <TableCell>{distributor.name}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography variant="body2" sx={{ mr: 1 }}>
                                    {distributor.performance}/100
                                  </Typography>
                                  <Rating
                                    value={distributor.performance / 20}
                                    precision={0.5}
                                    readOnly
                                    size="small"
                                  />
                                </Box>
                              </TableCell>
                              <TableCell>{`${Math.round((distributor.currentSales / distributor.salesTarget) * 100)}%`}</TableCell>
                              <TableCell>
                                {distributor.id === 'DIST001' ? '渠道拓展、客户服务' : 
                                 distributor.id === 'DIST002' ? '销售策略、市场覆盖' :
                                 distributor.id === 'DIST003' ? '产品推广、品牌建设' : ''}
                              </TableCell>
                              <TableCell>
                                {distributor.id === 'DIST001' ? '加强数字化转型，提高线上营销能力' : 
                                 distributor.id === 'DIST002' ? '优化库存管理，提高交付效率' :
                                 distributor.id === 'DIST003' ? '拓展二三线城市市场，增加产品覆盖面' : ''}
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

          {/* 区域分析 */}
          {performanceTabValue === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    各区域销售与绩效对比
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={salesRegionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <RechartsTooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="sales" name="销售额(元)" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="growthRate" name="增长率(%)" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    区域绩效分析总结
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    根据各区域的销售额、增长率和分销商数量的综合分析，我们得出以下结论：
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="primary">
                            高增长区域
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            西南地区以18.5%的增长率领先全国，主要得益于成都、重庆等核心城市的中医药消费快速增长。
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="primary">
                            销售领先区域
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            华东地区销售额达1200万元，为全国最高，主要由上海、江苏、浙江三地贡献，得益于发达的医药商业网络。
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="primary">
                            潜力发展区域
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            西北地区虽然目前销售额较低，但随着"一带一路"建设深入，中医药产品的需求逐渐增长，值得关注。
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      建议策略
                    </Typography>
                    <ul>
                      <li>
                        <Typography variant="body2">
                          华东、华南地区：巩固优势，提高产品深度和客户忠诚度
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          西南地区：加大投入，扩大分销网络覆盖范围
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          西北、东北地区：培育市场，发展战略合作伙伴
                        </Typography>
                      </li>
                    </ul>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePerformanceDialogClose}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 添加/编辑分销商对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{dialogType === 'add' ? '添加分销商' : '编辑分销商'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField name="name" label="分销商名称" fullWidth value={formData.name || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="region" label="所属区域" fullWidth value={formData.region || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField name="address" label="地址" fullWidth value={formData.address || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="contact" label="联系人" fullWidth value={formData.contact || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="phone" label="联系电话" fullWidth value={formData.phone || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="email" label="电子邮箱" fullWidth value={formData.email || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>状态</InputLabel>
                <Select name="status" value={formData.status || 'active'} label="状态" onChange={handleInputChange}>
                  <MenuItem value="active">活跃</MenuItem>
                  <MenuItem value="inactive">非活跃</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="salesTarget" label="销售目标" type="number" fullWidth value={formData.salesTarget || 0} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="currentSales" label="当前销售额" type="number" fullWidth value={formData.currentSales || 0} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="joinDate" label="加入日期" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.joinDate || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="coverage" label="覆盖范围" fullWidth value={formData.coverage || ''} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="performance" label="绩效评分" type="number" fullWidth value={formData.performance || 0} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="type" label="分销商类型" fullWidth value={formData.type || ''} onChange={handleInputChange} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained" onClick={handleSaveDistributor}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DistributionNetwork; 