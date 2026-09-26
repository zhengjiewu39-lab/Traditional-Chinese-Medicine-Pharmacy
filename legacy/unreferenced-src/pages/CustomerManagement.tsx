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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Customer {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  phone: string;
  email: string;
  address: string;
  memberLevel: 'regular' | 'silver' | 'gold' | 'platinum';
  totalSpent: number;
  lastPurchase: string;
  purchaseCount: number;
}

interface PurchaseRecord {
  id: string;
  customerId: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  paymentMethod: string;
}

const initialCustomers: Customer[] = [
  {
    id: 'CUST001',
    name: '张三',
    gender: 'male',
    age: 45,
    phone: '13800138000',
    email: 'zhangsan@example.com',
    address: '北京市朝阳区建国路88号',
    memberLevel: 'gold',
    totalSpent: 15000,
    lastPurchase: '2024-03-15',
    purchaseCount: 12,
  },
  {
    id: 'CUST002',
    name: '李四',
    gender: 'female',
    age: 35,
    phone: '13900139000',
    email: 'lisi@example.com',
    address: '上海市浦东新区陆家嘴1号',
    memberLevel: 'platinum',
    totalSpent: 25000,
    lastPurchase: '2024-03-14',
    purchaseCount: 20,
  },
];

const purchaseRecords: PurchaseRecord[] = [
  {
    id: 'PUR001',
    customerId: 'CUST001',
    date: '2024-03-15',
    items: [
      { name: '人参', quantity: 2, price: 500 },
      { name: '当归', quantity: 3, price: 93.33 },
    ],
    totalAmount: 1280,
    paymentMethod: '微信支付',
  },
  {
    id: 'PUR002',
    customerId: 'CUST002',
    date: '2024-03-14',
    items: [
      { name: '黄芪', quantity: 4, price: 140 },
    ],
    totalAmount: 560,
    paymentMethod: '支付宝',
  },
];

const memberLevelColors = {
  regular: 'default',
  silver: 'info',
  gold: 'warning',
  platinum: 'success',
} as const;

const memberLevelLabels = {
  regular: '普通会员',
  silver: '白银会员',
  gold: '黄金会员',
  platinum: '铂金会员',
} as const;

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'edit'>('add');
  const [activeTab, setActiveTab] = useState(0);

  const handleOpenDialog = (customer?: Customer, type: 'add' | 'edit' = 'add') => {
    if (customer) {
      setSelectedCustomer(customer);
    } else {
      setSelectedCustomer({
        id: '',
        name: '',
        gender: 'male',
        age: 0,
        phone: '',
        email: '',
        address: '',
        memberLevel: 'regular',
        totalSpent: 0,
        lastPurchase: '',
        purchaseCount: 0,
      });
    }
    setDialogType(type);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedCustomer(null);
  };

  const handleSave = () => {
    if (selectedCustomer) {
      if (dialogType === 'add') {
        setCustomers([...customers, { ...selectedCustomer, id: `CUST${Date.now()}` }]);
      } else {
        setCustomers(customers.map(c =>
          c.id === selectedCustomer.id ? selectedCustomer : c
        ));
      }
    }
    handleCloseDialog();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">客户关系管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加客户
        </Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ mb: 2 }}
        >
          <Tab label="客户列表" />
          <Tab label="购买记录" />
          <Tab label="客户分析" />
        </Tabs>
        {activeTab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>客户编号</TableCell>
                  <TableCell>姓名</TableCell>
                  <TableCell>性别</TableCell>
                  <TableCell>年龄</TableCell>
                  <TableCell>联系电话</TableCell>
                  <TableCell>会员等级</TableCell>
                  <TableCell>消费总额</TableCell>
                  <TableCell>购买次数</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.id}</TableCell>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.gender === 'male' ? '男' : '女'}</TableCell>
                    <TableCell>{customer.age}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>
                      <Chip
                        label={memberLevelLabels[customer.memberLevel]}
                        color={memberLevelColors[customer.memberLevel]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>¥{customer.totalSpent.toLocaleString()}</TableCell>
                    <TableCell>{customer.purchaseCount}</TableCell>
                    <TableCell>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(customer, 'edit')}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="购买记录">
                        <IconButton
                          size="small"
                          onClick={() => setActiveTab(1)}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {activeTab === 1 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>订单编号</TableCell>
                  <TableCell>客户</TableCell>
                  <TableCell>购买日期</TableCell>
                  <TableCell>商品</TableCell>
                  <TableCell>总金额</TableCell>
                  <TableCell>支付方式</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseRecords.map((record) => {
                  const customer = customers.find(c => c.id === record.customerId);
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{record.id}</TableCell>
                      <TableCell>{customer?.name}</TableCell>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>
                        {record.items.map(item => (
                          <div key={item.name}>
                            {item.name} x {item.quantity}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>¥{record.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>{record.paymentMethod}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  会员等级分布
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(memberLevelLabels).map(([level, label]) => ({
                        name: label,
                        value: customers.filter(c => c.memberLevel === level).length,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(memberLevelColors).map(([level, color], index) => (
                        <Cell key={`cell-${index}`} fill={color === 'default' ? '#ccc' : color === 'info' ? '#2196f3' : color === 'warning' ? '#ff9800' : '#4caf50'} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  消费趋势
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    { name: '1月', 消费: 12000 },
                    { name: '2月', 消费: 15000 },
                    { name: '3月', 消费: 18000 },
                    { name: '4月', 消费: 16000 },
                    { name: '5月', 消费: 20000 },
                    { name: '6月', 消费: 22000 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="消费"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Paper>
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === 'add' ? '添加客户' : '编辑客户'}
        </DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="姓名"
                  value={selectedCustomer.name}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="性别"
                  select
                  value={selectedCustomer.gender}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, gender: e.target.value as 'male' | 'female' })}
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="年龄"
                  type="number"
                  value={selectedCustomer.age}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, age: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="联系电话"
                  value={selectedCustomer.phone}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="电子邮箱"
                  value={selectedCustomer.email}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="地址"
                  value={selectedCustomer.address}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="会员等级"
                  select
                  value={selectedCustomer.memberLevel}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, memberLevel: e.target.value as Customer['memberLevel'] })}
                >
                  <option value="regular">普通会员</option>
                  <option value="silver">白银会员</option>
                  <option value="gold">黄金会员</option>
                  <option value="platinum">铂金会员</option>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="消费总额"
                  type="number"
                  value={selectedCustomer.totalSpent}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, totalSpent: Number(e.target.value) })}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained" onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerManagement; 