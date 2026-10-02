import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

function Fact({ label, fact }) {
  if (!fact) return null;
  return (
    <Typography variant="body2" sx={{ mb: 1 }}>
      {label}: <Chip size="small" label={fact.status} /> {fact.status === 'reported' ? String(fact.value ?? '') : ''}
    </Typography>
  );
}

export default function PatientProfile() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    patientPortalApi.myProfile().then((r) => setData(r.data)).catch((e) => setError(formatApiError(e)));
  }, []);
  const p = data?.profile || {};
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t('nav.myProfile')}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="warning" sx={{ mb: 2 }}>{t('patientProfile.identityNote')}</Alert>
      <Paper sx={{ p: 2 }}>
        <Typography>{p.name || p.patientRef || '—'}</Typography>
        <Fact label={t('patientProfile.allergies')} fact={p.facts?.allergies} />
        <Fact label={t('patientProfile.medications')} fact={p.facts?.currentMedications} />
        <Fact label={t('patientProfile.pregnancy')} fact={p.facts?.pregnancy} />
        <Fact label={t('patientProfile.liver')} fact={p.facts?.liverImpairment} />
        <Fact label={t('patientProfile.kidney')} fact={p.facts?.renalImpairment} />
      </Paper>
    </Box>
  );
}
