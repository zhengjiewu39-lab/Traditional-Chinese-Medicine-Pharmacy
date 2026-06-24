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
  Avatar,
  Tooltip,
  InputAdornment,
  Card,
  CardHeader,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  PersonPin as PersonPinIcon,
  LocationOn as LocationIcon,
  Event as EventIcon,
  School as SchoolIcon,
  SupervisorAccount as SupervisorIcon,
  Visibility as VisibilityIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';

// 模拟员工数据
const initialEmployees = [
  {
    id: '1',
    name: '张三',
    gender: '男',
    department: '总部',
    position: '总经理',
    phone: '13800138001',
    email: 'zhangsan@example.com',
    address: '北京市朝阳区',
    joinDate: '2010-01-15',
    education: '硕士',
    salary: 18000,
    supervisor: '',
    status: '在职',
    skills: ['中药调剂', '中药鉴别', '中医诊断'],
    certifications: ['执业药师', '中药师'],
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: '2',
    name: '李四',
    gender: '男',
    department: '采购部',
    position: '采购经理',
    phone: '13800138002',
    email: 'lisi@example.com',
    address: '北京市海淀区',
    joinDate: '2010-03-20',
    education: '本科',
    salary: 12000,
    supervisor: '张三',
    status: '在职',
    skills: ['中药采购', '供应链管理', '中药鉴别'],
    certifications: ['采购师'],
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    id: '3',
    name: '王五',
    gender: '男',
    department: '销售部',
    position: '销售总监',
    phone: '13800138003',
    email: 'wangwu@example.com',
    address: '北京市西城区',
    joinDate: '2010-02-18',
    education: '本科',
    salary: 15000,
    supervisor: '张三',
    status: '在职',
    skills: ['销售管理', '客户关系', '团队管理'],
    certifications: ['营销师'],
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
  },
  {
    id: '4',
    name: '赵六',
    gender: '男',
    department: '质量部',
    position: '质量经理',
    phone: '13800138004',
    email: 'zhaoliu@example.com',
    address: '北京市东城区',
    joinDate: '2010-05-12',
    education: '博士',
    salary: 14000,
    supervisor: '张三',
    status: '在职',
    skills: ['质量控制', '中药检测', 'GMP标准'],
    certifications: ['质量工程师', '执业药师'],
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
  },
  {
    id: '5',
    name: '钱七',
    gender: '女',
    department: '采购部',
    position: '采购专员',
    phone: '13800138005',
    email: 'qianqi@example.com',
    address: '北京市朝阳区',
    joinDate: '2011-04-10',
    education: '本科',
    salary: 8000,
    supervisor: '李四',
    status: '在职',
    skills: ['中药采购', '价格谈判', '库存管理'],
    certifications: ['初级采购师'],
    avatar: 'https://randomuser.me/api/portraits/women/5.jpg',
  },
  {
    id: '6',
    name: '孙八',
    gender: '女',
    department: '销售部',
    position: '销售主管',
    phone: '13800138006',
    email: 'sunba@example.com',
    address: '北京市丰台区',
    joinDate: '2012-07-01',
    education: '本科',
    salary: 10000,
    supervisor: '王五',
    status: '在职',
    skills: ['销售策略', '团队管理', '客户开发'],
    certifications: ['助理营销师'],
    avatar: 'https://randomuser.me/api/portraits/women/6.jpg',
  },
  {
    id: '7',
    name: '周九',
    gender: '男',
    department: '北京分部',
    position: '分部经理',
    phone: '13800138007',
    email: 'zhoujiu@example.com',
    address: '北京市海淀区',
    joinDate: '2011-06-22',
    education: '硕士',
    salary: 16000,
    supervisor: '张三',
    status: '在职',
    skills: ['区域管理', '运营管理', '团队领导'],
    certifications: ['执业药师', '企业管理师'],
    avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
  },
  {
    id: '8',
    name: '吴十',
    gender: '女',
    department: '质量部',
    position: '质检员',
    phone: '13800138008',
    email: 'wushi@example.com',
    address: '北京市朝阳区',
    joinDate: '2014-03-18',
    education: '硕士',
    salary: 9000,
    supervisor: '赵六',
    status: '在职',
    skills: ['药品检验', '实验室技术', '文档管理'],
    certifications: ['药品检验师'],
    avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
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

// 职位数据
const positions = [
  '总经理',
  '副总经理',
  '部门经理',
  '采购经理',
  '采购专员',
  '销售总监',
  '销售主管',
  '销售代表',
  '质量经理',
  '质检员',
  '分部经理',
  '药师',
  '财务经理',
  '会计',
  '出纳',
  '人力资源主管',
  '行政专员',
];

function PersonnelManagement() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    department: '',
    position: '',
    phone: '',
    email: '',
    address: '',
    joinDate: '',
    education: '',
    salary: '',
    supervisor: '',
    status: '在职',
    skills: [],
    certifications: [],
    avatar: '',
  });

  // 处理搜索
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const filteredEmployees = employees.filter(employee => {
    return (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // 打开对话框
  const handleOpenDialog = (employee) => {
    if (employee) {
      setSelectedEmployee(employee);
      setFormData({ ...employee });
    } else {
      setSelectedEmployee(null);
      setFormData({
        name: '',
        gender: '',
        department: '',
        position: '',
        phone: '',
        email: '',
        address: '',
        joinDate: '',
        education: '',
        salary: '',
        supervisor: '',
        status: '在职',
        skills: [],
        certifications: [],
        avatar: '',
      });
    }
    setOpenDialog(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedEmployee(null);
  };

  // 提交表单
  const handleSubmit = () => {
    if (selectedEmployee) {
      // 更新员工
      const updatedEmployees = employees.map(emp => {
        if (emp.id === selectedEmployee.id) {
          return { ...formData };
        }
        return emp;
      });
      setEmployees(updatedEmployees);
      if (detailEmployee && detailEmployee.id === selectedEmployee.id) {
        setDetailEmployee({ ...formData });
      }
    } else {
      // 添加新员工
      const newEmployee = {
        id: Date.now().toString(),
        ...formData,
      };
      setEmployees([...employees, newEmployee]);
    }
    handleCloseDialog();
  };

  // 删除员工
  const handleDeleteEmployee = (id) => {
    if (window.confirm('确定要删除该员工吗？')) {
      const updatedEmployees = employees.filter(emp => emp.id !== id);
      setEmployees(updatedEmployees);
      if (detailEmployee && detailEmployee.id === id) {
        setDetailEmployee(null);
      }
    }
  };

  // 显示员工详情
  const handleShowDetails = (employee) => {
    setDetailEmployee(employee);
  };

  // 关闭详情面板
  const handleCloseDetails = () => {
    setDetailEmployee(null);
  };

  // 添加技能
  const handleAddSkill = (event) => {
    if (event.key === 'Enter' && event.target.value.trim() !== '') {
      const skill = event.target.value.trim();
      if (!formData.skills.includes(skill)) {
        setFormData({
          ...formData,
          skills: [...formData.skills, skill],
        });
      }
      event.target.value = '';
    }
  };

  // 删除技能
  const handleDeleteSkill = (skillToDelete) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(skill => skill !== skillToDelete),
    });
  };

  // 添加证书
  const handleAddCertification = (event) => {
    if (event.key === 'Enter' && event.target.value.trim() !== '') {
      const certification = event.target.value.trim();
      if (!formData.certifications.includes(certification)) {
        setFormData({
          ...formData,
          certifications: [...formData.certifications, certification],
        });
      }
      event.target.value = '';
    }
  };

  // 删除证书
  const handleDeleteCertification = (certToDelete) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter(cert => cert !== certToDelete),
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">人员管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加员工
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜索员工（姓名、部门、职位、状态）"
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
        <Grid item xs={12} md={detailEmployee ? 8 : 12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>姓名</TableCell>
                  <TableCell>部门</TableCell>
                  <TableCell>职位</TableCell>
                  <TableCell>联系方式</TableCell>
                  <TableCell>入职日期</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar src={employee.avatar} sx={{ mr: 1, width: 30, height: 30 }} />
                        {employee.name}
                      </Box>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <Tooltip title={`电话: ${employee.phone}`}>
                        <IconButton size="small">
                          <PhoneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`邮箱: ${employee.email}`}>
                        <IconButton size="small">
                          <EmailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{employee.joinDate}</TableCell>
                    <TableCell>
                      <Chip
                        label={employee.status}
                        color={employee.status === '在职' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => handleShowDetails(employee)}
                          color="info"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(employee)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEmployee(employee.id)}
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

        {detailEmployee && (
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader 
                title="员工详情" 
                action={
                  <IconButton onClick={handleCloseDetails}>
                    <VisibilityIcon />
                  </IconButton>
                }
              />
              <Divider />
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <Avatar
                    src={detailEmployee.avatar}
                    sx={{ width: 100, height: 100, mb: 2 }}
                  />
                  <Typography variant="h6">{detailEmployee.name}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {detailEmployee.position} @ {detailEmployee.department}
                  </Typography>
                </Box>

                <List dense>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <PersonPinIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="性别"
                      secondary={detailEmployee.gender}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <PhoneIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="联系电话"
                      secondary={detailEmployee.phone}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <EmailIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="电子邮箱"
                      secondary={detailEmployee.email}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <LocationIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="地址"
                      secondary={detailEmployee.address}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <EventIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="入职日期"
                      secondary={detailEmployee.joinDate}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <SchoolIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="学历"
                      secondary={detailEmployee.education}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <BadgeIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="薪资"
                      secondary={`¥${detailEmployee.salary}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <SupervisorIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="直接上级"
                      secondary={detailEmployee.supervisor || '无'}
                    />
                  </ListItem>
                </List>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>专业技能</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {detailEmployee.skills.map((skill, index) => (
                      <Chip key={index} label={skill} size="small" />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>资格证书</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {detailEmployee.certifications.map((cert, index) => (
                      <Chip key={index} label={cert} color="primary" size="small" />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button 
                    variant="contained" 
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(detailEmployee)}
                    fullWidth
                  >
                    编辑员工信息
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedEmployee ? '编辑员工' : '添加员工'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="姓名"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>性别</InputLabel>
                <Select
                  value={formData.gender}
                  label="性别"
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <MenuItem value="男">男</MenuItem>
                  <MenuItem value="女">女</MenuItem>
                </Select>
              </FormControl>
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>职位</InputLabel>
                <Select
                  value={formData.position}
                  label="职位"
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                  {positions.map((pos) => (
                    <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="电话"
                fullWidth
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="邮箱"
                fullWidth
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="地址"
                fullWidth
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="入职日期"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>学历</InputLabel>
                <Select
                  value={formData.education}
                  label="学历"
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                >
                  <MenuItem value="高中">高中</MenuItem>
                  <MenuItem value="专科">专科</MenuItem>
                  <MenuItem value="本科">本科</MenuItem>
                  <MenuItem value="硕士">硕士</MenuItem>
                  <MenuItem value="博士">博士</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="薪资"
                type="number"
                fullWidth
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>直接上级</InputLabel>
                <Select
                  value={formData.supervisor}
                  label="直接上级"
                  onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                >
                  <MenuItem value="">无</MenuItem>
                  {employees
                    .filter(emp => emp.id !== (selectedEmployee?.id || ''))
                    .map((emp) => (
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
                  <MenuItem value="在职">在职</MenuItem>
                  <MenuItem value="离职">离职</MenuItem>
                  <MenuItem value="休假">休假</MenuItem>
                  <MenuItem value="实习">实习</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="头像URL"
                fullWidth
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                专业技能 (输入后按回车添加)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.skills.map((skill, index) => (
                  <Chip
                    key={index}
                    label={skill}
                    onDelete={() => handleDeleteSkill(skill)}
                    size="small"
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                placeholder="添加技能"
                onKeyDown={handleAddSkill}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                资格证书 (输入后按回车添加)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.certifications.map((cert, index) => (
                  <Chip
                    key={index}
                    label={cert}
                    onDelete={() => handleDeleteCertification(cert)}
                    color="primary"
                    size="small"
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                placeholder="添加证书"
                onKeyDown={handleAddCertification}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonnelManagement; 