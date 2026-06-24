import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  CreditCard,
  Cake,
  LocalActivity,
  Mail,
  Phone,
  RecentActors,
  Discount,
  People,
  TrendingUp,
  CardGiftcard,
} from '@mui/icons-material';

// 模拟会员数据
const initialMembers = [
  {
    id: 1,
    name: '张三',
    level: '金卡',
    points: 1250,
    phone: '13800138001',
    email: 'zhangsan@example.com',
    registrationDate: '2022-05-15',
    lastVisit: '2023-05-10',
    totalSpending: 5680,
    birthdate: '1980-06-12',
    address: '北京市海淀区中关村大街1号',
    status: '活跃',
  },
  {
    id: 2,
    name: '李四',
    level: '银卡',
    points: 780,
    phone: '13900139002',
    email: 'lisi@example.com',
    registrationDate: '2022-08-20',
    lastVisit: '2023-05-08',
    totalSpending: 3250,
    birthdate: '1985-09-25',
    address: '北京市朝阳区建国路2号',
    status: '活跃',
  },
  {
    id: 3,
    name: '王五',
    level: '钻石卡',
    points: 3850,
    phone: '13700137003',
    email: 'wangwu@example.com',
    registrationDate: '2021-03-10',
    lastVisit: '2023-05-12',
    totalSpending: 12680,
    birthdate: '1975-03-18',
    address: '北京市西城区西长安街3号',
    status: '活跃',
  },
  {
    id: 4,
    name: '赵六',
    level: '普通卡',
    points: 350,
    phone: '13600136004',
    email: 'zhaoliu@example.com',
    registrationDate: '2023-01-05',
    lastVisit: '2023-04-22',
    totalSpending: 1280,
    birthdate: '1990-11-30',
    address: '北京市丰台区丰台路4号',
    status: '活跃',
  },
  {
    id: 5,
    name: '钱七',
    level: '银卡',
    points: 620,
    phone: '13500135005',
    email: 'qianqi@example.com',
    registrationDate: '2022-10-18',
    lastVisit: '2023-03-15',
    totalSpending: 2950,
    birthdate: '1988-07-22',
    address: '北京市通州区通州路5号',
    status: '不活跃',
  },
];

// 模拟促销活动数据
const promotions = [
  {
    id: 1,
    title: '新客7折优惠',
    description: '新会员首次购买7折优惠',
    startDate: '2023-05-01',
    endDate: '2023-06-30',
    targetLevel: '所有等级',
    discount: '30%',
    status: '进行中',
  },
  {
    id: 2,
    title: '生日特惠',
    description: '会员生日当月购买享8折优惠',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    targetLevel: '所有等级',
    discount: '20%',
    status: '进行中',
  },
  {
    id: 3,
    title: '钻石会员专享',
    description: '钻石会员专享85折',
    startDate: '2023-04-15',
    endDate: '2023-07-15',
    targetLevel: '钻石卡',
    discount: '15%',
    status: '进行中',
  },
  {
    id: 4,
    title: '充值赠送',
    description: '充值满1000元赠送200积分',
    startDate: '2023-05-10',
    endDate: '2023-06-10',
    targetLevel: '银卡及以上',
    discount: '积分赠送',
    status: '进行中',
  },
  {
    id: 5,
    title: '秋季大促',
    description: '所有保健品8.5折',
    startDate: '2023-09-01',
    endDate: '2023-10-31',
    targetLevel: '所有等级',
    discount: '15%',
    status: '未开始',
  },
];

function MembershipManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [members, setMembers] = useState(initialMembers);
  const [filteredMembers, setFilteredMembers] = useState(initialMembers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearch = (event) => {
    const term = event.target.value;
    setSearchTerm(term);
    
    const filtered = members.filter(member => 
      member.name.toLowerCase().includes(term.toLowerCase()) || 
      member.phone.includes(term) ||
      member.email.toLowerCase().includes(term.toLowerCase())
    );
    
    setFilteredMembers(filtered);
  };

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // 获取各等级会员数量
  const memberLevelStats = members.reduce((stats, member) => {
    stats[member.level] = (stats[member.level] || 0) + 1;
    return stats;
  }, {});

  // 计算会员总数
  const totalMembers = members.length;
  
  // 计算活跃会员
  const activeMembers = members.filter(member => member.status === '活跃').length;

  // 计算新会员（最近30天注册）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newMembers = members.filter(member => {
    const regDate = new Date(member.registrationDate);
    return regDate >= thirtyDaysAgo;
  }).length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="div" sx={{ mb: 4 }}>
        会员管理
      </Typography>

      <Paper sx={{ mb: 4 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label="会员总览" icon={<RecentActors />} iconPosition="start" />
          <Tab label="会员列表" icon={<People />} iconPosition="start" />
          <Tab label="促销活动" icon={<Discount />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* 会员总览 */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  会员总数
                </Typography>
                <Typography variant="h4">
                  {totalMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  较上月增长 5%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  活跃会员
                </Typography>
                <Typography variant="h4">
                  {activeMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  活跃率 {Math.round((activeMembers / totalMembers) * 100)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  新增会员
                </Typography>
                <Typography variant="h4">
                  {newMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  最近30天
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  促销活动
                </Typography>
                <Typography variant="h4">
                  {promotions.filter(p => p.status === '进行中').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  当前进行中
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  会员等级分布
                </Typography>
                <List>
                  {Object.entries(memberLevelStats).map(([level, count]) => (
                    <ListItem key={level} divider>
                      <ListItemText 
                        primary={level} 
                        secondary={`${count}人 (${Math.round((count / totalMembers) * 100)}%)`} 
                      />
                      <Chip 
                        label={count} 
                        color={
                          level === '钻石卡' ? 'secondary' :
                          level === '金卡' ? 'primary' :
                          level === '银卡' ? 'success' : 'default'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  近期活动
                </Typography>
                <List>
                  {promotions.slice(0, 3).map(promotion => (
                    <ListItem key={promotion.id} divider>
                      <ListItemText 
                        primary={promotion.title} 
                        secondary={`${promotion.startDate} 至 ${promotion.endDate}`} 
                      />
                      <Chip 
                        label={promotion.status} 
                        color={promotion.status === '进行中' ? 'success' : 'warning'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    size="small" 
                    onClick={() => setTabValue(2)}
                    endIcon={<CardGiftcard />}
                  >
                    查看全部活动
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                会员增长趋势
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  过去12个月会员增长率稳定，平均每月增长5.2%。
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                通过"新客7折优惠"活动带来的新会员转化率提升了15%。
                生日特惠活动的会员参与率达到62%，是最受欢迎的促销活动。
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 会员列表 */}
      {tabValue === 1 && (
        <>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
            <TextField
              label="搜索会员"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={handleSearch}
              sx={{ width: '300px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
            >
              添加会员
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>姓名</TableCell>
                  <TableCell>会员等级</TableCell>
                  <TableCell>积分</TableCell>
                  <TableCell>联系电话</TableCell>
                  <TableCell>最近访问</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.id}</TableCell>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={member.level} 
                        size="small"
                        color={
                          member.level === '钻石卡' ? 'secondary' :
                          member.level === '金卡' ? 'primary' :
                          member.level === '银卡' ? 'success' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{member.points}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>{member.lastVisit}</TableCell>
                    <TableCell>
                      <Chip 
                        label={member.status} 
                        size="small"
                        color={member.status === '活跃' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handleSelectMember(member)}
                      >
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* 促销活动 */}
      {tabValue === 2 && (
        <>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
            >
              添加促销活动
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>活动名称</TableCell>
                  <TableCell>开始日期</TableCell>
                  <TableCell>结束日期</TableCell>
                  <TableCell>适用会员</TableCell>
                  <TableCell>优惠</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {promotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {promotion.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {promotion.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{promotion.startDate}</TableCell>
                    <TableCell>{promotion.endDate}</TableCell>
                    <TableCell>{promotion.targetLevel}</TableCell>
                    <TableCell>{promotion.discount}</TableCell>
                    <TableCell>
                      <Chip 
                        label={promotion.status} 
                        size="small"
                        color={promotion.status === '进行中' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<Edit />}
                      >
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* 会员详情对话框 */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedMember && (
          <>
            <DialogTitle>
              会员详细信息 - {selectedMember.name}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    基本信息
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="会员ID" secondary={selectedMember.id} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="姓名" secondary={selectedMember.name} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="会员等级" secondary={selectedMember.level} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="积分" secondary={selectedMember.points} />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="注册日期" 
                        secondary={selectedMember.registrationDate} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="总消费" 
                        secondary={`¥${selectedMember.totalSpending.toFixed(2)}`} 
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    联系方式
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Phone fontSize="small" sx={{ mr: 1 }} />
                            电话
                          </Box>
                        } 
                        secondary={selectedMember.phone} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Mail fontSize="small" sx={{ mr: 1 }} />
                            邮箱
                          </Box>
                        } 
                        secondary={selectedMember.email} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Cake fontSize="small" sx={{ mr: 1 }} />
                            生日
                          </Box>
                        } 
                        secondary={selectedMember.birthdate} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="地址" secondary={selectedMember.address} />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="最近访问" 
                        secondary={selectedMember.lastVisit} 
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>关闭</Button>
              <Button variant="outlined" startIcon={<LocalActivity />}>
                管理积分
              </Button>
              <Button variant="outlined" startIcon={<CreditCard />}>
                办理会员卡
              </Button>
              <Button variant="contained" color="primary" startIcon={<Edit />}>
                编辑信息
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default MembershipManagement; 