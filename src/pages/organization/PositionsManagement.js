import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Grid,
  Chip,
  Card,
  CardHeader,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  InputAdornment,
  FormHelperText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  Assignment as AssignmentIcon,
  PersonPin as PersonPinIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  ListAlt as ListAltIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

// 模拟职位数据
const initialPositions = [
  {
    id: '1',
    title: '总经理',
    department: '总部',
    description: '负责公司整体运营和战略决策，制定公司发展方向并监督各部门运作。',
    salaryMin: 15000,
    salaryMax: 25000,
    requirements: [
      '医药相关专业硕士以上学历',
      '10年以上医药行业管理经验',
      '具备执业药师资格',
      '良好的领导能力和决策能力',
      '熟悉医药行业法规和政策'
    ],
    responsibilities: [
      '制定公司战略发展规划',
      '监督各部门运营状况',
      '代表公司与外部机构沟通合作',
      '审批重大决策和投资计划',
      '负责公司整体绩效管理'
    ],
    level: 1,
    status: '招聘中',
    headcount: 1,
    currentEmployees: ['张三']
  },
  {
    id: '2',
    title: '采购经理',
    department: '采购部',
    description: '负责中药材和药品的采购流程管理，包括供应商选择、价格谈判、质量控制等工作。',
    salaryMin: 10000,
    salaryMax: 15000,
    requirements: [
      '药学相关专业本科以上学历',
      '5年以上中药采购经验',
      '熟悉中药材市场行情',
      '良好的谈判能力和供应链管理能力',
      '具备中药鉴别专业知识'
    ],
    responsibilities: [
      '制定采购计划和策略',
      '管理供应商关系',
      '确保采购药材质量',
      '控制采购成本',
      '优化库存管理'
    ],
    level: 2,
    status: '已满',
    headcount: 1,
    currentEmployees: ['李四']
  },
  {
    id: '3',
    title: '销售总监',
    department: '销售部',
    description: '负责制定销售策略，管理销售团队，达成销售目标，拓展市场渠道。',
    salaryMin: 12000,
    salaryMax: 18000,
    requirements: [
      '市场营销或相关专业本科以上学历',
      '8年以上医药销售管理经验',
      '优秀的团队领导能力',
      '出色的客户关系维护能力',
      '市场洞察力强'
    ],
    responsibilities: [
      '制定销售目标和策略',
      '领导销售团队开发新客户',
      '分析市场趋势和竞争对手',
      '提升产品市场占有率',
      '定期报告销售业绩'
    ],
    level: 2,
    status: '已满',
    headcount: 1,
    currentEmployees: ['王五']
  },
  {
    id: '4',
    title: '质量经理',
    department: '质量部',
    description: '负责药品质量控制和检测，确保产品符合相关标准和法规要求。',
    salaryMin: 11000,
    salaryMax: 16000,
    requirements: [
      '药学或相关专业硕士以上学历',
      '执业药师资格',
      '5年以上药品质量管理经验',
      '熟悉GMP标准和药品质量法规',
      '具备实验室检测技能'
    ],
    responsibilities: [
      '制定质量控制标准和流程',
      '监督药品生产和检验过程',
      '处理产品质量问题',
      '确保符合行业法规要求',
      '持续改进质量管理体系'
    ],
    level: 2,
    status: '已满',
    headcount: 1,
    currentEmployees: ['赵六']
  },
  {
    id: '5',
    title: '采购专员',
    department: '采购部',
    description: '协助采购经理进行日常采购活动，负责供应商沟通和采购订单管理。',
    salaryMin: 6000,
    salaryMax: 9000,
    requirements: [
      '药学或相关专业本科学历',
      '2年以上采购相关工作经验',
      '了解中药材基本知识',
      '良好的沟通能力和组织能力',
      '熟练使用办公软件'
    ],
    responsibilities: [
      '执行日常采购计划',
      '与供应商进行沟通和谈判',
      '跟踪采购订单状态',
      '管理采购文档和记录',
      '协助进行市场调研'
    ],
    level: 4,
    status: '招聘中',
    headcount: 3,
    currentEmployees: ['钱七']
  },
  {
    id: '6',
    title: '销售主管',
    department: '销售部',
    description: '负责区域销售团队管理，客户开发和维护，达成销售目标。',
    salaryMin: 8000,
    salaryMax: 12000,
    requirements: [
      '市场营销或相关专业本科学历',
      '3年以上医药销售经验',
      '良好的团队管理能力',
      '优秀的谈判和沟通能力',
      '具备客户开发能力'
    ],
    responsibilities: [
      '管理区域销售团队',
      '开发和维护重要客户',
      '达成区域销售目标',
      '收集市场信息和客户反馈',
      '培训销售人员'
    ],
    level: 3,
    status: '已满',
    headcount: 2,
    currentEmployees: ['孙八']
  },
  {
    id: '7',
    title: '分部经理',
    department: '北京分部',
    description: '负责分部整体运营管理，包括销售、运营、客户服务等工作的协调。',
    salaryMin: 13000,
    salaryMax: 18000,
    requirements: [
      '医药或管理相关专业本科以上学历',
      '5年以上医药零售管理经验',
      '良好的综合管理能力',
      '熟悉当地医药市场',
      '具备连锁药店运营经验'
    ],
    responsibilities: [
      '负责分部日常运营管理',
      '制定并执行分部销售计划',
      '管理当地团队和门店',
      '维护与当地监管机构关系',
      '确保分部运营合规及盈利'
    ],
    level: 2,
    status: '已满',
    headcount: 1,
    currentEmployees: ['周九']
  },
  {
    id: '8',
    title: '质检员',
    department: '质量部',
    description: '负责药品质量检验，编写检验报告，确保产品质量符合标准。',
    salaryMin: 7000,
    salaryMax: 10000,
    requirements: [
      '药学或相关专业本科学历',
      '2年以上药品检验经验',
      '熟悉药品检验流程和标准',
      '了解相关质量法规',
      '具备实验操作技能'
    ],
    responsibilities: [
      '执行药品质量检验工作',
      '记录和整理检验数据',
      '编写检验报告',
      '参与制定质量标准',
      '协助处理质量问题'
    ],
    level: 4,
    status: '招聘中',
    headcount: 3,
    currentEmployees: ['吴十']
  },
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

// 职位等级
const positionLevels = [
  { value: 1, label: '高级管理层' },
  { value: 2, label: '部门管理层' },
  { value: 3, label: '中层管理者' },
  { value: 4, label: '普通员工' },
  { value: 5, label: '实习/助理' },
];

function PositionsManagement() {
  const [positions, setPositions] = useState(initialPositions);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailPosition, setDetailPosition] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    salaryMin: 0,
    salaryMax: 0,
    requirements: [],
    responsibilities: [],
    level: 4,
    status: '招聘中',
    headcount: 1,
    currentEmployees: [],
  });

  // 处理搜索
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const filteredPositions = positions.filter(position => {
    return (
      position.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // 打开对话框
  const handleOpenDialog = (position) => {
    if (position) {
      setSelectedPosition(position);
      setFormData({ ...position });
    } else {
      setSelectedPosition(null);
      setFormData({
        title: '',
        department: '',
        description: '',
        salaryMin: 0,
        salaryMax: 0,
        requirements: [],
        responsibilities: [],
        level: 4,
        status: '招聘中',
        headcount: 1,
        currentEmployees: [],
      });
    }
    setOpenDialog(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPosition(null);
  };

  // 提交表单
  const handleSubmit = () => {
    if (selectedPosition) {
      // 更新职位
      const updatedPositions = positions.map(pos => {
        if (pos.id === selectedPosition.id) {
          return { ...formData };
        }
        return pos;
      });
      setPositions(updatedPositions);
      if (detailPosition && detailPosition.id === selectedPosition.id) {
        setDetailPosition({ ...formData });
      }
    } else {
      // 添加新职位
      const newPosition = {
        id: Date.now().toString(),
        ...formData,
      };
      setPositions([...positions, newPosition]);
    }
    handleCloseDialog();
  };

  // 删除职位
  const handleDeletePosition = (id) => {
    if (window.confirm('确定要删除该职位吗？')) {
      const updatedPositions = positions.filter(pos => pos.id !== id);
      setPositions(updatedPositions);
      if (detailPosition && detailPosition.id === id) {
        setDetailPosition(null);
      }
    }
  };

  // 显示职位详情
  const handleShowDetails = (position) => {
    setDetailPosition(position);
  };

  // 关闭详情面板
  const handleCloseDetails = () => {
    setDetailPosition(null);
  };

  // 添加要求
  const handleAddRequirement = (event) => {
    if (event.key === 'Enter' && event.target.value.trim() !== '') {
      const requirement = event.target.value.trim();
      if (!formData.requirements.includes(requirement)) {
        setFormData({
          ...formData,
          requirements: [...formData.requirements, requirement],
        });
      }
      event.target.value = '';
    }
  };

  // 删除要求
  const handleDeleteRequirement = (reqToDelete) => {
    setFormData({
      ...formData,
      requirements: formData.requirements.filter(req => req !== reqToDelete),
    });
  };

  // 添加职责
  const handleAddResponsibility = (event) => {
    if (event.key === 'Enter' && event.target.value.trim() !== '') {
      const responsibility = event.target.value.trim();
      if (!formData.responsibilities.includes(responsibility)) {
        setFormData({
          ...formData,
          responsibilities: [...formData.responsibilities, responsibility],
        });
      }
      event.target.value = '';
    }
  };

  // 删除职责
  const handleDeleteResponsibility = (respToDelete) => {
    setFormData({
      ...formData,
      responsibilities: formData.responsibilities.filter(resp => resp !== respToDelete),
    });
  };

  // 获取职位等级文本
  const getLevelText = (level) => {
    const levelObj = positionLevels.find(l => l.value === level);
    return levelObj ? levelObj.label : '未知';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">职位管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加职位
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜索职位（职位名称、部门、状态）"
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
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={detailPosition ? 8 : 12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>职位名称</TableCell>
                  <TableCell>部门</TableCell>
                  <TableCell>薪资范围</TableCell>
                  <TableCell>级别</TableCell>
                  <TableCell>编制/现有</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPositions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>{position.title}</TableCell>
                    <TableCell>{position.department}</TableCell>
                    <TableCell>{`¥${position.salaryMin} - ¥${position.salaryMax}`}</TableCell>
                    <TableCell>{getLevelText(position.level)}</TableCell>
                    <TableCell>{`${position.currentEmployees.length}/${position.headcount}`}</TableCell>
                    <TableCell>
                      <Chip
                        label={position.status}
                        color={position.status === '招聘中' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => handleShowDetails(position)}
                          color="info"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(position)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePosition(position.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {detailPosition && (
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader 
                title="职位详情" 
                action={
                  <IconButton onClick={handleCloseDetails}>
                    <VisibilityIcon />
                  </IconButton>
                }
              />
              <Divider />
              <CardContent>
                <Typography variant="h6" gutterBottom>{detailPosition.title}</Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  {detailPosition.department}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <Chip
                    icon={<MoneyIcon />}
                    label={`薪资: ¥${detailPosition.salaryMin} - ¥${detailPosition.salaryMax}`}
                    color="primary"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    icon={<WorkIcon />}
                    label={`级别: ${getLevelText(detailPosition.level)}`}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={`状态: ${detailPosition.status}`}
                    color={detailPosition.status === '招聘中' ? 'success' : 'default'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>

                <Typography variant="body2" sx={{ mt: 2 }}>
                  {detailPosition.description}
                </Typography>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <AssignmentIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                    职位要求
                  </Typography>
                  <List dense>
                    {detailPosition.requirements.map((req, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={`• ${req}`} />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <ListAltIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                    工作职责
                  </Typography>
                  <List dense>
                    {detailPosition.responsibilities.map((resp, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={`• ${resp}`} />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {detailPosition.currentEmployees.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      <PersonPinIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                      在职人员 ({detailPosition.currentEmployees.length}/{detailPosition.headcount})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {detailPosition.currentEmployees.map((emp, index) => (
                        <Chip key={index} label={emp} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box sx={{ mt: 3 }}>
                  <Button 
                    variant="contained" 
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(detailPosition)}
                    fullWidth
                  >
                    编辑职位
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedPosition ? '编辑职位' : '添加职位'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="职位名称"
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>部门</InputLabel>
                <Select
                  value={formData.department}
                  label="部门"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="职位描述"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="最低薪资"
                type="number"
                fullWidth
                value={formData.salaryMin}
                onChange={(e) => setFormData({ ...formData, salaryMin: Number(e.target.value) })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="最高薪资"
                type="number"
                fullWidth
                value={formData.salaryMax}
                onChange={(e) => setFormData({ ...formData, salaryMax: Number(e.target.value) })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
                error={formData.salaryMax < formData.salaryMin}
                helperText={formData.salaryMax < formData.salaryMin ? "最高薪资不能低于最低薪资" : ""}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>职位级别</InputLabel>
                <Select
                  value={formData.level}
                  label="职位级别"
                  onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                >
                  {positionLevels.map((level) => (
                    <MenuItem key={level.value} value={level.value}>{level.label}</MenuItem>
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
                  <MenuItem value="招聘中">招聘中</MenuItem>
                  <MenuItem value="已满">已满</MenuItem>
                  <MenuItem value="暂停招聘">暂停招聘</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="编制人数"
                type="number"
                fullWidth
                value={formData.headcount}
                onChange={(e) => setFormData({ ...formData, headcount: Number(e.target.value) })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="现有人员 (逗号分隔)"
                fullWidth
                value={formData.currentEmployees.join(',')}
                onChange={(e) => setFormData({
                  ...formData,
                  currentEmployees: e.target.value ? e.target.value.split(',').map(item => item.trim()) : []
                })}
                error={formData.currentEmployees.length > formData.headcount}
                helperText={formData.currentEmployees.length > formData.headcount ? "人员数量超过编制" : ""}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                职位要求 (输入后按回车添加)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.requirements.map((req, index) => (
                  <Chip
                    key={index}
                    label={req}
                    onDelete={() => handleDeleteRequirement(req)}
                    size="small"
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                placeholder="添加要求"
                onKeyDown={handleAddRequirement}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                工作职责 (输入后按回车添加)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.responsibilities.map((resp, index) => (
                  <Chip
                    key={index}
                    label={resp}
                    onDelete={() => handleDeleteResponsibility(resp)}
                    color="primary"
                    size="small"
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                placeholder="添加职责"
                onKeyDown={handleAddResponsibility}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={formData.salaryMax < formData.salaryMin || formData.currentEmployees.length > formData.headcount}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PositionsManagement; 