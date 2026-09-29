import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Alert, Table, TableBody, TableCell, TableHead, TableRow, Button, Chip, Stack,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { StateChip } from '../../components/ai/Badges';
import { useLanguage } from '../../i18n/LanguageContext';

const STATES = ['pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed', 'patient_declined', 'completed'];

export default function PatientService() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [links, setLinks] = useState({});

  const load = useCallback(async () => {
    try {
      const lists = await Promise.all(STATES.map((s) => aiCasesApi.list({ state: s })));
      const summaries = lists.flatMap((l) => l.data.cases);
      const full = await Promise.all(summaries.map((s) => aiCasesApi.get(s.caseId).then((r) => r.data.case)));
      setRows(full);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const issue = async (id) => {
    try {
      const r = await aiCasesApi.issuePatientConfirmation(id);
      setLinks((l) => ({ ...l, [id]: r.data }));
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.patientSvc.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('ai.patientSvc.intro')}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ai.task')}</TableCell>
              <TableCell>{t('ai.status')}</TableCell>
              <TableCell>{t('ai.patientSvc.service')}</TableCell>
              <TableCell>{t('ai.patientSvc.feedback')}</TableCell>
              <TableCell>{t('ai.patientSvc.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => {
              const fb = c.patientFeedback || [];
              return (
                <TableRow key={c.caseId}>
                  <TableCell sx={{ fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>{c.caseId.slice(-8)}</TableCell>
                  <TableCell><StateChip state={c.state} /></TableCell>
                  <TableCell>
                    {c.serviceChoices
                      ? `${t(`ai.fulfillment.${c.serviceChoices.fulfillment}`) || c.serviceChoices.fulfillment} · ${t('ai.patientSvc.substLine', { v: c.serviceChoices.substitutionConsent === 'accept' ? t('ai.patientSvc.substYes') : t('ai.patientSvc.substNo') })}`
                      : t('ai.dash')}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {fb.map((f, i) => <Chip key={i} size="small" label={t('ai.patientSvc.effect', { n: f.effectiveness })} />)}
                      {c.pharmacovigilanceFollowUp && <Chip size="small" color="error" label={t('ai.patientSvc.adr')} />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360, wordBreak: 'break-all' }}>
                    {['pharmacist_approved', 'patient_confirmation_required'].includes(c.state) && (
                      <Button size="small" variant="outlined" onClick={() => issue(c.caseId)}>{c.state === 'pharmacist_approved' ? t('ai.patientSvc.issue') : t('ai.patientSvc.reissue')}</Button>
                    )}
                    {links[c.caseId] && <Typography variant="caption" display="block">{`${window.location.origin}${links[c.caseId].path}`}</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={5} align="center">{t('ai.patientSvc.empty')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
