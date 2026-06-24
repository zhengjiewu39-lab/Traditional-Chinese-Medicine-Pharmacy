import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardHeader,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Rating,
  InputAdornment,
  Tooltip,
  LinearProgress,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Timeline as TimelineIcon,
  People as PeopleIcon,
  InsertChart as InsertChartIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  Event as EventIcon,
  Feedback as FeedbackIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

// 模拟员工绩效数据
const initialPerformances = [
  {
    id: '1',
    employeeId: '1',
    employeeName: '张三',
    department: '总部',
    position: '总经理',
    period: '2023-Q1',
    overallScore: 4.8,
    leadershipScore: 4.9,
    executionScore: 4.7,
    innovationScore: 4.8,
    teamworkScore: 4.8,
    status: '已完成',
    reviewer: '董事会',
    feedback: '张总在本季度带领公司实现了销售目标的120%，同时成功启动了两个战略项目。在员工满意度调查中，企业文化评分提高了15%。',
    goals: [
      { id: '101', name: '销售目标达成率', target: '100%', actual: '120%', status: '超额完成' },
      { id: '102', name: '战略项目启动', target: '2个', actual: '2个', status: '完成' },
      { id: '103', name: '员工满意度提升', target: '10%', actual: '15%', status: '超额完成' },
    ],
    strengths: ['战略思维清晰', '决策力强', '团队领导力出色'],
    improvements: ['可以更多关注中层管理者的培养'],
    submissionDate: '2023-03-25',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: '2',
    employeeId: '2',
    employeeName: '李四',
    department: '采购部',
    position: '采购经理',
    period: '2023-Q1',
    overallScore: 4.2,
    leadershipScore: 4.0,
    executionScore: 4.4,
    innovationScore: 4.0,
    teamworkScore: 4.4,
    status: '已完成',
    reviewer: '张三',
    feedback: '李经理在本季度通过重新谈判供应商合同，实现了采购成本降低8%，低于目标的10%。但库存周转率提高了20%，超过了预期的15%。建议加强供应商管理策略。',
    goals: [
      { id: '201', name: '采购成本降低', target: '10%', actual: '8%', status: '部分完成' },
      { id: '202', name: '库存周转率提高', target: '15%', actual: '20%', status: '超额完成' },
      { id: '203', name: '合格供应商数量增加', target: '5个', actual: '4个', status: '部分完成' },
    ],
    strengths: ['供应链管理能力强', '成本控制意识好'],
    improvements: ['供应商关系管理需加强', '创新采购策略'],
    submissionDate: '2023-03-20',
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    id: '3',
    employeeId: '3',
    employeeName: '王五',
    department: '销售部',
    position: '销售总监',
    period: '2023-Q1',
    overallScore: 4.5,
    leadershipScore: 4.3,
    executionScore: 4.6,
    innovationScore: 4.5,
    teamworkScore: 4.6,
    status: '已完成',
    reviewer: '张三',
    feedback: '王总监带领销售团队在本季度超额完成销售目标15%，新客户开发达到了预期目标。客户满意度调查结果良好，但仍有提升空间。建议加强销售团队的产品知识培训。',
    goals: [
      { id: '301', name: '销售目标达成', target: '100%', actual: '115%', status: '超额完成' },
      { id: '302', name: '新客户开发', target: '20个', actual: '22个', status: '超额完成' },
      { id: '303', name: '客户满意度', target: '90%', actual: '88%', status: '部分完成' },
    ],
    strengths: ['客户关系维护能力强', '团队激励有方', '市场洞察力好'],
    improvements: ['产品知识培训需加强', '提升团队的客户服务意识'],
    submissionDate: '2023-03-22',
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
  },
  {
    id: '4',
    employeeId: '4',
    employeeName: '赵六',
    department: '质量部',
    position: '质量经理',
    period: '2023-Q1',
    overallScore: 4.6,
    leadershipScore: 4.4,
    executionScore: 4.8,
    innovationScore: 4.5,
    teamworkScore: 4.7,
    status: '已完成',
    reviewer: '张三',
    feedback: '赵经理在质量管理方面表现出色，本季度质量事故率降低至历史最低。新引入的质量检测流程提高了效率30%。团队协作方面，与其他部门配合良好，及时解决了多个跨部门质量问题。',
    goals: [
      { id: '401', name: '质量事故率降低', target: '50%', actual: '65%', status: '超额完成' },
      { id: '402', name: '质量检测流程优化', target: '20%', actual: '30%', status: '超额完成' },
      { id: '403', name: '合规审计通过率', target: '100%', actual: '100%', status: '完成' },
    ],
    strengths: ['专业知识扎实', '流程管理能力强', '问题解决能力出色'],
    improvements: ['可以更多关注团队成员的职业发展'],
    submissionDate: '2023-03-21',
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
  },
  {
    id: '5',
    employeeId: '5',
    employeeName: '钱七',
    department: '采购部',
    position: '采购专员',
    period: '2023-Q1',
    overallScore: 3.8,
    leadershipScore: 3.5,
    executionScore: 4.0,
    innovationScore: 3.7,
    teamworkScore: 4.0,
    status: '已完成',
    reviewer: '李四',
    feedback: '钱专员执行力较强，能按时完成采购任务。在供应商谈判中表现出了一定的能力，但创新意识和主动性有待提高。建议加强市场分析能力和价格谈判技巧的培训。',
    goals: [
      { id: '501', name: '采购订单准时率', target: '95%', actual: '97%', status: '超额完成' },
      { id: '502', name: '采购价格优化', target: '5%', actual: '3%', status: '部分完成' },
      { id: '503', name: '供应商评估完成', target: '10个', actual: '8个', status: '部分完成' },
    ],
    strengths: ['执行力强', '责任心强', '学习能力好'],
    improvements: ['市场分析能力需提升', '价格谈判技巧需加强', '需要增强主动性'],
    submissionDate: '2023-03-18',
    avatar: 'https://randomuser.me/api/portraits/women/5.jpg',
  },
  {
    id: '6',
    employeeId: '6',
    employeeName: '孙八',
    department: '销售部',
    position: '销售主管',
    period: '2023-Q1',
    overallScore: 4.1,
    leadershipScore: 4.0,
    executionScore: 4.2,
    innovationScore: 3.9,
    teamworkScore: 4.3,
    status: '已完成',
    reviewer: '王五',
    feedback: '孙主管带领团队完成了销售目标的105%，团队管理能力有所提升。在新产品推广方面有创新，但客户深度开发还需加强。与市场部配合良好，共同完成了季度促销活动。',
    goals: [
      { id: '601', name: '销售目标达成', target: '100%', actual: '105%', status: '超额完成' },
      { id: '602', name: '团队销售技能提升', target: '完成培训', actual: '已完成', status: '完成' },
      { id: '603', name: '重点客户销售增长', target: '15%', actual: '12%', status: '部分完成' },
    ],
    strengths: ['团队管理有方', '执行力强', '客户服务意识好'],
    improvements: ['战略思维需提升', '客户深度开发能力需加强'],
    submissionDate: '2023-03-19',
    avatar: 'https://randomuser.me/api/portraits/women/6.jpg',
  },
  {
    id: '7',
    employeeId: '1',
    employeeName: '张三',
    department: '总部',
    position: '总经理',
    period: '2022-Q4',
    overallScore: 4.7,
    leadershipScore: 4.8,
    executionScore: 4.6,
    innovationScore: 4.7,
    teamworkScore: 4.7,
    status: '已完成',
    reviewer: '董事会',
    feedback: '张总在本季度的战略规划和执行方面表现出色，成功带领公司度过了市场波动期，实现了年度目标的圆满完成。团队凝聚力和企业文化建设有明显提升。',
    goals: [
      { id: '701', name: '年度销售目标达成', target: '100%', actual: '103%', status: '超额完成' },
      { id: '702', name: '成本控制', target: '降低5%', actual: '降低4%', status: '部分完成' },
      { id: '703', name: '新业务拓展', target: '2个方向', actual: '2个方向', status: '完成' },
    ],
    strengths: ['危机管理能力强', '战略执行力出色', '团队激励有方'],
    improvements: ['可以适当放权给中层管理者'],
    submissionDate: '2022-12-20',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: '8',
    employeeId: '2',
    employeeName: '李四',
    department: '采购部',
    position: '采购经理',
    period: '2022-Q4',
    overallScore: 4.0,
    leadershipScore: 3.8,
    executionScore: 4.2,
    innovationScore: 3.8,
    teamworkScore: 4.2,
    status: '已完成',
    reviewer: '张三',
    feedback: '李经理在季度采购计划执行和供应商管理方面表现良好，但在创新采购模式方面还有提升空间。与生产部门的协作有待加强，以更好地满足生产需求。',
    goals: [
      { id: '801', name: '采购预算控制', target: '不超预算', actual: '节省2%', status: '超额完成' },
      { id: '802', name: '供应商评级提升', target: 'A级增加3个', actual: 'A级增加2个', status: '部分完成' },
      { id: '803', name: '紧急采购响应时间', target: '缩短20%', actual: '缩短15%', status: '部分完成' },
    ],
    strengths: ['预算控制能力强', '供应商管理经验丰富'],
    improvements: ['创新采购模式', '跨部门协作意识'],
    submissionDate: '2022-12-18',
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
];

// 绩效评分选项
const scoreOptions = [
  { value: 5, label: '优秀 (5分)' },
  { value: 4, label: '良好 (4分)' },
  { value: 3, label: '达标 (3分)' },
  { value: 2, label: '需改进 (2分)' },
  { value: 1, label: '不合格 (1分)' },
];

// 部门数据
const departments = [
  '总部',
  '采购部',
  '销售部',
  '质量部',
  '北京分部',
  '上海分部',
  '零售药房',
  '配送中心',
  '品控部门',
];

// 评价周期
const periods = [
  '2023-Q1',
  '2022-Q4',
  '2022-Q3',
  '2022-Q2',
  '2022-Q1',
  '2021-Q4',
];

// 模拟员工数据
const employees = [
  { id: '1', name: '张三', department: '总部', position: '总经理', avatar: 'https://randomuser.me/api/portraits/men/1.jpg' },
  { id: '2', name: '李四', department: '采购部', position: '采购经理', avatar: 'https://randomuser.me/api/portraits/men/2.jpg' },
  { id: '3', name: '王五', department: '销售部', position: '销售总监', avatar: 'https://randomuser.me/api/portraits/men/3.jpg' },
  { id: '4', name: '赵六', department: '质量部', position: '质量经理', avatar: 'https://randomuser.me/api/portraits/men/4.jpg' },
  { id: '5', name: '钱七', department: '采购部', position: '采购专员', avatar: 'https://randomuser.me/api/portraits/women/5.jpg' },
  { id: '6', name: '孙八', department: '销售部', position: '销售主管', avatar: 'https://randomuser.me/api/portraits/women/6.jpg' },
  { id: '7', name: '周九', department: '北京分部', position: '分部经理', avatar: 'https://randomuser.me/api/portraits/men/7.jpg' },
  { id: '8', name: '吴十', department: '质量部', position: '质检员', avatar: 'https://randomuser.me/api/portraits/women/8.jpg' },
];

function PerformanceManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [performances, setPerformances] = useState(initialPerformances);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [detailPerformance, setDetailPerformance] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    period: '',
    overallScore: 0,
    leadershipScore: 0,
    executionScore: 0,
    innovationScore: 0,
    teamworkScore: 0,
    status: '进行中',
    reviewer: '',
    feedback: '',
    goals: [],
    strengths: [],
    improvements: [],
  });
  
  // 处理选项卡切换
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // 处理搜索
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  // 处理部门筛选
  const handleDepartmentFilter = (event) => {
    setFilterDepartment(event.target.value);
  };

  // 处理周期筛选
  const handlePeriodFilter = (event) => {
    setFilterPeriod(event.target.value);
  };

  // 筛选评估记录
  const filteredPerformances = performances.filter((perf) => {
    return (
      (searchTerm === '' || 
        perf.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perf.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perf.position.toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (filterDepartment === '' || perf.department === filterDepartment) &&
      (filterPeriod === '' || perf.period === filterPeriod)
    );
  });

  // 打开新建/编辑对话框
  const handleOpenDialog = (performance = null) => {
    if (performance) {
      setSelectedPerformance(performance);
      setFormData({
        employeeId: performance.employeeId,
        employeeName: performance.employeeName,
        department: performance.department,
        position: performance.position,
        period: performance.period,
        overallScore: performance.overallScore,
        leadershipScore: performance.leadershipScore,
        executionScore: performance.executionScore,
        innovationScore: performance.innovationScore,
        teamworkScore: performance.teamworkScore,
        status: performance.status,
        reviewer: performance.reviewer,
        feedback: performance.feedback,
        goals: [...performance.goals],
        strengths: [...performance.strengths],
        improvements: [...performance.improvements],
        avatar: performance.avatar,
      });
    } else {
      setSelectedPerformance(null);
      setFormData({
        employeeId: '',
        period: '',
        overallScore: 0,
        leadershipScore: 0,
        executionScore: 0,
        innovationScore: 0,
        teamworkScore: 0,
        status: '进行中',
        reviewer: '',
        feedback: '',
        goals: [],
        strengths: [],
        improvements: [],
      });
    }
    setOpenDialog(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPerformance(null);
  };

  // 处理查看详情
  const handleViewDetails = (performance) => {
    setDetailPerformance(performance);
  };

  // 关闭详情视图
  const handleCloseDetails = () => {
    setDetailPerformance(null);
  };

  // 提交表单
  const handleSubmit = () => {
    if (selectedPerformance) {
      // 更新绩效评估
      const updatedPerformances = performances.map(perf => {
        if (perf.id === selectedPerformance.id) {
          // 计算综合评分
          const overallScore = (
            parseFloat(formData.leadershipScore) +
            parseFloat(formData.executionScore) +
            parseFloat(formData.innovationScore) +
            parseFloat(formData.teamworkScore)
          ) / 4;
          
          return {
            ...selectedPerformance,
            ...formData,
            overallScore: parseFloat(overallScore.toFixed(1)),
            submissionDate: new Date().toISOString().split('T')[0],
          };
        }
        return perf;
      });
      
      setPerformances(updatedPerformances);
      
      // 如果详情视图正在显示此绩效，更新它
      if (detailPerformance && detailPerformance.id === selectedPerformance.id) {
        const updatedPerformance = updatedPerformances.find(p => p.id === selectedPerformance.id);
        setDetailPerformance(updatedPerformance);
      }
    } else {
      // 添加新的绩效评估
      // 找到员工信息
      const employee = employees.find(emp => emp.id === formData.employeeId);
      
      // 计算综合评分
      const overallScore = (
        parseFloat(formData.leadershipScore) +
        parseFloat(formData.executionScore) +
        parseFloat(formData.innovationScore) +
        parseFloat(formData.teamworkScore)
      ) / 4;
      
      const newPerformance = {
        id: Date.now().toString(),
        employeeId: formData.employeeId,
        employeeName: employee?.name || '',
        department: employee?.department || '',
        position: employee?.position || '',
        avatar: employee?.avatar || '',
        submissionDate: new Date().toISOString().split('T')[0],
        overallScore: parseFloat(overallScore.toFixed(1)),
        ...formData,
      };
      
      setPerformances([...performances, newPerformance]);
    }
    
    handleCloseDialog();
  };

  // 处理目标添加
  const handleAddGoal = () => {
    const newGoal = {
      id: Date.now().toString(),
      name: '',
      target: '',
      actual: '',
      status: '进行中',
    };
    
    setFormData({
      ...formData,
      goals: [...formData.goals, newGoal],
    });
  };

  // 处理目标更新
  const handleUpdateGoal = (index, field, value) => {
    const updatedGoals = [...formData.goals];
    updatedGoals[index] = {
      ...updatedGoals[index],
      [field]: value,
    };
    
    setFormData({
      ...formData,
      goals: updatedGoals,
    });
  };

  // 处理目标删除
  const handleDeleteGoal = (index) => {
    const updatedGoals = formData.goals.filter((_, i) => i !== index);
    
    setFormData({
      ...formData,
      goals: updatedGoals,
    });
  };

  // 处理优势/改进项添加
  const handleAddItem = (type, value) => {
    if (!value.trim()) return;
    
    const field = type === 'strength' ? 'strengths' : 'improvements';
    
    if (!formData[field].includes(value.trim())) {
      setFormData({
        ...formData,
        [field]: [...formData[field], value.trim()],
      });
    }
    
    // 清空输入框
    const inputElement = document.getElementById(`${type}-input`);
    if (inputElement) {
      inputElement.value = '';
    }
  };

  // 处理优势/改进项删除
  const handleDeleteItem = (type, index) => {
    const field = type === 'strength' ? 'strengths' : 'improvements';
    
    const updatedItems = formData[field].filter((_, i) => i !== index);
    
    setFormData({
      ...formData,
      [field]: updatedItems,
    });
  };

  // 渲染绩效评分图表
  const renderScoreChart = () => {
    // 计算部门平均得分
    const departmentScores = {};
    departments.forEach(dept => {
      const deptPerformances = performances.filter(p => p.department === dept);
      if (deptPerformances.length > 0) {
        departmentScores[dept] = {
          department: dept,
          average: deptPerformances.reduce((sum, p) => sum + p.overallScore, 0) / deptPerformances.length,
          count: deptPerformances.length
        };
      }
    });

    const departmentScoreData = Object.values(departmentScores).filter(dept => dept.count > 0);

    // 计算评分分布
    const scoreDistribution = [0, 0, 0, 0, 0]; // 1-5分
    performances.forEach(p => {
      const scoreIndex = Math.floor(p.overallScore) - 1;
      if (scoreIndex >= 0 && scoreIndex < 5) {
        scoreDistribution[scoreIndex]++;
      }
    });

    const scoreDistributionData = [
      { name: '不合格', value: scoreDistribution[0] },
      { name: '需改进', value: scoreDistribution[1] },
      { name: '达标', value: scoreDistribution[2] },
      { name: '良好', value: scoreDistribution[3] },
      { name: '优秀', value: scoreDistribution[4] }
    ];

    const COLORS = ['#FF8042', '#FFBB28', '#00C49F', '#0088FE', '#8884d8'];

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>部门平均绩效</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart
                data={departmentScoreData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis domain={[0, 5]} />
                <RechartsTooltip />
                <Bar dataKey="average" fill="#8884d8" name="平均分数" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>绩效评分分布</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={scoreDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scoreDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  // 渲染查询和筛选工具栏
  const renderFilterBar = () => (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="搜索员工、部门或职位..."
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>部门</InputLabel>
            <Select
              value={filterDepartment}
              label="部门"
              onChange={handleDepartmentFilter}
            >
              <MenuItem value="">所有部门</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept} value={dept}>{dept}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>评估周期</InputLabel>
            <Select
              value={filterPeriod}
              label="评估周期"
              onChange={handlePeriodFilter}
            >
              <MenuItem value="">所有周期</MenuItem>
              {periods.map((period) => (
                <MenuItem key={period} value={period}>{period}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  // 渲染绩效详情对话框
  const renderPerformanceDetailDialog = () => {
    if (!detailPerformance) return null;
    
    // 计算目标完成情况
    const completedGoals = detailPerformance.goals.filter(g => g.status === '完成' || g.status === '超额完成').length;
    const totalGoals = detailPerformance.goals.length;
    const completionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
    
    // 获取每个评分项的颜色
    const getScoreColor = (score) => {
      if (score >= 4.5) return '#4caf50';
      if (score >= 4) return '#8bc34a';
      if (score >= 3) return '#ffeb3b';
      if (score >= 2) return '#ff9800';
      return '#f44336';
    };
    
    return (
      <Dialog
        open={Boolean(detailPerformance)}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">绩效评估详情</Typography>
            <Chip
              label={detailPerformance.period}
              color="primary"
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Avatar
                      src={detailPerformance.avatar}
                      sx={{ width: 100, height: 100, mb: 2 }}
                    />
                    <Typography variant="h6">{detailPerformance.employeeName}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {detailPerformance.position}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {detailPerformance.department}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                      <Rating value={detailPerformance.overallScore} precision={0.1} readOnly />
                      <Typography variant="h5" sx={{ ml: 1 }}>
                        {detailPerformance.overallScore.toFixed(1)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      综合评分
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    评分详情
                  </Typography>
                  <List dense disablePadding>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="领导力" />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 50, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: getScoreColor(detailPerformance.leadershipScore), 
                          mr: 1 
                        }} />
                        <Typography>{detailPerformance.leadershipScore.toFixed(1)}</Typography>
                      </Box>
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="执行力" />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 50, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: getScoreColor(detailPerformance.executionScore), 
                          mr: 1 
                        }} />
                        <Typography>{detailPerformance.executionScore.toFixed(1)}</Typography>
                      </Box>
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="创新力" />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 50, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: getScoreColor(detailPerformance.innovationScore), 
                          mr: 1 
                        }} />
                        <Typography>{detailPerformance.innovationScore.toFixed(1)}</Typography>
                      </Box>
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="团队协作" />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 50, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: getScoreColor(detailPerformance.teamworkScore), 
                          mr: 1 
                        }} />
                        <Typography>{detailPerformance.teamworkScore.toFixed(1)}</Typography>
                      </Box>
                    </ListItem>
                  </List>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    评估信息
                  </Typography>
                  <List dense disablePadding>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText 
                        primary="评估人" 
                        secondary={detailPerformance.reviewer} 
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText 
                        primary="提交日期" 
                        secondary={detailPerformance.submissionDate} 
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText 
                        primary="状态" 
                        secondary={
                          <Chip
                            label={detailPerformance.status}
                            color={detailPerformance.status === '已完成' ? 'success' : 'default'}
                            size="small"
                          />
                        } 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Card sx={{ mb: 3 }}>
                <CardHeader title="目标完成情况" titleTypographyProps={{ variant: 'subtitle1' }} />
                <CardContent>
                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ flexGrow: 1, mr: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={completionRate} 
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                    </Box>
                    <Typography variant="body2">
                      {`${completedGoals}/${totalGoals} (${Math.round(completionRate)}%)`}
                    </Typography>
                  </Box>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>目标</TableCell>
                          <TableCell>目标值</TableCell>
                          <TableCell>实际值</TableCell>
                          <TableCell>完成状态</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailPerformance.goals.map((goal) => (
                          <TableRow key={goal.id}>
                            <TableCell>{goal.name}</TableCell>
                            <TableCell>{goal.target}</TableCell>
                            <TableCell>{goal.actual}</TableCell>
                            <TableCell>
                              <Chip
                                label={goal.status}
                                color={
                                  goal.status === '超额完成' ? 'success' :
                                  goal.status === '完成' ? 'primary' :
                                  goal.status === '部分完成' ? 'warning' : 'default'
                                }
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
              
              <Card sx={{ mb: 3 }}>
                <CardHeader 
                  title="绩效反馈" 
                  titleTypographyProps={{ variant: 'subtitle1' }}
                  avatar={<FeedbackIcon />}
                />
                <CardContent>
                  <Typography variant="body2" paragraph>
                    {detailPerformance.feedback}
                  </Typography>
                </CardContent>
              </Card>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardHeader 
                      title="优势" 
                      titleTypographyProps={{ variant: 'subtitle1' }}
                      avatar={<CheckCircleIcon color="success" />}
                    />
                    <CardContent>
                      <List dense>
                        {detailPerformance.strengths.map((strength, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={`• ${strength}`} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardHeader 
                      title="改进项" 
                      titleTypographyProps={{ variant: 'subtitle1' }}
                      avatar={<TimelineIcon color="warning" />}
                    />
                    <CardContent>
                      <List dense>
                        {detailPerformance.improvements.map((improvement, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={`• ${improvement}`} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>关闭</Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              handleCloseDetails();
              handleOpenDialog(detailPerformance);
            }}
          >
            编辑
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // 渲染绩效编辑对话框
  const renderEditDialog = () => {
    return (
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {selectedPerformance ? '编辑绩效评估' : '新建绩效评估'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>员工</InputLabel>
                <Select
                  value={formData.employeeId}
                  label="员工"
                  onChange={(e) => {
                    const employee = employees.find(emp => emp.id === e.target.value);
                    setFormData({
                      ...formData,
                      employeeId: e.target.value,
                      department: employee?.department || '',
                      position: employee?.position || '',
                    });
                  }}
                  disabled={Boolean(selectedPerformance)}
                >
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name} - {emp.position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>评估周期</InputLabel>
                <Select
                  value={formData.period}
                  label="评估周期"
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  disabled={Boolean(selectedPerformance)}
                >
                  {periods.map((period) => (
                    <MenuItem key={period} value={period}>{period}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                评分项目
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>领导力</InputLabel>
                <Select
                  value={formData.leadershipScore}
                  label="领导力"
                  onChange={(e) => setFormData({ ...formData, leadershipScore: e.target.value })}
                >
                  {scoreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>执行力</InputLabel>
                <Select
                  value={formData.executionScore}
                  label="执行力"
                  onChange={(e) => setFormData({ ...formData, executionScore: e.target.value })}
                >
                  {scoreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>创新力</InputLabel>
                <Select
                  value={formData.innovationScore}
                  label="创新力"
                  onChange={(e) => setFormData({ ...formData, innovationScore: e.target.value })}
                >
                  {scoreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>团队协作</InputLabel>
                <Select
                  value={formData.teamworkScore}
                  label="团队协作"
                  onChange={(e) => setFormData({ ...formData, teamworkScore: e.target.value })}
                >
                  {scoreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                绩效目标
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>目标名称</TableCell>
                      <TableCell>目标值</TableCell>
                      <TableCell>实际值</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell width="10%">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.goals.map((goal, index) => (
                      <TableRow key={goal.id}>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={goal.name}
                            onChange={(e) => handleUpdateGoal(index, 'name', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={goal.target}
                            onChange={(e) => handleUpdateGoal(index, 'target', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={goal.actual}
                            onChange={(e) => handleUpdateGoal(index, 'actual', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            fullWidth
                            size="small"
                            value={goal.status}
                            onChange={(e) => handleUpdateGoal(index, 'status', e.target.value)}
                          >
                            <MenuItem value="进行中">进行中</MenuItem>
                            <MenuItem value="部分完成">部分完成</MenuItem>
                            <MenuItem value="完成">完成</MenuItem>
                            <MenuItem value="超额完成">超额完成</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteGoal(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddGoal}
                size="small"
              >
                添加目标
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="绩效反馈"
                multiline
                rows={4}
                value={formData.feedback}
                onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                优势
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.strengths.map((strength, index) => (
                  <Chip
                    key={index}
                    label={strength}
                    onDelete={() => handleDeleteItem('strength', index)}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex' }}>
                <TextField
                  id="strength-input"
                  size="small"
                  placeholder="添加优势"
                  fullWidth
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('strength', e.target.value);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById('strength-input');
                    handleAddItem('strength', input.value);
                  }}
                >
                  添加
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                改进项
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.improvements.map((improvement, index) => (
                  <Chip
                    key={index}
                    label={improvement}
                    onDelete={() => handleDeleteItem('improvement', index)}
                    size="small"
                    color="primary"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex' }}>
                <TextField
                  id="improvement-input"
                  size="small"
                  placeholder="添加改进项"
                  fullWidth
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('improvement', e.target.value);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById('improvement-input');
                    handleAddItem('improvement', input.value);
                  }}
                >
                  添加
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>评估人</InputLabel>
                <Select
                  value={formData.reviewer}
                  label="评估人"
                  onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                >
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.name}>{emp.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>状态</InputLabel>
                <Select
                  value={formData.status}
                  label="状态"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="进行中">进行中</MenuItem>
                  <MenuItem value="已完成">已完成</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.employeeId || !formData.period}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">绩效管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          新建绩效评估
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="绩效管理选项卡">
          <Tab label="绩效概览" icon={<InsertChartIcon />} iconPosition="start" />
          <Tab label="评估记录" icon={<AssessmentIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {renderFilterBar()}

      {tabValue === 0 && (
        <Box>
          {renderScoreChart()}
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>最近绩效评估</Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>员工</TableCell>
                    <TableCell>部门</TableCell>
                    <TableCell>职位</TableCell>
                    <TableCell>评估周期</TableCell>
                    <TableCell>综合评分</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPerformances.slice(0, 5).map((performance) => (
                    <TableRow key={performance.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar src={performance.avatar} sx={{ mr: 1, width: 30, height: 30 }} />
                          {performance.employeeName}
                        </Box>
                      </TableCell>
                      <TableCell>{performance.department}</TableCell>
                      <TableCell>{performance.position}</TableCell>
                      <TableCell>{performance.period}</TableCell>
                      <TableCell>
                        <Rating
                          value={performance.overallScore}
                          precision={0.1}
                          readOnly
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={performance.status}
                          color={performance.status === '已完成' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="查看详情">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(performance)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>员工</TableCell>
                <TableCell>部门</TableCell>
                <TableCell>职位</TableCell>
                <TableCell>评估周期</TableCell>
                <TableCell>评分项目</TableCell>
                <TableCell>综合评分</TableCell>
                <TableCell>评估人</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPerformances.map((performance) => (
                <TableRow key={performance.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar src={performance.avatar} sx={{ mr: 1, width: 30, height: 30 }} />
                      {performance.employeeName}
                    </Box>
                  </TableCell>
                  <TableCell>{performance.department}</TableCell>
                  <TableCell>{performance.position}</TableCell>
                  <TableCell>{performance.period}</TableCell>
                  <TableCell>
                    <Box>
                      <Tooltip title="领导力">
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ width: 60 }}>领导力:</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={performance.leadershipScore * 20}
                            sx={{ flexGrow: 1, mr: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption">{performance.leadershipScore}</Typography>
                        </Box>
                      </Tooltip>
                      <Tooltip title="执行力">
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ width: 60 }}>执行力:</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={performance.executionScore * 20}
                            sx={{ flexGrow: 1, mr: 1, height: 6, borderRadius: 3 }}
                            color="secondary"
                          />
                          <Typography variant="caption">{performance.executionScore}</Typography>
                        </Box>
                      </Tooltip>
                      <Tooltip title="创新力">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ width: 60 }}>创新力:</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={performance.innovationScore * 20}
                            sx={{ flexGrow: 1, mr: 1, height: 6, borderRadius: 3 }}
                            color="success"
                          />
                          <Typography variant="caption">{performance.innovationScore}</Typography>
                        </Box>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Rating
                      value={performance.overallScore}
                      precision={0.1}
                      readOnly
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{performance.reviewer}</TableCell>
                  <TableCell>
                    <Chip
                      label={performance.status}
                      color={performance.status === '已完成' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="查看详情">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(performance)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(performance)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 绩效详情对话框 */}
      {renderPerformanceDetailDialog()}
      
      {/* 绩效编辑对话框 */}
      {renderEditDialog()}
    </Box>
  );
}

export default PerformanceManagement; 