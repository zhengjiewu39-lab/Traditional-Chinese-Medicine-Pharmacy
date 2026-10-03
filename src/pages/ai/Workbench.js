import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getHomeForRole } from '../../config/navigation';
import {
  Box, Grid, Paper, Typography, Alert, Chip, Stack, Button, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { RiskTierChip, StateChip } from '../../components/ai/Badges';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const TILES = [
  { key: 'informationIncomplete', labelKey: 'ai.workbench.informationIncomplete', path: '/ai/cases?state=information_incomplete', color: '#EF6C00', roles: ['pharmacist', 'admin'] },
  { key: 'pendingReview', labelKey: 'ai.workbench.pendingReview', path: '/ai/review-queue', color: '#1565C0', roles: ['pharmacist', 'admin'] },
  { key: 'toDispense', labelKey: 'ai.workbench.toDispense', path: '/dispensing', color: '#2E7D32', roles: ['pharmacist', 'technician', 'admin'] },
  { key: 'toCheck', labelKey: 'ai.workbench.toCheck', path: '/dispensing', color: '#00838F', roles: ['pharmacist', 'technician', 'admin'] },
  { key: 'restockSuggested', labelKey: 'ai.workbench.restock', path: '/dispensing', color: '#E65100', roles: ['technician', 'admin', 'pharmacist'] },
  { key: 'pendingFollowUp', labelKey: 'nav.followUp', path: '/ai/follow-up', color: '#6A1B9A', roles: ['pharmacist', 'admin'] },
];

export default function Workbench() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
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

  const home = getHomeForRole(user?.role);
  if (user && home && home !== '/workbench') {
    return <Navigate to={home} replace />;
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!summary) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const ai = summary.ai;
  const tiles = TILES.filter((tile) => !tile.roles || tile.roles.includes(user?.role));

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Typography variant="h5" sx={{ fontWeight: 700, mr: 2 }}>{t('ai.workbench.title')}</Typography>
        <Chip size="small" color={ai.aiEnabled ? 'success' : 'default'} label={ai.aiEnabled ? t('ai.workbench.aiOn') : t('ai.workbench.aiOff')} />
        <Chip size="small" variant="outlined" label={t('ai.workbench.mode', { mode: ai.aiMode || '—' })} />
        <Chip size="small" variant="outlined" label={t('ai.workbench.model', { model: ai.model || t('ai.workbench.noModel') })} />
        {ai.isMock && <Chip size="small" color="warning" label={t('ai.workbench.mock')} />}
        {ai.degradedMode && <Chip size="small" color="warning" label={t('ai.workbench.degraded')} />}
        <Chip size="small" color={summary.auditChainValid ? 'success' : 'error'} label={summary.auditChainValid ? t('ai.workbench.auditOk') : t('ai.workbench.auditFail')} />
      </Stack>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {tiles.map((tile) => (
          <Grid item xs={6} sm={4} md={2.4} key={tile.key}>
            <Paper sx={{ p: 2, cursor: 'pointer', borderTop: 3, borderColor: tile.color || 'grey.400' }} onClick={() => navigate(tile.path)}>
              <Typography variant="caption" color="text.secondary">{t(tile.labelKey)}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: tile.color }}>{summary[tile.key] ?? 0}</Typography>
            </Paper>
          </Grid>
        ))}
        {['prescriber', 'pharmacist', 'admin', 'researcher'].includes(user?.role) && (
          <Grid item xs={6} sm={4} md={2.4}>
            <Paper sx={{ p: 2, cursor: 'pointer', borderTop: 3, borderColor: '#5D4037' }} onClick={() => navigate('/ai/knowledge')}>
              <Typography variant="caption" color="text.secondary">{t('nav.sectionKnowledge')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#5D4037' }}>{t('nav.aiKnowledge')}</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">{t('ai.workbench.recent')}</Typography>
          <Stack direction="row" spacing={1}>
            {['prescriber', 'pharmacist', 'admin'].includes(user?.role) && <Button onClick={() => navigate('/ai/cases')}>{t('nav.aiCases')}</Button>}
            {['prescriber', 'pharmacist', 'admin', 'researcher'].includes(user?.role) && <Button onClick={() => navigate('/ai/knowledge')}>{t('nav.aiKnowledge')}</Button>}
            {['pharmacist', 'admin'].includes(user?.role) && <Button onClick={() => navigate('/ai/follow-up')}>{t('nav.followUp')}</Button>}
            {['technician', 'admin'].includes(user?.role) && <Button onClick={() => navigate('/dispensing')}>{t('nav.dispensing')}</Button>}
          </Stack>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ai.task')}</TableCell>
              <TableCell>{t('ai.patient')}</TableCell>
              <TableCell>{t('ai.status')}</TableCell>
              <TableCell>{t('ai.risk')}</TableCell>
              <TableCell>{t('ai.workbench.missing')}</TableCell>
              <TableCell>{t('ai.workbench.receivedAt')}</TableCell>
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
              <TableRow><TableCell colSpan={6} align="center">{t('ai.workbench.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
