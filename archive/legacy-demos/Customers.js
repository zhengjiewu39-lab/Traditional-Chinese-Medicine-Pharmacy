import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, LinearProgress,
  Grid, Card, CardContent,
} from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import { customerApi } from '../services/api';

const levelColor = { '普通': 'default', '银卡': 'info', '金卡': 'warning', '钻石': 'secondary' };

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', gender: '男', age: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([customerApi.getCustomerData(), customerApi.getCustomerStats()]);
      setCustomers(c.data);
      setStats(s.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await customerApi.createCustomer({ ...form, age: Number(form.age) || undefined });
      setForm({ name: '', phone: '', address: '', gender: '男', age: '' });
      setOpen(false);
      load();
    } catch (e) {
      alert('添加失败');
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>客户管理</Typography>
          <Typography variant="body2" color="text.secondary">会员等级 · 消费积分 · 与患者档案联动</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={load}>刷新</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>添加客户</Button>
        </Box>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: '客户总数', value: stats.totalCustomers },
            { label: '本月新增', value: stats.newCustomersThisMonth },
            { label: '平均消费', value: `¥${stats.averageSpending}` },
            { label: '活跃客户', value: stats.mostFrequentCustomer },
          ].map(s => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>姓名</TableCell>
              <TableCell>电话</TableCell>
              <TableCell>地址</TableCell>
              <TableCell>会员等级</TableCell>
              <TableCell>积分</TableCell>
              <TableCell>最近访问</TableCell>
              <TableCell>订单数</TableCell>
              <TableCell>消费总额</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map(c => (
              <TableRow key={c.id}>
                <TableCell><strong>{c.name}</strong> <Typography variant="caption" color="text.secondary">{c.gender} {c.age ? `${c.age}岁` : ''}</Typography></TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.address}</TableCell>
                <TableCell><Chip label={c.memberLevel || '普通'} size="small" color={levelColor[c.memberLevel] || 'default'} /></TableCell>
                <TableCell>{c.points || 0}</TableCell>
                <TableCell>{c.lastVisit}</TableCell>
                <TableCell>{c.visits || 0}</TableCell>
                <TableCell>¥{c.spending || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>添加新客户</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="客户姓名" fullWidth value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <TextField margin="dense" label="联系电话" fullWidth value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <TextField margin="dense" label="地址" fullWidth value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd}>添加</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Customers;
