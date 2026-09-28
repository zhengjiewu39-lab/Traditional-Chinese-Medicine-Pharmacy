import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Alert, Chip, Stack, Button, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { RiskTierChip, StateChip } from '../../components/ai/Badges';

const TILES = [
  { key: 'today', label: '今日接收', path: '/ai/cases' },
  { key: 'pendingReview', label: '待药师审核', path: '/ai/review-queue', color: '#1565C0' },
  { key: 'priorityReview', label: '重点异常队列', path: '/ai/review-queue', color: '#C62828' },
  { key: 'batchReview', label: '低风险待签署', path: '/ai/review-queue', color: '#EF6C00' },
  { key: 'a3', label: 'A3 强制阻断', path: '/ai/review-queue?tier=A3', color: '#C62828' },
  { key: 'informationIncomplete', label: '信息缺失', path: '/ai/cases?state=information_incomplete', color: '#EF6C00' },
  { key: 'awaitingPatient', label: '待患者确认', path: '/patient-service', color: '#6A1B9A' },
  { key: 'awaitingPrescriber', label: '待医师处理', path: '/ai/cases?state=returned_to_prescriber', color: '#AD1457' },
  { key: 'toDispense', label: '待调剂', path: '/dispensing', color: '#2E7D32' },
  { key: 'toCheck', label: '待复核', path: '/dispensing', color: '#00838F' },
  { key: 'shortage', label: '缺货/低库存风险', path: '/ai/operations', color: '#5D4037' },
  { key: 'nearExpiry', label: '近效期', path: '/ai/operations', color: '#795548' },
];

export default function Workbench() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([aiCasesApi.workbench(), aiCasesApi.list()]);
      setSummary(s.data);
      setCases(c.data.cases.slice(0, 10));
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!summary) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const ai = summary.ai;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Typography variant="h5" sx={{ fontWeight: 700, mr: 2 }}>智能中药药房工作台</Typography>
        <Chip size="small" color={ai.aiEnabled ? 'success' : 'default'} label={ai.aiEnabled ? 'AI已启用' : 'AI已关闭（仅规则）'} />
        <Chip size="small" variant="outlined" label={`模式：${ai.aiMode || '—'}`} />
        <Chip size="small" variant="outlined" label={`模型：${ai.model || '无（仅规则）'}`} />
        {ai.isMock && <Chip size="small" color="warning" label="模拟模型（非真实AI）" />}
        {ai.degradedMode && <Chip size="small" color="warning" label="降级模式" />}
        <Chip size="small" color={summary.auditChainValid ? 'success' : 'error'} label={summary.auditChainValid ? '审计链完整' : '审计链校验失败'} />
      </Stack>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {TILES.map((tile) => (
          <Grid item xs={6} sm={4} md={2.4} key={tile.key}>
            <Paper sx={{ p: 2, cursor: 'pointer', borderTop: 3, borderColor: tile.color || 'grey.400' }} onClick={() => navigate(tile.path)}>
              <Typography variant="caption" color="text.secondary">{tile.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: tile.color }}>{summary[tile.key] ?? 0}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">最近处方任务</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => navigate('/intake')}>接收新处方</Button>
            <Button onClick={() => navigate('/ai/review-queue')}>进入审核队列</Button>
          </Stack>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>任务</TableCell>
              <TableCell>患者</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>风险分级</TableCell>
              <TableCell>缺失信息</TableCell>
              <TableCell>接收时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
                <TableCell>{c.patientLabel}</TableCell>
                <TableCell><StateChip state={c.state} /></TableCell>
                <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
                <TableCell>{c.missingCritical || '—'}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!cases.length && (
              <TableRow><TableCell colSpan={6} align="center">暂无处方任务。可在“患者与处方接收”中录入或导入合成处方。</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
