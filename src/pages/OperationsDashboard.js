import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button, LinearProgress,
  List, ListItem, ListItemText, Alert, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  TrendingUp, Inventory, Warning, LocalPharmacy, QrCode2, Science, Hub,
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
  if (!data) return <Alert severity="error">无法加载演示数据，请确认 API 已启动 (端口 3002)</Alert>;

  const kpis = [
    { label: '今日销售额 (演示)', value: `¥${data.todaySales?.toLocaleString()}`, icon: <TrendingUp />, color: '#1565C0' },
    { label: '待审处方 (演示)', value: data.alerts.pendingPrescriptions, icon: <LocalPharmacy />, color: '#EF6C00', path: '/legacy/prescriptions/review' },
    { label: '待取药 (演示)', value: data.alerts.awaitingPickup, icon: <QrCode2 />, color: '#6A1B9A', path: '/legacy/pickup' },
    { label: '低库存预警 (演示)', value: data.alerts.lowStock, icon: <Warning />, color: '#C62828', path: '/legacy/inventory' },
  ];

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Legacy Demo：本页为合成/演示运营数据，非真实药店交易。处方审方与规则 Benchmark 不能作为临床 CDSS 或 ADR 预防证据。
        公共卫生供应韧性研究请使用默认首页{' '}
        <Button size="small" onClick={() => navigate('/simulation/overview')}>仿真研究总览</Button>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Legacy Demo — 运营驾驶舱</Typography>
          <Typography variant="body2" color="text.secondary">合成演示数据 · 每 30 秒刷新 · 非研究主流程</Typography>
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
            <Typography variant="h6" gutterBottom fontWeight={600}>销售趋势 (演示)</Typography>
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
            <Typography variant="h6" gutterBottom fontWeight={600}>业务概览 (演示)</Typography>
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
              <Typography variant="h6" fontWeight={600}>待取药队列 (演示)</Typography>
              <Button size="small" onClick={() => navigate('/legacy/billing')}>去收银</Button>
            </Box>
            {(data.pickupQueue || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无待取药处方</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>患者 (演示)</TableCell>
                    <TableCell>取药码</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.pickupQueue.map(p => (
                    <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/legacy/billing?code=${p.pickupCode}`)}>
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
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                <Hub sx={{ mr: 0.5, verticalAlign: 'middle', fontSize: 20 }} />
                供应韧性仿真 (研究主流程)
              </Typography>
              <Button size="small" variant="contained" onClick={() => navigate('/simulation/overview')}>进入</Button>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              社区药房网络在公共卫生扰动下的合成仿真、策略对比与实验档案。不含真实患者或处方数据。
            </Typography>
            <Button variant="outlined" size="small" onClick={() => navigate('/simulation/run')}>运行仿真</Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate('/legacy/research')}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                <Science sx={{ mr: 0.5, verticalAlign: 'middle', fontSize: 20 }} />
                Legacy — 合成处方规则 Benchmark
              </Typography>
              <Button size="small" onClick={e => { e.stopPropagation(); navigate('/legacy/research'); }}>详情</Button>
            </Box>
            <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
              标签由规则引擎生成（存在标签泄漏）；Macro-F1 仅作 Legacy 演示，不可写入临床或公共卫生论文结论。
            </Typography>
            {research?.comparison?.length ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  合成数据集 n={research.n} · 引擎对比（演示）
                </Typography>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={research.comparison.map(r => ({
                    name: r.engine.replace('rule-engine-v3', '规则').replace('ml-interpretable-v1', 'ML').replace('cdss-dual-track-v1', '融合').replace('baseline-', 'B-'),
                    MacroF1: +(r.macroF1 * 100).toFixed(1),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => [`${v}%`, '合成集 Macro-F1 (演示)']} />
                    <Bar dataKey="MacroF1" fill="#9e9e9e" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">进入 Legacy 科研演示页运行合成 Benchmark</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>低库存药品 (演示)</Typography>
            {(data.lowStockItems || []).map(i => (
              <Alert key={i.id} severity="warning" sx={{ mb: 1 }} icon={<Inventory />}>
                {i.name}：剩余 {i.stock}{i.unit}（安全库存 {i.minStock}{i.unit}）
              </Alert>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>最近订单 (演示)</Typography>
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
