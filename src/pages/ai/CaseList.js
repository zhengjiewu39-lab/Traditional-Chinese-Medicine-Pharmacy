import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Alert, Stack, TextField, MenuItem, Chip, Button,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { RiskTierChip, StateChip } from '../../components/ai/Badges';
import { STATE_LABELS, RECOMMENDATION_LABELS, DISPLAY_SOURCE_LABELS } from '../../config/aiLabels';

function QueueTable({ rows, empty, onOpen }) {
  return (
    <Paper sx={{ mb: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>任务</TableCell>
            <TableCell>患者</TableCell>
            <TableCell>风险</TableCell>
            <TableCell>升级原因</TableCell>
            <TableCell>结果来源</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(c.caseId)}>
              <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
              <TableCell>{c.patientLabel}</TableCell>
              <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
              <TableCell>{(c.escalateReasons || []).join('；') || '—'}</TableCell>
              <TableCell>{DISPLAY_SOURCE_LABELS[c.displaySource] || c.displaySource || '—'}</TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={5} align="center">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function CaseList({ mode = 'all' }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [queue, setQueue] = useState({ priority: [], batch: [] });
  const [error, setError] = useState('');
  const state = mode === 'queue' ? 'pharmacist_review_required' : params.get('state') || '';
  const tier = params.get('tier') || '';

  const load = useCallback(async () => {
    try {
      if (mode === 'queue') {
        const q = await aiCasesApi.reviewQueue();
        setQueue(q.data);
      } else {
        const res = await aiCasesApi.list({ ...(state ? { state } : {}), ...(tier ? { riskTier: tier } : {}) });
        setCases(res.data.cases);
      }
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, [state, tier, mode]);

  useEffect(() => { load(); }, [load]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next);
  };

  const open = (id) => navigate(`/ai/reviews/${id}`);

  if (mode === 'queue') {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>异常优先审核队列</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          高风险、信息不足、规则—模型冲突、低置信度进入重点队列。低风险仍须药师签署，不能仅凭AI“低风险”发药。
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>重点审核（{queue.priority.length}）</Typography>
        <QueueTable rows={queue.priority} empty="暂无重点审核病例" onOpen={open} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>简化审核 / 批量确认（{queue.batch.length}）</Typography>
        <Alert severity="warning" sx={{ mb: 1 }}>以下病例风险较低，仍须药师点击进入并签署。系统不会自动批准或发药。</Alert>
        <QueueTable rows={queue.batch} empty="暂无低风险待签署病例" onOpen={open} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>AI处方安全中心</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        统一病例工作流。规则结果、真实模型结果与降级结果会分别标注。
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="状态" value={state} onChange={(e) => setParam('state', e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">全部</MenuItem>
          {Object.entries(STATE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="风险分级" value={tier} onChange={(e) => setParam('tier', e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">全部</MenuItem>
          {['A1', 'A2', 'A3'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <Button onClick={() => navigate('/ai/review-queue')}>进入审核队列</Button>
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>任务</TableCell>
              <TableCell>患者</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>风险分级</TableCell>
              <TableCell>AI建议</TableCell>
              <TableCell>来源</TableCell>
              <TableCell>标记</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => open(c.caseId)}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
                <TableCell>{c.patientLabel}</TableCell>
                <TableCell><StateChip state={c.state} /></TableCell>
                <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
                <TableCell>{RECOMMENDATION_LABELS[c.recommendation] || '—'}</TableCell>
                <TableCell>{DISPLAY_SOURCE_LABELS[c.displaySource] || c.displaySource || '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {c.priority && <Chip size="small" color="error" variant="outlined" label="重点" />}
                    {c.abstain && <Chip size="small" label="AI弃权" color="warning" variant="outlined" />}
                    {c.secondReviewPending && <Chip size="small" label="待二审" color="info" variant="outlined" />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!cases.length && <TableRow><TableCell colSpan={7} align="center">没有符合条件的处方任务</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
