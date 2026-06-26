import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Alert,
  Grid, Card, CardContent, LinearProgress, IconButton, Tooltip,
} from '@mui/material';
import { Add, Warning, Refresh, Edit, Inventory as InvIcon } from '@mui/icons-material';
import { inventoryApi } from '../services/api';

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', stock: '', unit: '克', price: '', minStock: '50', expiryDate: '', supplier: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, st, al] = await Promise.all([
        inventoryApi.getAllInventory(),
        inventoryApi.getInventoryStats(),
        inventoryApi.getStockAlerts(),
      ]);
      setInventory(inv.data);
      setStats(st.data);
      setAlerts(al.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const payload = {
      ...form,
      stock: Number(form.stock),
      price: Number(form.price),
      minStock: Number(form.minStock),
    };
    try {
      if (editItem) {
        await inventoryApi.updateInventory(editItem.id, payload);
      } else {
        await inventoryApi.createInventory(payload);
      }
      setOpen(false);
      setEditItem(null);
      setForm({ name: '', category: '', stock: '', unit: '克', price: '', minStock: '50', expiryDate: '', supplier: '' });
      load();
    } catch (e) {
      alert('保存失败');
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...item, stock: String(item.stock), price: String(item.price), minStock: String(item.minStock) });
    setOpen(true);
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>库存管理</Typography>
          <Typography variant="body2" color="text.secondary">实时库存 · 低库存预警 · 批次效期追踪</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={load}>刷新</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditItem(null); setOpen(true); }}>添加药品</Button>
        </Box>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: '药品种类', value: stats.totalItems, icon: <InvIcon /> },
            { label: '库存总值', value: `¥${stats.totalValue?.toLocaleString()}`, icon: null },
            { label: '低库存预警', value: stats.lowStockItems, icon: <Warning color="warning" /> },
            { label: '高价值类别', value: stats.mostValuableCategory, icon: null },
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

      {alerts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {alerts.slice(0, 3).map(a => a.message).join(' · ')}
          {alerts.length > 3 && ` 等 ${alerts.length} 条预警`}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>药品名称</TableCell>
              <TableCell>类别</TableCell>
              <TableCell>库存</TableCell>
              <TableCell>单价</TableCell>
              <TableCell>安全库存</TableCell>
              <TableCell>供应商</TableCell>
              <TableCell>有效期</TableCell>
              <TableCell>批次</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventory.map(item => (
              <TableRow key={item.id} sx={{ bgcolor: item.stock <= item.minStock ? 'warning.50' : 'inherit' }}>
                <TableCell><strong>{item.name}</strong></TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.stock} {item.unit}</TableCell>
                <TableCell>¥{item.price}</TableCell>
                <TableCell>{item.minStock} {item.unit}</TableCell>
                <TableCell>{item.supplier}</TableCell>
                <TableCell>{item.expiryDate}</TableCell>
                <TableCell><Typography variant="caption">{item.batchNo}</Typography></TableCell>
                <TableCell>
                  {item.stock === 0 ? <Chip label="缺货" color="error" size="small" />
                    : item.stock <= item.minStock ? <Chip label="低库存" color="warning" size="small" />
                    : <Chip label="正常" color="success" size="small" variant="outlined" />}
                </TableCell>
                <TableCell>
                  <Tooltip title="编辑"><IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? '编辑药品' : '添加药品'}</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="药品名称" fullWidth value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <TextField margin="dense" label="类别" fullWidth value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Grid container spacing={1}>
            <Grid item xs={6}><TextField margin="dense" label="库存" fullWidth type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField margin="dense" label="单位" fullWidth value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField margin="dense" label="单价" fullWidth type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField margin="dense" label="安全库存" fullWidth type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} /></Grid>
          </Grid>
          <TextField margin="dense" label="供应商" fullWidth value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          <TextField margin="dense" label="有效期" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Inventory;
