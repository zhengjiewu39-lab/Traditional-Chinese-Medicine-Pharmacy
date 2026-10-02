import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Alert, Table, TableBody, TableCell, TableHead, TableRow, Button, Stack, Chip, TextField, MenuItem, Checkbox, CircularProgress,
} from '@mui/material';
import { aiOperationsApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { AiLabel } from '../../components/ai/Badges';
import { useLanguage } from '../../i18n/LanguageContext';

const ACTION_KEYS = { purchase: 'ai.ops.purchase', transfer: 'ai.ops.transfer', expedite: 'ai.ops.expedite', hold: 'ai.ops.hold' };
const METRIC_KEYS = {
  overallFillRate: 'ai.ops.overallFillRate',
  essentialMedicineFillRate: 'ai.ops.essentialMedicineFillRate',
  worstRegionEssentialFillRate: 'ai.ops.worstRegionEssentialFillRate',
  p95WaitingTime: 'ai.ops.p95WaitingTime',
  recoveryTime95: 'ai.ops.recoveryTime95',
  totalCost: 'ai.ops.totalCost',
};
const STATUS_KEYS = {
  draft: 'ai.ops.statusDraft',
  simulated: 'ai.ops.statusSimulated',
  approved: 'ai.ops.statusApproved',
  rejected: 'ai.ops.statusRejected',
};
const fmt = (k, v) => (v == null ? '—' : /Rate$/.test(k) ? `${(v * 100).toFixed(2)}%` : v.toFixed(k === 'totalCost' ? 0 : 2));

export default function OperationsAgent() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [proposals, setProposals] = useState({ proposals: [], purchaseDrafts: [] });
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);
  const [action, setAction] = useState('purchase');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const canPropose = ['admin', 'pharmacist', 'technician'].includes(user?.role);
  const canApprove = ['admin', 'pharmacist'].includes(user?.role);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([aiOperationsApi.analysis(), aiOperationsApi.proposals()]);
      setAnalysis(a.data);
      setProposals(p.data);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !analysis) return <Alert severity="error">{error}</Alert>;
  if (!analysis) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const s = analysis.summary;
  const riskRows = [...analysis.shortageRisk, ...analysis.risingDemand.filter((r) => !analysis.shortageRisk.some((x) => x.inventoryId === r.inventoryId))].slice(0, 20);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('ai.ops.title')}</Typography>
        <AiLabel />
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{analysis.label}. {t('ai.ops.twinNote')}</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[['ai.ops.sku', s.skuCount], ['ai.ops.low', s.lowStock], ['ai.ops.nearMin', s.nearMin], ['ai.ops.expiry', s.nearExpiry], ['ai.ops.rising', s.risingDemand], ['ai.ops.essential', s.essentialAtRisk]].map(([k, v]) => (
          <Grid item xs={4} md={2} key={k}><Paper sx={{ p: 1.5 }}><Typography variant="caption">{t(k)}</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{v}</Typography></Paper></Grid>
        ))}
      </Grid>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.ops.riskTitle', { d: analysis.trendReferenceDate })}</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>{t('ai.ops.name')}</TableCell><TableCell>{t('ai.ops.stock')}</TableCell><TableCell>{t('ai.ops.trend')}</TableCell><TableCell>{t('ai.ops.supplier')}</TableCell><TableCell>{t('ai.ops.expiryCol')}</TableCell><TableCell>{t('ai.ops.flags')}</TableCell></TableRow></TableHead>
          <TableBody>
            {riskRows.map((r) => (
              <TableRow key={r.inventoryId}>
                <TableCell padding="checkbox"><Checkbox size="small" disabled={!canPropose} checked={picked.includes(r.inventoryId)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.inventoryId] : p.filter((x) => x !== r.inventoryId)))} /></TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.stock} / {r.minStock} {r.unit}</TableCell>
                <TableCell>{r.demandRecent} / {r.demandPrior}</TableCell>
                <TableCell>{r.supplier}</TableCell>
                <TableCell>{r.expiryDate}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {r.lowStock && <Chip size="small" color="error" label={t('ai.ops.lowStockChip')} />}
                    {r.nearExpiry && <Chip size="small" color="warning" label={t('ai.ops.nearExpiryChip')} />}
                    {r.essential && <Chip size="small" label={t('ai.ops.essentialChip')} />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!riskRows.length && <TableRow><TableCell colSpan={7} align="center">{t('ai.ops.noRisk')}</TableCell></TableRow>}
          </TableBody>
        </Table>
        {canPropose && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField select size="small" label={t('ai.ops.actionType')} value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 160 }}>
              {Object.entries(ACTION_KEYS).map(([k, key]) => <MenuItem key={k} value={k}>{t(key)}</MenuItem>)}
            </TextField>
            <Button variant="contained" disabled={busy} onClick={() => run(() => aiOperationsApi.propose({ action, ...(picked.length ? { inventoryIds: picked } : {}) }))}>{t('ai.ops.generate')}</Button>
          </Stack>
        )}
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.ops.proposals')}</Typography>
        {proposals.proposals.map((p) => {
          const ev = p.digitalTwinEvaluation;
          return (
            <Paper variant="outlined" key={p.proposalId} sx={{ p: 1.5, mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{p.proposalId.slice(-10)}</Typography>
                <Chip size="small" label={t(ACTION_KEYS[p.action] || p.action)} />
                <Chip size="small" variant="outlined" label={t(STATUS_KEYS[p.status] || p.status)} />
                <Typography variant="body2">{p.items.map((i) => `${i.name}${i.quantity ? ` +${i.quantity}` : ''}`).join(', ') || t('ai.dash')}</Typography>
              </Stack>
              <Typography variant="caption" display="block">{t('ai.ops.reasonLine', { reason: p.reason, benefit: p.expectedBenefit, risk: p.risk })}</Typography>
              {ev && (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead><TableRow><TableCell>{t('ai.ops.metrics', { n: ev.replicates })}</TableCell><TableCell>{t('ai.ops.baseline')}</TableCell><TableCell>{t('ai.ops.proposal')}</TableCell><TableCell>{t('ai.ops.delta')}</TableCell></TableRow></TableHead>
                  <TableBody>
                    {Object.keys(ev.baselineMetrics).map((k) => (
                      <TableRow key={k}><TableCell>{t(METRIC_KEYS[k] || k)}</TableCell><TableCell>{fmt(k, ev.baselineMetrics[k])}</TableCell><TableCell>{fmt(k, ev.proposalMetrics[k])}</TableCell><TableCell>{fmt(k, ev.difference[k])}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell colSpan={4}><Typography variant="caption">scenarioHash {ev.scenarioHash.slice(0, 16)}… · {ev.label}</Typography></TableCell></TableRow>
                  </TableBody>
                </Table>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {['draft', 'simulated'].includes(p.status) && <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => aiOperationsApi.simulate(p.proposalId, 3))}>{t('ai.ops.simulate')}</Button>}
                {p.status === 'simulated' && canApprove && (
                  <>
                    <TextField size="small" label={t('ai.ops.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Button size="small" variant="contained" disabled={busy || !comment} onClick={() => run(() => aiOperationsApi.approve(p.proposalId, 'approve', comment).then(() => setComment('')))}>{t('ai.ops.approveDraft')}</Button>
                    <Button size="small" color="error" disabled={busy || !comment} onClick={() => run(() => aiOperationsApi.approve(p.proposalId, 'reject', comment).then(() => setComment('')))}>{t('ai.ops.reject')}</Button>
                  </>
                )}
                {p.status === 'draft' && <Typography variant="caption" color="text.secondary">{t('ai.ops.needSim')}</Typography>}
              </Stack>
            </Paper>
          );
        })}
        {!proposals.proposals.length && <Typography variant="body2" color="text.secondary">{t('ai.ops.empty')}</Typography>}
        {proposals.purchaseDrafts.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>{t('ai.ops.drafts')}</Typography>
            {proposals.purchaseDrafts.map((d) => <Typography key={d.docId} variant="body2">{t('ai.ops.draftLine', { id: d.docId, type: d.type, n: d.items.length, by: d.approvedBy })}</Typography>)}
          </>
        )}
      </Paper>
    </Box>
  );
}
