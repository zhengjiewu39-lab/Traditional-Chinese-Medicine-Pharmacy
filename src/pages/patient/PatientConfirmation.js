import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Alert, Stack, Button, TextField, MenuItem, FormControlLabel, Checkbox, Divider, Table, TableBody, TableCell, TableRow, CircularProgress, Box,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { SYNTHETIC_LABEL } from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';
import { displayFact, triFromFact, scalarFromFact } from '../../utils/clinicalFacts';

const TRI = ['no', 'yes', 'unknown'];
const split = (s) => s.split(/[，,、;；]+/).map((x) => x.trim()).filter(Boolean);

export default function PatientConfirmation() {
  const { t } = useLanguage();
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    identityConfirmed: false, allergiesConfirmed: false, allergyCorrections: '', pregnancy: 'unknown', lactation: 'unknown', ageConfirmed: false,
    currentMedications: '', fulfillment: 'pickup', contactConfirmed: false, educationReceived: false, educationUnderstood: false, declineReason: '',
  });

  useEffect(() => {
    patientPortalApi.getConfirmation(token)
      .then((r) => {
        setView(r.data);
        const info = r.data.recordedInformation || {};
        setF((x) => ({
          ...x,
          pregnancy: info.pregnancyTri || triFromFact(info.pregnancy),
          lactation: info.lactationTri || triFromFact(info.lactation),
        }));
      })
      .catch((e) => setError(formatApiError(e)));
  }, [token]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (decision) => {
    setBusy(true);
    setError('');
    try {
      const body = decision === 'decline'
        ? { decision, identityConfirmed: f.identityConfirmed, ...(f.declineReason ? { declineReason: f.declineReason } : {}) }
        : {
          decision,
          identityConfirmed: f.identityConfirmed,
          allergiesConfirmed: f.allergiesConfirmed,
          allergyCorrections: split(f.allergyCorrections),
          pregnancy: f.pregnancy,
          lactation: f.lactation,
          ageConfirmed: f.ageConfirmed,
          currentMedications: split(f.currentMedications),
          fulfillment: f.fulfillment,
          contactConfirmed: f.contactConfirmed,
          educationReceived: f.educationReceived,
          educationUnderstood: f.educationUnderstood,
        };
      setResult((await patientPortalApi.submitConfirmation(token, body)).data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const r = view?.recordedInformation;
  const labels = { none: t('ai.confirm.noAllergy'), unknown: t('ai.unknown'), notAsked: t('ai.confirm.notAsked') || t('ai.unknown') };
  const allergy = displayFact(r?.allergies, r?.allergyItems, labels);
  const meds = displayFact(r?.currentMedications, r?.medicationItems, { none: t('ai.none'), unknown: t('ai.unknown'), notAsked: t('ai.unknown') });
  const age = scalarFromFact(r?.ageYears) ?? r?.ageYearsDisplay;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('ai.confirm.title')}</Typography>
        <Alert severity="info" sx={{ my: 2 }}>{t('ai.confirm.intro', { synthetic: t(SYNTHETIC_LABEL) })}</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!view && !error && <Box sx={{ textAlign: 'center' }}><CircularProgress /></Box>}
        {result && (
          <Alert severity={result.outcome === 'confirmed' ? 'success' : 'info'}>
            {result.outcome === 'confirmed' && t('ai.confirm.ok')}
            {result.outcome === 'declined' && t('ai.confirm.declined')}
            {result.outcome === 'returned_for_review' && result.message}
            {result.outcome === 'identity_not_confirmed' && result.message}
            {result.feedbackPath && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                {t('ai.confirm.feedback', { url: `${window.location.origin}${result.feedbackPath}` })}
              </Typography>
            )}
          </Alert>
        )}
        {view && !result && (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('ai.confirm.rxReadonly')}</Typography>
            <Table size="small">
              <TableBody>
                {view.prescription.herbs.map((h) => <TableRow key={h.name}><TableCell>{h.name}</TableCell><TableCell>{h.dosage}{h.unit}</TableCell></TableRow>)}
              </TableBody>
            </Table>
            <Typography variant="body2" sx={{ mt: 1 }}>{t('ai.confirm.dosesUsage', { doses: view.prescription.doseCount ?? t('ai.dash'), usage: view.prescription.usage || t('ai.dash') })}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('ai.confirm.education')}</Typography>
            <Typography variant="body2">{view.explanation.text}</Typography>
            {view.explanation.label && <Typography variant="caption" color="text.secondary">{view.explanation.label}</Typography>}
            {view.explanation.documentId && <Typography variant="caption" display="block">{view.explanation.documentId}</Typography>}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('ai.confirm.checkInfo')}</Typography>
            <Stack spacing={1}>
              <FormControlLabel control={<Checkbox checked={f.identityConfirmed} onChange={set('identityConfirmed')} />} label={t('ai.confirm.identity')} />
              <FormControlLabel control={<Checkbox checked={f.ageConfirmed} onChange={set('ageConfirmed')} />} label={t('ai.confirm.ageOk', { age: age ?? t('ai.unregistered') })} />
              <FormControlLabel control={<Checkbox checked={f.allergiesConfirmed} onChange={set('allergiesConfirmed')} />} label={t('ai.confirm.allergiesOk', { v: allergy.text })} />
              <TextField size="small" label={t('ai.confirm.allergyAdd')} value={f.allergyCorrections} onChange={set('allergyCorrections')} />
              <Stack direction="row" spacing={1}>
                <TextField select size="small" fullWidth label={t('ai.confirm.pregnancy')} value={f.pregnancy} onChange={set('pregnancy')}>{TRI.map((v) => <MenuItem key={v} value={v}>{t(`ai.tri.${v}`)}</MenuItem>)}</TextField>
                <TextField select size="small" fullWidth label={t('ai.confirm.lactation')} value={f.lactation} onChange={set('lactation')}>{TRI.map((v) => <MenuItem key={v} value={v}>{t(`ai.tri.${v}`)}</MenuItem>)}</TextField>
              </Stack>
              <TextField size="small" label={t('ai.confirm.otherMeds', { v: meds.text })} value={f.currentMedications} onChange={set('currentMedications')} />
              <FormControlLabel control={<Checkbox checked={f.contactConfirmed} onChange={set('contactConfirmed')} />} label={t('ai.confirm.phoneOk', { phone: r?.phoneMasked || t('ai.unregistered') })} />
            </Stack>
            <Alert severity="warning" sx={{ my: 2 }}>{t('ai.confirm.reReview')}</Alert>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('ai.confirm.service')}</Typography>
            <Stack spacing={1}>
              <TextField select size="small" label={t('ai.confirm.fulfill')} value={f.fulfillment} onChange={set('fulfillment')}>
                {['pickup', 'delivery', 'decoction_pickup', 'decoction_delivery'].map((v) => <MenuItem key={v} value={v}>{t(`ai.fulfillment.${v}`)}</MenuItem>)}
              </TextField>
              <FormControlLabel control={<Checkbox checked={f.educationReceived} onChange={set('educationReceived')} />} label={t('ai.confirm.readEdu')} />
              <FormControlLabel control={<Checkbox checked={f.educationUnderstood} onChange={set('educationUnderstood')} />} label={t('ai.confirm.understoodEdu') || t('ai.confirm.readEdu')} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
              <Button variant="contained" disabled={busy || !f.identityConfirmed} onClick={() => submit('confirm')}>{t('ai.confirm.confirmBtn')}</Button>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth label={t('ai.confirm.declineReason')} value={f.declineReason} onChange={set('declineReason')} />
              <Button color="error" disabled={busy} onClick={() => submit('decline')}>{t('ai.confirm.decline')}</Button>
            </Stack>
          </>
        )}
      </Paper>
    </Container>
  );
}
