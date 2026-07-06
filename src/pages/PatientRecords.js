import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, Alert, TablePagination,
} from '@mui/material';
import { Search, Add, Refresh, Person, History } from '@mui/icons-material';
import { patientsApi } from '../services/api';

function PatientRecords() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [form, setForm] = useState({ name: '', gender: '男', age: '', phone: '', address: '', medicalHistory: '', allergies: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientsApi.getAllPatients({ q: searchTerm || undefined });
      setPatients(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(0); }, [searchTerm]);

  const filtered = patients.filter(p =>
    !searchTerm || p.name.includes(searchTerm) || p.phone.includes(searchTerm)
  );
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const openDetail = (patient) => {
    setSelected(patient);
    setDetailOpen(true);
  };

  const openHistory = async (patient) => {
    setSelected(patient);
    try {
      const res = await patientsApi.getPatientPrescriptions(patient.id);
      setPrescriptions(res.data);
    } catch {
      setPrescriptions([]);
    }
    setHistoryOpen(true);
  };

  const handleAdd = async () => {
    await patientsApi.createPatient({
      ...form,
      age: Number(form.age),
      medicalHistory: form.medicalHistory ? form.medicalHistory.split(/[,，]/).map(s => s.trim()) : [],
      allergies: form.allergies ? form.allergies.split(/[,，]/).map(s => s.trim()) : [],
    });
    setOpenAdd(false);
    setForm({ name: '', gender: '男', age: '', phone: '', address: '', medicalHistory: '', allergies: '' });
    load();
  };

  if (loading && patients.length === 0) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>患者档案管理</Typography>
          <Typography variant="body2" color="text.secondary">
            电子病历 · 过敏史 · 处方历史 · 演示样本 {patients.length} 人
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={load}>刷新</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpenAdd(true)}>新建档案</Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="搜索姓名或电话"
            size="small"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} /> }}
            sx={{ width: 300 }}
          />
        </CardContent>
      </Card>

      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell>姓名</TableCell>
            <TableCell>性别/年龄</TableCell>
            <TableCell>电话</TableCell>
            <TableCell>病史</TableCell>
            <TableCell>过敏</TableCell>
            <TableCell>最近就诊</TableCell>
            <TableCell>处方数</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.map(p => (
            <TableRow key={p.id}>
              <TableCell><strong>{p.name}</strong></TableCell>
              <TableCell>{p.gender} / {p.age}岁</TableCell>
              <TableCell>{p.phone}</TableCell>
              <TableCell>{(p.medicalHistory || []).map(h => <Chip key={h} label={h} size="small" sx={{ mr: 0.5 }} />)}</TableCell>
              <TableCell>{(p.allergies || []).length ? (p.allergies || []).map(a => <Chip key={a} label={a} size="small" color="error" sx={{ mr: 0.5 }} />) : '—'}</TableCell>
              <TableCell>{p.recentVisits}</TableCell>
              <TableCell>{p.prescriptionCount || 0}</TableCell>
              <TableCell>
                <Button size="small" startIcon={<Person />} onClick={() => openDetail(p)}>详情</Button>
                <Button size="small" startIcon={<History />} onClick={() => openHistory(p)}>处方</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="每页"
      />

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>患者详情 — {selected?.name}</DialogTitle>
        <DialogContent>
          {selected && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={6}><Typography variant="body2" color="text.secondary">电话</Typography><Typography>{selected.phone}</Typography></Grid>
              <Grid item xs={6}><Typography variant="body2" color="text.secondary">地址</Typography><Typography>{selected.address}</Typography></Grid>
              <Grid item xs={12}><Typography variant="body2" color="text.secondary">病史</Typography>{(selected.medicalHistory || []).map(h => <Chip key={h} label={h} size="small" sx={{ mr: 0.5 }} />)}</Grid>
              <Grid item xs={12}><Typography variant="body2" color="text.secondary">过敏史</Typography>{(selected.allergies || []).length ? selected.allergies.map(a => <Chip key={a} label={a} color="error" size="small" sx={{ mr: 0.5 }} />) : '无'}</Grid>
              {selected.customerId && <Grid item xs={12}><Alert severity="info">已关联客户账户 #{selected.customerId}</Alert></Grid>}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>关闭</Button></DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>处方历史 — {selected?.name}</DialogTitle>
        <DialogContent>
          {prescriptions.length === 0 ? <Typography color="text.secondary">暂无处方记录</Typography> : prescriptions.map(pr => (
            <Paper key={pr.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography fontWeight={600}>{pr.diagnosis}</Typography>
                <Chip label={pr.status} size="small" color={pr.status === '已完成' ? 'success' : 'warning'} />
              </Box>
              <Typography variant="body2" color="text.secondary">{pr.date} · {pr.doctor}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {(pr.prescriptionText || (pr.herbs || []).map(h => `${h.name}${h.dosage || ''}`).join('，'))}
              </Typography>
              {pr.cdssStatus && (
                <Chip size="small" label={`CDSS ${pr.cdssStatus}`} sx={{ mt: 1 }} variant="outlined" />
              )}
            </Paper>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryOpen(false)}>关闭</Button></DialogActions>
      </Dialog>

      <Dialog open={openAdd} onClose={() => setOpenAdd(false)}>
        <DialogTitle>新建患者档案</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="姓名" fullWidth value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <TextField margin="dense" label="年龄" type="number" fullWidth value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
          <TextField margin="dense" label="电话" fullWidth value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <TextField margin="dense" label="地址" fullWidth value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <TextField margin="dense" label="病史（逗号分隔）" fullWidth value={form.medicalHistory} onChange={e => setForm({ ...form, medicalHistory: e.target.value })} />
          <TextField margin="dense" label="过敏（逗号分隔）" fullWidth value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PatientRecords;
