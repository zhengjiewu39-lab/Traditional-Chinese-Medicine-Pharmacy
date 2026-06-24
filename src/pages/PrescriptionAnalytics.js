import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  TextField,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// 图表颜色配置
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

// 标签格式化器
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper elevation={3} sx={{ p: 1, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
        <Typography variant="body2">{`${label}`}</Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

// 模拟数据
const mockData = {
  trends: [
    { date: '2025-05-15', count: 5 },
    { date: '2025-05-16', count: 7 },
    { date: '2025-05-17', count: 3 },
    { date: '2025-05-18', count: 9 },
    { date: '2025-05-19', count: 12 },
    { date: '2025-05-20', count: 8 },
    { date: '2025-05-21', count: 10 }
  ],
  herbs: [
    { name: '黄芪', count: 78 },
    { name: '当归', count: 65 },
    { name: '白芍', count: 61 },
    { name: '茯苓', count: 53 },
    { name: '甘草', count: 47 },
    { name: '熟地黄', count: 42 },
    { name: '人参', count: 38 },
    { name: '白术', count: 35 },
    { name: '陈皮', count: 32 },
    { name: '川芎', count: 28 }
  ],
  diagnosis: [
    { name: '气血两虚', count: 42 },
    { name: '脾胃虚弱', count: 36 },
    { name: '肝郁气滞', count: 27 },
    { name: '肾阴虚', count: 21 },
    { name: '湿热内蕴', count: 18 },
    { name: '风湿痹阻', count: 15 },
    { name: '心脾两虚', count: 12 },
    { name: '肺气虚', count: 9 }
  ],
  templates: [
    { id: 1, name: '四君子汤', usageCount: 38, mainIndication: '脾胃虚弱' },
    { id: 2, name: '六味地黄丸', usageCount: 32, mainIndication: '肾阴虚' },
    { id: 3, name: '补中益气汤', usageCount: 27, mainIndication: '气虚下陷' },
    { id: 4, name: '逍遥散', usageCount: 21, mainIndication: '肝郁气滞' },
    { id: 5, name: '八珍汤', usageCount: 18, mainIndication: '气血两虚' }
  ]
};

const PrescriptionAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [timeRange, setTimeRange] = useState('month');
  const [startDateStr, setStartDateStr] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
  );
  const [endDateStr, setEndDateStr] = useState(new Date().toISOString().split('T')[0]);
  
  // 数据状态
  const [prescriptionTrends, setPrescriptionTrends] = useState([]);
  const [herbUsage, setHerbUsage] = useState([]);
  const [diagnosisStats, setDiagnosisStats] = useState([]);
  const [topTemplates, setTopTemplates] = useState([]);

  // 获取统计数据
  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, startDateStr, endDateStr]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 使用模拟数据
      setPrescriptionTrends(mockData.trends);
      setHerbUsage(mockData.herbs);
      setDiagnosisStats(mockData.diagnosis);
      setTopTemplates(mockData.templates);
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('获取统计数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理标签切换
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
    
    // 根据选择的时间范围设置起始日期
    const now = new Date();
    let start = new Date();
    
    switch (event.target.value) {
      case 'week':
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        start = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        break;
    }
    
    setStartDateStr(start.toISOString().split('T')[0]);
    setEndDateStr(new Date().toISOString().split('T')[0]);
  };

  // 渲染处方趋势图表
  const renderPrescriptionTrends = () => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          处方量趋势
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : prescriptionTrends.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography color="text.secondary">暂无数据</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={prescriptionTrends}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="count" name="处方数量" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  // 渲染常用药材统计
  const renderHerbUsage = () => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          常用药材统计
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : herbUsage.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography color="text.secondary">暂无数据</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={herbUsage.slice(0, 10)}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="count" name="使用次数" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  // 渲染疾病诊断分布
  const renderDiagnosisStats = () => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          疾病诊断分布
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : diagnosisStats.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography color="text.secondary">暂无数据</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={diagnosisStats.slice(0, 8)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="name"
              >
                {diagnosisStats.slice(0, 8).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  // 渲染热门处方模板
  const renderTopTemplates = () => (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          热门处方模板
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : topTemplates.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography color="text.secondary">暂无数据</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>排名</TableCell>
                  <TableCell>处方模板</TableCell>
                  <TableCell>使用次数</TableCell>
                  <TableCell>主要适用症</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topTemplates.map((template, index) => (
                  <TableRow key={template.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.usageCount}</TableCell>
                    <TableCell>{template.mainIndication}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  // 渲染详细统计数据
  const renderDetailedStats = () => {
    switch (currentTab) {
      case 0: // 概览
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              {renderPrescriptionTrends()}
            </Grid>
            <Grid item xs={12} md={6}>
              {renderHerbUsage()}
            </Grid>
            <Grid item xs={12} md={6}>
              {renderDiagnosisStats()}
            </Grid>
            <Grid item xs={12} md={6}>
              {renderTopTemplates()}
            </Grid>
          </Grid>
        );
      case 1: // 处方趋势
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderPrescriptionTrends()}
            </Grid>
          </Grid>
        );
      case 2: // 药材统计
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderHerbUsage()}
            </Grid>
          </Grid>
        );
      case 3: // 疾病分布
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderDiagnosisStats()}
            </Grid>
          </Grid>
        );
      case 4: // 处方模板
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderTopTemplates()}
            </Grid>
          </Grid>
        );
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          处方统计分析
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          分析处方数据，了解配药趋势和用药规律
        </Typography>
    </Box>

      <Grid container spacing={3}>
        {/* 筛选器区域 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>时间范围</InputLabel>
                  <Select
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    label="时间范围"
                  >
                    <MenuItem value="week">最近一周</MenuItem>
                    <MenuItem value="month">最近一个月</MenuItem>
                    <MenuItem value="quarter">最近三个月</MenuItem>
                    <MenuItem value="year">最近一年</MenuItem>
                    <MenuItem value="custom">自定义</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {timeRange === 'custom' && (
                <>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="开始日期"
                      type="date"
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="结束日期"
                      type="date"
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* 选项卡区域 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 0 }}>
            <Tabs
              value={currentTab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="概览" />
              <Tab label="处方趋势" />
              <Tab label="药材统计" />
              <Tab label="疾病分布" />
              <Tab label="处方模板" />
            </Tabs>
          </Paper>
        </Grid>

        {/* 错误提示 */}
        {error && (
          <Grid item xs={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}

        {/* 统计图表区域 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            {renderDetailedStats()}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PrescriptionAnalytics; 