import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button, LinearProgress,
  List, ListItem, ListItemText, Alert, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  TrendingUp, Inventory, People, Receipt, Warning, LocalPharmacy, QrCode2, Science,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dashboardApi, researchApi } from '../services/api';

const statusColor = {
  待审核: 'warning', 已审核: 'info', 配药中: 'primary', 待取药: 'secondary', 已完成: 'success',
};

function OperationsDashboard() {
  const [data, setData] = useState(null);
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      dashboardApi.getOverview(),
      researchApi.getResults().catch(() => ({ data: null })),
    ])
      .then(([dash, res]) => { setData(dash.data); setResearch(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (loading && !data) return <LinearProgress />;
  if (!data) return <Alert severity="error">无法加载运营数据，请确认 API 已启动 (端口 3002)</Alert>;

  const kpis = [
    { label: '今日销售额', value: `¥${data.todaySales?.toLocaleString()}`, icon: <TrendingUp />, color: '#1565C0' },
    { label: '待审处方', value: data.alerts.pendingPrescriptions, icon: <LocalPharmacy />, color: '#EF6C00', path: '/prescriptions/review' },
    { label: '待取药', value: data.alerts.awaitingPickup, icon: <QrCode2 />, color: '#6A1B9A', path: '/pickup' },
    { label: '低库存预警', value: data.alerts.lowStock, icon: <Warning />, color: '#C62828', path: '/inventory' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>运营驾驶舱</Typography>
          <Typography variant="body2" color="text.secondary">实时数据 · 每 30 秒自动刷新</Typography>
        </Box>
        <Button variant="outlined" onClick={load}>刷新</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map(k => (
          <Grid item xs={6} md={3} key={k.label}>
            <Card sx={{ cursor: k.path ? 'pointer' : 'default' }} onClick={() => k.path && navigate(k.path)}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                    <Typography variant="h4" fontWeight={700}>{k.value}</Typography>
                  </Box>
                  <Box sx={{ color: k.color }}>{k.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>销售趋势</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.salesTrends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`¥${Number(v).toLocaleString()}`, '销售额']} />
                <Line type="monotone" dataKey="sales" stroke="#1565C0" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>业务概览</Typography>
            <List dense>
              <ListItem><ListItemText primary="库存总值" secondary={`¥${data.inventory?.totalValue?.toLocaleString()}`} /></ListItem>
              <ListItem><ListItemText primary="客户总数" secondary={data.customers?.totalCustomers} /></ListItem>
              <ListItem><ListItemText primary="累计订单" secondary={data.sales?.orderCount} /></ListItem>
              <ListItem><ListItemText primary="热销品种" secondary={data.sales?.mostSoldItem} /></ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>待取药队列</Typography>
              <Button size="small" onClick={() => navigate('/billing')}>去收银</Button>
            </Box>
            {(data.pickupQueue || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无待取药处方</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>患者</TableCell>
                    <TableCell>取药码</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.pickupQueue.map(p => (
                    <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/billing?code=${p.pickupCode}`)}>
                      <TableCell>{p.patientName}</TableCell>
                      <TableCell><Chip label={p.pickupCode} size="small" color="secondary" variant="outlined" /></TableCell>
                      <TableCell><Chip label={p.status} size="small" color={statusColor[p.status] || 'default'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate('/research')}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                <Science sx={{ mr: 0.5, verticalAlign: 'middle', fontSize: 20 }} />
                科研评价 · 引擎 Benchmark
              </Typography>
              <Button size="small" onClick={e => { e.stopPropagation(); navigate('/research'); }}>详情</Button>
            </Box>
            {research?.comparison?.length ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  数据集 n={research.n} · 最佳 {research.comparison[0].engine} Macro-F1 {(research.comparison[0].macroF1 * 100).toFixed(1)}%
                </Typography>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={research.comparison.map(r => ({
                    name: r.engine.replace('rule-engine-v3', '规则').replace('ml-interpretable-v1', 'ML').replace('baseline-', 'B-'),
                    MacroF1: +(r.macroF1 * 100).toFixed(1),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => [`${v}%`, 'Macro-F1']} />
                    <Bar dataKey="MacroF1" fill="#6A1B9A" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">点击进入科研评价中心，运行 Benchmark 与多引擎对比</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>低库存药品</Typography>
            {(data.lowStockItems || []).map(i => (
              <Alert key={i.id} severity="warning" sx={{ mb: 1 }} icon={<Inventory />}>
                {i.name}：剩余 {i.stock}{i.unit}（安全库存 {i.minStock}{i.unit}）
              </Alert>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>最近订单</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>订单号</TableCell>
                  <TableCell>客户</TableCell>
                  <TableCell>金额</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>来源</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.recentOrders || []).map(o => (
                  <TableRow key={o.id}>
                    <TableCell>{o.orderNo}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>¥{o.total}</TableCell>
                    <TableCell><Chip label={o.status} size="small" /></TableCell>
                    <TableCell>{o.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default OperationsDashboard;
