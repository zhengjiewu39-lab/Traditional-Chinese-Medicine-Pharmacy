import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Alert, List, ListItem, ListItemText, Chip, Stack,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { STATE_LABELS } from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';

export default function MyPrescriptions() {
  const { t } = useLanguage();
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    patientPortalApi.myCases().then((r) => setCases(r.data.cases)).catch((e) => setError(formatApiError(e)));
  }, []);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t('ai.mine.title')}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {cases && !cases.length && <Alert severity="info">{t('ai.mine.empty')}</Alert>}
      {cases?.map((c) => (
        <Paper key={c.caseRef} sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontFamily: 'monospace' }}>{c.caseRef}</Typography>
            <Chip size="small" label={t(STATE_LABELS[c.state] || c.state)} />
            {c.educationStatus && <Chip size="small" variant="outlined" label={c.educationStatus === 'published' ? t('nav.myEducation') : t('ai.mine.educationPending')} />}
          </Stack>
          <Typography variant="body2" sx={{ mt: 1 }}>{c.prescription.herbs.map((h) => `${h.name}${h.dosage ?? ''}${h.unit}`).join(', ')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{c.explanation?.text || t('ai.mine.educationPending')}</Typography>
          <List dense>
            {c.events.map((e, i) => (
              <ListItem key={i} disableGutters>
                <ListItemText
                  primary={`${(() => { const k = `ai.event.${e.eventType}`; const lab = t(k); return lab === k ? e.eventType : lab; })()}${e.summary && e.eventType === 'state_transition' ? `: ${t(STATE_LABELS[e.summary] || e.summary)}` : ''}`}
                  secondary={new Date(e.timestamp).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      ))}
    </Box>
  );
}
