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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  TrendingUp as TrendingUpIcon,
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
} from 'recharts';

interface Distributor {
  id: string;
  name: string;
  region: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  salesTarget: number;
  currentSales: number;
  joinDate: string;
}

const initialDistributors: Distributor[] = [
  {
    id: 'DIST001',
    name: '北京同仁堂药店',
    region: '华北',
    address: '北京市东城区东长安街1号',
    contact: '王经理',
    phone: '010-12345678',
    email: 'wang@tongrentang.com',
    status: 'active',
    salesTarget: 1000000,
    currentSales: 850000,
    joinDate: '2023-01-01',
  },
  {
    id: 'DIST002',
    name: '上海雷允上药店',
    region: '华东',
    address: '上海市黄浦区南京东路1号',
    contact: '李经理',
    phone: '021-87654321',
    email: 'li@leiyunshang.com',
    status: 'active',
    salesTarget: 800000,
    currentSales: 720000,
    joinDate: '2023-02-15',
  },
];

const salesData = [
  { name: '1月', 目标: 1000000, 实际: 850000 },
  { name: '2月', 目标: 1000000, 实际: 920000 },
  { name: '3月', 目标: 1000000, 实际: 880000 },
  { name: '4月', 目标: 1000000, 实际: 950000 },
  { name: '5月', 目标: 1000000, 实际: 890000 },
  { name: '6月', 目标: 1000000, 实际: 930000 },
];

const DistributionNetwork: React.FC = () => {
  const [distributors, setDistributors] = useState<Distributor[]>(initialDistributors);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'edit'>('add');

  const handleOpenDialog = (distributor?: Distributor, type: 'add' | 'edit' = 'add') => {
    if (distributor) {
      setSelectedDistributor(distributor);
    } else {
      setSelectedDistributor({
        id: '',
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
      });
    }
    setDialogType(type);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDistributor(null);
  };

  const handleSave = () => {
    if (selectedDistributor) {
      if (dialogType === 'add') {
        setDistributors([...distributors, { ...selectedDistributor, id: `DIST${Date.now()}` }]);
      } else {
        setDistributors(distributors.map(d =>
          d.id === selectedDistributor.id ? selectedDistributor : d
        ));
      }
    }
    handleCloseDialog();
  };

  const getSalesProgress = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90) {
      return { color: 'success', label: '达标' };
    } else if (percentage >= 70) {
      return { color: 'warning', label: '接近目标' };
    } else {
      return { color: 'error', label: '未达标' };
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">分销网络管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加分销商
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* 销售目标完成情况 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              销售目标完成情况
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="目标" fill="#8884d8" />
                <Bar dataKey="实际" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 分销商列表 */}
        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>分销商编号</TableCell>
                  <TableCell>名称</TableCell>
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
                {distributors.map((distributor) => {
                  const progress = getSalesProgress(distributor.currentSales, distributor.salesTarget);
                  return (
                    <TableRow key={distributor.id}>
                      <TableCell>{distributor.id}</TableCell>
                      <TableCell>{distributor.name}</TableCell>
                      <TableCell>{distributor.region}</TableCell>
                      <TableCell>{distributor.contact}</TableCell>
                      <TableCell>{distributor.phone}</TableCell>
                      <TableCell>¥{distributor.salesTarget.toLocaleString()}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            ¥{distributor.currentSales.toLocaleString()}
                          </Typography>
                          <Chip
                            label={progress.label}
                            color={progress.color}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={distributor.status === 'active' ? '活跃' : '非活跃'}
                          color={distributor.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="编辑">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(distributor, 'edit')}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="查看详情">
                          <IconButton size="small">
                            <LocationIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === 'add' ? '添加分销商' : '编辑分销商'}
        </DialogTitle>
        <DialogContent>
          {selectedDistributor && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="分销商名称"
                  value={selectedDistributor.name}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="所属区域"
                  value={selectedDistributor.region}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, region: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="地址"
                  value={selectedDistributor.address}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="联系人"
                  value={selectedDistributor.contact}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, contact: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="联系电话"
                  value={selectedDistributor.phone}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="电子邮箱"
                  value={selectedDistributor.email}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="加入日期"
                  type="date"
                  value={selectedDistributor.joinDate}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, joinDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="销售目标"
                  type="number"
                  value={selectedDistributor.salesTarget}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, salesTarget: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="当前销售额"
                  type="number"
                  value={selectedDistributor.currentSales}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, currentSales: Number(e.target.value) })}
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

export default DistributionNetwork; 