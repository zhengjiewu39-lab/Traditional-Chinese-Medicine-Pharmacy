import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

const initialCustomers = [
  {
    id: 1,
    name: '张三',
    phone: '13800138000',
    address: '北京市朝阳区',
    lastVisit: '2024-02-20',
    totalOrders: 5,
    totalSpent: 1500,
  },
  {
    id: 2,
    name: '李四',
    phone: '13900139000',
    address: '北京市海淀区',
    lastVisit: '2024-02-19',
    totalOrders: 3,
    totalSpent: 800,
  },
  {
    id: 3,
    name: '王五',
    phone: '13700137000',
    address: '北京市西城区',
    lastVisit: '2024-02-18',
    totalOrders: 2,
    totalSpent: 450,
  },
];

function Customers() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [open, setOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddCustomer = () => {
    setCustomers([
      ...customers,
      {
        id: customers.length + 1,
        ...newCustomer,
        lastVisit: new Date().toISOString().split('T')[0],
        totalOrders: 0,
        totalSpent: 0,
      },
    ]);
    setNewCustomer({
      name: '',
      phone: '',
      address: '',
    });
    handleClose();
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">客户管理</Typography>
        <Button variant="contained" color="primary" onClick={handleClickOpen}>
          添加客户
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>客户姓名</TableCell>
              <TableCell>联系电话</TableCell>
              <TableCell>地址</TableCell>
              <TableCell>最近访问</TableCell>
              <TableCell>订单总数</TableCell>
              <TableCell>消费总额</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address}</TableCell>
                <TableCell>{customer.lastVisit}</TableCell>
                <TableCell>{customer.totalOrders}</TableCell>
                <TableCell>¥{customer.totalSpent}</TableCell>
                <TableCell>
                  <Button size="small" color="primary">
                    查看详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>添加新客户</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="客户姓名"
            fullWidth
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="联系电话"
            fullWidth
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
          />
          <TextField
            margin="dense"
            label="地址"
            fullWidth
            value={newCustomer.address}
            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>取消</Button>
          <Button onClick={handleAddCustomer} color="primary">
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Customers; 