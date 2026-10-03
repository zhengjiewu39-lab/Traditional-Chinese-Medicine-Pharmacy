import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Alert, Chip, Stack, Button, TextField, Table, TableBody, TableCell, TableRow, CircularProgress,
} from '@mui/material';
import { aiGovernanceApi, aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { SEMANTIC_STATUS_LABELS, OVERRIDE_REASONS } from '../../config/aiLabels';
import ConnectRealAi from '../../components/ConnectRealAi';
import { useLanguage } from '../../i18n/LanguageContext';

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

function Metric({ label, value, hint }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}

export default function Governance() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [assist, setAssist] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [metrics, draft] = await Promise.all([
        aiGovernanceApi.metrics(),
        user?.role === 'admin' ? aiCasesApi.deskAssist({ lane: 'admin' }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setM(metrics.data);
      setAssist(draft.data?.brief || null);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  const decide = async (p, decision) => {
    setBusy(p.id);
    setNotice('');
    try {
      await aiCasesApi.adminConfirm({ type: p.type, decision, payload: p.payload || {} });
      setNotice(decision === 'accept' ? t('ai.gov.confirmed') : t('ai.gov.rejected'));
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy('');
    }
  };

  const toggle = async () => {
    try {
      await aiGovernanceApi.killSwitch(!m.runtime.aiEnabled, reason);
      setReason('');
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  if (error && !m) return <Alert severity="error">{error}</Alert>;
  if (!m) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const rt = m.runtime;
  const sug = m.suggestions?.counts || {};

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('ai.gov.title')}</Typography>
        <Button size="small" onClick={() => navigate('/ai/knowledge')}>{t('nav.aiKnowledge')}</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {m.label && <Alert severity="warning" sx={{ mb: 2 }}>{m.label}</Alert>}
      {user?.role === 'admin' && assist && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('ai.gov.assistTitle')}</Typography>
          <Alert severity="info" sx={{ my: 1 }}>{t('ai.gov.assistHint')}</Alert>
          {(assist.proposals || []).map((p) => (
            <Stack key={p.id} direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.title}</Typography>
                <Typography variant="caption" color="text.secondary">{p.detail}</Typography>
              </Box>
              {p.needsConfirm && (
                <>
                  <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => decide(p, 'accept')}>{t('ai.gov.confirm')}</Button>
                  <Button size="small" disabled={Boolean(busy)} onClick={() => decide(p, 'reject')}>{t('ai.gov.reject')}</Button>
                </>
              )}
            </Stack>
          ))}
        </Paper>
      )}
      {user?.role === 'admin' && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <ConnectRealAi onSaved={load} />
        </Paper>
      )}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip color={rt.aiEnabled ? 'success' : 'default'} label={rt.aiEnabled ? t('ai.gov.killOn') : t('ai.gov.killOff')} />
          <Chip variant="outlined" label={t('ai.gov.provider', { v: rt.provider })} />
          <Chip variant="outlined" label={t('ai.gov.model', { v: rt.model || t('ai.gov.none') })} />
          {rt.endpointHost && <Chip variant="outlined" label={t('ai.gov.endpoint', { v: rt.endpointHost })} />}
          <Chip variant="outlined" label={rt.apiKeyConfigured ? t('ai.gov.keyOn') : t('ai.gov.keyOff')} />
          <Chip variant="outlined" label={t('ai.gov.aiMode', { v: rt.aiMode || '—' })} />
          <Chip variant="outlined" label={t('ai.gov.dataMode', { v: rt.dataMode || '—' })} />
          {rt.degradedMode && <Chip color="warning" label={t('ai.gov.degraded')} />}
          <Chip color={m.auditChain.valid ? 'success' : 'error'} label={m.auditChain.valid ? t('ai.gov.auditOk', { n: m.auditChain.length }) : t('ai.gov.auditFail', { reason: m.auditChain.reason })} />
        </Stack>
        {user?.role === 'admin' && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField size="small" label={t('ai.gov.reason')} value={reason} onChange={(e) => setReason(e.target.value)} sx={{ minWidth: 320 }} />
            <Button variant="contained" color={rt.aiEnabled ? 'error' : 'success'} disabled={!reason} onClick={toggle}>{rt.aiEnabled ? t('ai.gov.turnOff') : t('ai.gov.turnOn')}</Button>
          </Stack>
        )}
      </Paper>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.modelSuccess')} value={pct(m.rates.modelSuccessRate)} hint={t('ai.gov.calls', { n: m.counts.modelAttempts })} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.schemaFail')} value={pct(m.rates.schemaFailureRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.abstain')} value={pct(m.rates.abstainRate)} hint={t('ai.gov.screens', { n: m.counts.analyses })} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.conflict')} value={pct(m.rates.ruleModelConflictRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.override')} value={pct(m.rates.overrideRate)} hint={t('ai.gov.decisions', { n: m.counts.decisions })} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.citation')} value={pct(m.rates.citationCompleteness)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.latency')} value={m.averageLatencyMs == null ? '—' : `${m.averageLatencyMs.toFixed(1)} ms`} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.accept')} value={pct(m.suggestions?.rates?.acceptanceRate)} hint={t('ai.gov.notOverride')} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.partial')} value={pct(m.suggestions?.rates?.partialAcceptanceRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.changeAfter')} value={pct(m.suggestions?.rates?.prescriptionChangeAfterPromptRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.agree')} value={pct(m.suggestions?.rates?.pharmacistAiAgreementRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.samples')} value={m.counts.lowRiskSamples ?? 0} /></Grid>
        <Grid item xs={6} md={3}><Metric label={t('ai.gov.extraRisks')} value={m.rates.pharmacistAddedRisksNotInAi ?? 0} /></Grid>
      </Grid>
      {m.suggestions && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.gov.sugTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('ai.gov.sugCounts', {
              pending: sug.pending, accepted: sug.accepted, partial: sug.partially_accepted,
              rejected: sug.rejected, ignored: sug.ignored, superseded: sug.superseded,
            })}
          </Typography>
          <Table size="small">
            <TableBody>
              {Object.entries(m.suggestions.rejectReasons || {}).map(([k, v]) => (
                <TableRow key={k}><TableCell>{t('ai.gov.rejectReason', { k })}</TableCell><TableCell>{v}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          {user?.role === 'admin' && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" onClick={async () => { await aiGovernanceApi.sample(0.1); load(); }}>{t('ai.gov.sample')}</Button>
              <Button size="small" onClick={async () => { await aiGovernanceApi.learningExport(); load(); }}>{t('ai.gov.export')}</Button>
            </Stack>
          )}
        </Paper>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.gov.versions')}</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>{t('ai.gov.rules')}</TableCell><TableCell>{m.versions.ruleSetVersion}</TableCell></TableRow>
                <TableRow><TableCell>{t('ai.gov.kb')}</TableCell><TableCell>{m.versions.knowledgeBaseVersion}</TableCell></TableRow>
                {m.versions.prompts.map((p) => <TableRow key={p.id}><TableCell>{t('ai.gov.prompt', { id: p.id })}</TableCell><TableCell>{p.ref}</TableCell></TableRow>)}
                <TableRow>
                  <TableCell>{t('ai.gov.entries')}</TableCell>
                  <TableCell>
                    {t('ai.gov.entriesDetail', {
                      usable: m.knowledgeIntegrity.usable,
                      total: m.knowledgeIntegrity.total,
                      pending: m.knowledgeIntegrity.notApproved.join(', ') || t('ai.gov.noneItem'),
                      failed: m.knowledgeIntegrity.integrityFailed.join(', ') || t('ai.gov.noneItem'),
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.gov.semanticDist')}</Typography>
            <Table size="small">
              <TableBody>
                {Object.entries(m.semanticStatusCounts).map(([k, v]) => (
                  <TableRow key={k}><TableCell>{t(SEMANTIC_STATUS_LABELS[k] || k)}</TableCell><TableCell>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>{t('ai.gov.overrideDist')}</Typography>
            <Table size="small">
              <TableBody>
                {OVERRIDE_REASONS.map((r) => (
                  <TableRow key={r.value}><TableCell>{t(r.labelKey)}</TableCell><TableCell>{m.overrideReasons[r.value] || 0}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
      <Alert severity="info" sx={{ mt: 2 }}>{t('ai.gov.footer')}</Alert>
    </Box>
  );
}
