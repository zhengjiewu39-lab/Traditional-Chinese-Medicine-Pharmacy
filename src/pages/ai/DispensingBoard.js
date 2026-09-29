import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Alert, Stack, Button, TextField, Table, TableBody, TableCell, TableHead, TableRow, Chip,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { StateChip } from '../../components/ai/Badges';
import { useLanguage } from '../../i18n/LanguageContext';

const COLUMN_KEYS = [
  { state: 'patient_confirmed', titleKey: 'ai.dispense.colConfirmed' },
  { state: 'dispensing', titleKey: 'ai.dispense.colDispensing' },
  { state: 'pharmacist_final_check', titleKey: 'ai.dispense.colCheck' },
  { state: 'ready_for_pickup', titleKey: 'ai.dispense.colReady' },
];

function WeighForm({ c, onSubmit, busy, t }) {
  const [grams, setGrams] = useState(() => Object.fromEntries((c.prescription.herbs || []).map((h) => [h.name, h.dosage ?? ''])));
  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('ai.herb')}</TableCell>
            <TableCell>{t('ai.dispense.prescribed')}</TableCell>
            <TableCell>{t('ai.dispense.actual')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(c.prescription.herbs || []).map((h) => (
            <TableRow key={h.name}>
              <TableCell>{h.name}</TableCell>
              <TableCell>{h.dosage}g</TableCell>
              <TableCell><TextField size="small" type="number" value={grams[h.name]} onChange={(e) => setGrams((g) => ({ ...g, [h.name]: e.target.value }))} sx={{ width: 90 }} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button sx={{ mt: 1 }} size="small" variant="contained" disabled={busy} onClick={() => onSubmit(Object.entries(grams).filter(([, v]) => v !== '').map(([name, v]) => ({ name, grams: Number(v) })))}>
        {t('ai.dispense.submitCheck')}
      </Button>
    </Box>
  );
}

export default function DispensingBoard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const lists = await Promise.all(COLUMN_KEYS.map((col) => aiCasesApi.list({ state: col.state })));
      const full = {};
      for (let i = 0; i < COLUMN_KEYS.length; i += 1) {
        full[COLUMN_KEYS[i].state] = await Promise.all(lists[i].data.cases.map((s) => aiCasesApi.get(s.caseId).then((r) => r.data.case)));
      }
      setCases(full);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, body) => {
    setBusy(true);
    setError('');
    try {
      await aiCasesApi.dispensing(id, { ...body, ...(note ? { note } : {}) });
      setNote('');
      setOpen(null);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const lastWeighed = (c) => [...(c.dispensingRecords || [])].reverse().find((r) => r.type === 'weighed');

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.dispense.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('ai.dispense.intro')}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        {COLUMN_KEYS.map((col) => (
          <Grid item xs={12} md={3} key={col.state}>
            <Paper sx={{ p: 1.5, minHeight: 200 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t(col.titleKey)} ({cases[col.state]?.length || 0})</Typography>
              {(cases[col.state] || []).map((c) => {
                const w = lastWeighed(c);
                const deviations = w ? w.items.filter((i) => i.outOfTolerance).length + w.missing.length : 0;
                const fulfill = t(`ai.fulfillment.${c.serviceChoices?.fulfillment || 'pickup'}`);
                return (
                  <Paper key={c.caseId} variant="outlined" sx={{ p: 1, mb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>{c.caseId.slice(-8)}</Typography>
                      <StateChip state={c.state} />
                    </Stack>
                    <Typography variant="caption" display="block">{t('ai.dispense.herbsN', { n: (c.prescription.herbs || []).length, doses: c.prescription.doseCount ?? '?', fulfill })}</Typography>
                    {c.serviceChoices?.substitutionConsent === 'accept' && <Chip size="small" label={t('ai.dispense.subst')} sx={{ mt: 0.5 }} />}
                    {w && <Chip size="small" color={deviations ? 'warning' : 'success'} label={deviations ? t('ai.dispense.weighOff', { n: deviations }) : t('ai.dispense.weighOk')} sx={{ mt: 0.5 }} />}
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {col.state === 'patient_confirmed' && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(c.caseId, { action: 'start' })}>{t('ai.dispense.start')}</Button>}
                      {col.state === 'dispensing' && (open === c.caseId
                        ? <WeighForm t={t} c={c} busy={busy} onSubmit={(items) => act(c.caseId, { action: 'submit_final_check', weighedItems: items })} />
                        : <Button size="small" variant="outlined" onClick={() => setOpen(c.caseId)}>{t('ai.dispense.weigh')}</Button>)}
                      {col.state === 'pharmacist_final_check' && user?.role === 'pharmacist' && (
                        <>
                          <TextField size="small" label={t('ai.dispense.checkNote')} value={open === c.caseId ? note : ''} onFocus={() => setOpen(c.caseId)} onChange={(e) => setNote(e.target.value)} />
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => act(c.caseId, { action: 'final_check_pass' })}>{t('ai.dispense.pass')}</Button>
                            <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => act(c.caseId, { action: 'final_check_fail' })}>{t('ai.dispense.fail')}</Button>
                          </Stack>
                        </>
                      )}
                      {col.state === 'pharmacist_final_check' && user?.role !== 'pharmacist' && <Typography variant="caption" color="text.secondary">{t('ai.dispense.waitPharm')}</Typography>}
                      {col.state === 'ready_for_pickup' && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(c.caseId, { action: 'handover' })}>{t('ai.dispense.handover')}</Button>}
                    </Stack>
                  </Paper>
                );
              })}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
