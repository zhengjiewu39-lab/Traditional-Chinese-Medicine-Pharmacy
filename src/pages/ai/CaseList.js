import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Alert, Stack, TextField, MenuItem, Chip, Button,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { RiskTierChip, StateChip } from '../../components/ai/Badges';
import { STATE_LABELS, RECOMMENDATION_LABELS, DISPLAY_SOURCE_LABELS } from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';

function QueueTable({ rows, empty, onOpen, t }) {
  return (
    <Paper sx={{ mb: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('ai.task')}</TableCell>
            <TableCell>{t('ai.patient')}</TableCell>
            <TableCell>{t('ai.risk')}</TableCell>
            <TableCell>{t('ai.cases.escalate')}</TableCell>
            <TableCell>{t('ai.source')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(c.caseId)}>
              <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
              <TableCell>{c.patientLabel}</TableCell>
              <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
              <TableCell>{(c.escalateReasons || []).join('; ') || '—'}</TableCell>
              <TableCell>{c.displaySource ? t(DISPLAY_SOURCE_LABELS[c.displaySource] || c.displaySource) : '—'}</TableCell>
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
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [queue, setQueue] = useState({ priority: [], batch: [], secondReview: [] });
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
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.cases.queueTitle')}</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>{t('ai.cases.queueIntro')}</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.cases.secondTitle', { n: (queue.secondReview || []).length })}</Typography>
        <Alert severity="info" sx={{ mb: 1 }}>{t('ai.cases.secondIntro')}</Alert>
        <QueueTable rows={queue.secondReview || []} empty={t('ai.cases.emptySecond')} onOpen={open} t={t} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.cases.priority', { n: queue.priority.length })}</Typography>
        <QueueTable rows={queue.priority} empty={t('ai.cases.emptyPriority')} onOpen={open} t={t} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.cases.batch', { n: queue.batch.length })}</Typography>
        <Alert severity="warning" sx={{ mb: 1 }}>{t('ai.cases.batchWarn')}</Alert>
        <QueueTable rows={queue.batch} empty={t('ai.cases.emptyBatch')} onOpen={open} t={t} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.cases.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('ai.cases.intro')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label={t('ai.status')} value={state} onChange={(e) => setParam('state', e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">{t('ai.all')}</MenuItem>
          {Object.entries(STATE_LABELS).map(([k, key]) => <MenuItem key={k} value={k}>{t(key)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={t('ai.risk')} value={tier} onChange={(e) => setParam('tier', e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">{t('ai.all')}</MenuItem>
          {['A1', 'A2', 'A3'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
        </TextField>
        <Button onClick={() => navigate('/ai/review-queue')}>{t('ai.cases.goQueue')}</Button>
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ai.task')}</TableCell>
              <TableCell>{t('ai.patient')}</TableCell>
              <TableCell>{t('ai.status')}</TableCell>
              <TableCell>{t('ai.risk')}</TableCell>
              <TableCell>{t('ai.cases.aiAdvice')}</TableCell>
              <TableCell>{t('ai.source')}</TableCell>
              <TableCell>{t('ai.cases.flags')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.caseId} hover sx={{ cursor: 'pointer' }} onClick={() => open(c.caseId)}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</TableCell>
                <TableCell>{c.patientLabel}</TableCell>
                <TableCell><StateChip state={c.state} /></TableCell>
                <TableCell><RiskTierChip tier={c.riskTier} /></TableCell>
                <TableCell>{c.recommendation ? t(RECOMMENDATION_LABELS[c.recommendation] || c.recommendation) : '—'}</TableCell>
                <TableCell>{c.displaySource ? t(DISPLAY_SOURCE_LABELS[c.displaySource] || c.displaySource) : '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {c.priority && <Chip size="small" color="error" variant="outlined" label={t('ai.cases.priorityFlag')} />}
                    {c.abstain && <Chip size="small" label={t('ai.cases.abstainFlag')} color="warning" variant="outlined" />}
                    {c.secondReviewPending && <Chip size="small" label={t('ai.cases.secondFlag')} color="info" variant="outlined" />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!cases.length && <TableRow><TableCell colSpan={7} align="center">{t('ai.cases.emptyAll')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
