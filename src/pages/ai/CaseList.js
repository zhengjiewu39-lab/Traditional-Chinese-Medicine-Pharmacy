import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Alert, Stack, TextField, MenuItem, Chip,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { RiskTierChip, StateChip } from '../../components/ai/Badges';
import { STATE_LABELS, RECOMMENDATION_LABELS } from '../../config/aiLabels';

/**
 * Case list. `mode="queue"` shows only cases awaiting a pharmacist decision (review queue);
 * otherwise all screened cases (AI prescription safety centre).
 */
export default function CaseList({ mode = 'all' }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');
  const state = mode === 'queue' ? 'pharmacist_review_required' : params.get('state') || '';
  const tier = params.get('tier') || '';

  const load = useCallback(async () => {
    try {
      const res = await aiCasesApi.list({ ...(state ? { state } : {}), ...(tier ? { riskTier: tier } : {}) });
      const list = res.data.cases;
      const order = { A3: 0, A2: 1, A1: 2, A0: 3 };
      setCases(mode === 'queue' ? [...list].sort((a, b) => (order[a.riskTier] ?? 9) - (order[b.riskTier] ?? 9) || (a.createdAt < b.createdAt ? -1 : 1)) : list);
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

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{mode === 'queue' ? '药师审核队列' : 'AI处方安全中心'}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {mode === 'queue'
          ? '按风险分级排序（A3优先）。药师拥有批准、驳回、退回医师和最终放行的专业审核权。'
          : '三轨筛查结果：确定性规则轨、已审核证据检索轨、受限语言模型轨。规则轨风险不会被模型降低。'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        {mode !== 'queue' && (
          <TextField select size="small" label="状态" value={state} onChange={(e) => setParam('state', e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">全部</MenuItem>
            {Object.entries(STATE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
        )}
        <TextField select size="small" label="风险分级" value={tier} onChange={(e) => setParam('tier', e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">全部</MenuItem>
          {['A1', 'A2', 'A3'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
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
              <TableCell>阻断/提示</TableCell>
              <TableCell>标记</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
                <TableCell>{c.patientLabel}</TableCell>
                <TableCell><StateChip state={c.state} /></TableCell>
                <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
                <TableCell>{RECOMMENDATION_LABELS[c.recommendation] || '—'}</TableCell>
                <TableCell>{c.hardStopCount} / {c.alertCount}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {c.abstain && <Chip size="small" label="AI弃权" color="warning" variant="outlined" />}
                    {c.secondReviewPending && <Chip size="small" label="待二审" color="info" variant="outlined" />}
                    {c.missingCritical > 0 && <Chip size="small" label={`缺失${c.missingCritical}`} variant="outlined" />}
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
