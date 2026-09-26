import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import { 
  DatePicker,
  LocalizationProvider
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// 示例数据
const monthlyPrescriptionsData = [
  { month: '一月', count: 156, amount: 23400 },
  { month: '二月', count: 142, amount: 21300 },
  { month: '三月', count: 178, amount: 26700 },
  { month: '四月', count: 189, amount: 28350 },
  { month: '五月', count: 204, amount: 30600 },
  { month: '六月', count: 187, amount: 28050 },
];

const commonHerbsData = [
  { name: '黄芪', count: 320, percentage: 26 },
  { name: '当归', count: 280, percentage: 23 },
  { name: '白芍', count: 250, percentage: 20 },
  { name: '川芎', count: 190, percentage: 15 },
  { name: '茯苓', count: 120, percentage: 10 },
  { name: '甘草', count: 75, percentage: 6 },
];

const prescriptionTypeData = [
  { name: '补气方', value: 35 },
  { name: '补血方', value: 25 },
  { name: '滋阴方', value: 20 },
  { name: '疏肝理气方', value: 15 },
  { name: '祛湿方', value: 5 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A4DE6C'];

const topDoctorsData = [
  { id: 1, name: '张医师', department: '内科', count: 98, total: 14700 },
  { id: 2, name: '李医师', department: '妇科', count: 85, total: 12750 },
  { id: 3, name: '王医师', department: '内科', count: 72, total: 10800 },
  { id: 4, name: '刘医师', department: '外科', count: 64, total: 9600 },
  { id: 5, name: '陈医师', department: '儿科', count: 51, total: 7650 },
];

const PrescriptionAnalytics = () => {
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState('month');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          处方统计分析
        </Typography>
        <Box>
          <Button startIcon={<DownloadIcon />} sx={{ mr: 1 }}>
            导出数据
          </Button>
          <Button startIcon={<PrintIcon />}>
            打印报表
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>时间范围</InputLabel>
              <Select
                value={timeRange}
                label="时间范围"
                onChange={handleTimeRangeChange}
              >
                <MenuItem value="week">本周</MenuItem>
                <MenuItem value="month">本月</MenuItem>
                <MenuItem value="quarter">本季度</MenuItem>
                <MenuItem value="year">本年度</MenuItem>
                <MenuItem value="custom">自定义</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {timeRange === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="开始日期"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="结束日期"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                />
              </Grid>
            </LocalizationProvider>
          )}

          <Grid item xs={12} md={timeRange === 'custom' ? 3 : 9}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained">应用</Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label="处方概览" />
          <Tab label="药材分析" />
          <Tab label="医师开方" />
          <Tab label="疾病分类" />
        </Tabs>
      </Box>

      {/* 处方概览 */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    处方数量趋势
                  </Typography>
                  <Tooltip title="显示每月处方数量变化">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={monthlyPrescriptionsData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="处方数量" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    处方金额趋势
                  </Typography>
                  <Tooltip title="显示每月处方总金额变化">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={monthlyPrescriptionsData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="amount" fill="#82ca9d" name="处方金额(元)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    处方类型分布
                  </Typography>
                  <Tooltip title="显示不同处方类型的占比">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prescriptionTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prescriptionTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  处方统计数据
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          总处方数量
                        </Typography>
                        <Typography variant="h4">
                          1,056
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          +8.2% ↑
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          处方总金额
                        </Typography>
                        <Typography variant="h4">
                          ¥158,400
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          +5.7% ↑
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          平均处方金额
                        </Typography>
                        <Typography variant="h4">
                          ¥150
                        </Typography>
                        <Typography variant="body2" color="error.main">
                          -2.3% ↓
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          医师数量
                        </Typography>
                        <Typography variant="h4">
                          28
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          +3.7% ↑
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 药材分析 */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  常用药材排行
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={commonHerbsData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" name="处方次数" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  药材使用详情
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>药材名称</TableCell>
                        <TableCell align="right">使用次数</TableCell>
                        <TableCell align="right">占比</TableCell>
                        <TableCell align="right">平均用量(g)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {commonHerbsData.map((herb) => (
                        <TableRow key={herb.name}>
                          <TableCell component="th" scope="row">
                            {herb.name}
                          </TableCell>
                          <TableCell align="right">{herb.count}</TableCell>
                          <TableCell align="right">{herb.percentage}%</TableCell>
                          <TableCell align="right">
                            {herb.name === '黄芪' && 15}
                            {herb.name === '当归' && 10}
                            {herb.name === '白芍' && 12}
                            {herb.name === '川芎' && 6}
                            {herb.name === '茯苓' && 12}
                            {herb.name === '甘草' && 6}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 医师开方 */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  医师开方排行
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>排名</TableCell>
                        <TableCell>医师姓名</TableCell>
                        <TableCell>科室</TableCell>
                        <TableCell align="right">处方数量</TableCell>
                        <TableCell align="right">处方金额(元)</TableCell>
                        <TableCell align="right">平均处方金额(元)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topDoctorsData.map((doctor, index) => (
                        <TableRow key={doctor.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{doctor.name}</TableCell>
                          <TableCell>{doctor.department}</TableCell>
                          <TableCell align="right">{doctor.count}</TableCell>
                          <TableCell align="right">{doctor.total}</TableCell>
                          <TableCell align="right">{Math.round(doctor.total / doctor.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 疾病分类 */}
      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  疾病分类统计
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '脾胃疾病', value: 30 },
                        { name: '肝胆疾病', value: 20 },
                        { name: '心血管疾病', value: 15 },
                        { name: '呼吸系统疾病', value: 12 },
                        { name: '妇科疾病', value: 10 },
                        { name: '其他疾病', value: 13 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prescriptionTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  常见疾病用药分析
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>疾病类别</TableCell>
                        <TableCell>常用处方</TableCell>
                        <TableCell>主要药材</TableCell>
                        <TableCell align="right">处方数量</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>脾胃虚弱</TableCell>
                        <TableCell>四君子汤</TableCell>
                        <TableCell>人参、白术、茯苓、甘草</TableCell>
                        <TableCell align="right">126</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>肝郁气滞</TableCell>
                        <TableCell>柴胡疏肝散</TableCell>
                        <TableCell>柴胡、白芍、陈皮、香附</TableCell>
                        <TableCell align="right">98</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>血虚证</TableCell>
                        <TableCell>四物汤</TableCell>
                        <TableCell>当归、川芎、白芍、熟地黄</TableCell>
                        <TableCell align="right">85</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>肾阴虚</TableCell>
                        <TableCell>六味地黄丸</TableCell>
                        <TableCell>熟地黄、山茱萸、山药、泽泻</TableCell>
                        <TableCell align="right">72</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>风寒感冒</TableCell>
                        <TableCell>桂枝汤</TableCell>
                        <TableCell>桂枝、白芍、生姜、大枣、甘草</TableCell>
                        <TableCell align="right">64</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default PrescriptionAnalytics; 