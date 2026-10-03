import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Alert, Stack, Button, TextField, Rating, FormControlLabel, Switch, MenuItem,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { SYNTHETIC_LABEL } from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';

export default function PatientFeedback() {
  const { t } = useLanguage();
  const { token } = useParams();
  const [effectiveness, setEffectiveness] = useState(3);
  const [adverse, setAdverse] = useState(false);
  const [desc, setDesc] = useState('');
  const [comments, setComments] = useState('');
  const [intakeStatus, setIntakeStatus] = useState('unknown');
  const [difficulty, setDifficulty] = useState('');
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const submit = async () => {
    try {
      const r = await patientPortalApi.submitFeedback(token, {
        effectiveness,
        adverseReaction: adverse,
        newSymptom: adverse,
        intakeStatus,
        ...(difficulty ? { difficulty } : {}),
        ...(desc ? { adverseDescription: desc } : {}),
        ...(comments ? { comments } : {}),
      });
      setDone(r.data);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('ai.feedback.title')}</Typography>
        <Alert severity="info" sx={{ my: 2 }}>{t('ai.feedback.intro', { synthetic: t(SYNTHETIC_LABEL) })}</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {done ? (
          <Alert severity="success">
            {t('ai.feedback.thanks')}{done.pharmacistFollowUp ? ` ${t('ai.feedback.follow')}` : ''}
            {done.note && <Typography variant="body2" sx={{ mt: 1 }}>{done.note}</Typography>}
            {done.nextFeedbackPath && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                {t('ai.feedback.nextLink', { url: `${window.location.origin}${done.nextFeedbackPath}` })}
              </Typography>
            )}
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2">{t('ai.feedback.feel')}</Typography>
            <Rating value={effectiveness} onChange={(e, v) => setEffectiveness(v || 1)} />
            <TextField select size="small" label={t('ai.feedback.intake')} value={intakeStatus} onChange={(e) => setIntakeStatus(e.target.value)}>
              <MenuItem value="taken">{t('ai.feedback.intakeTaken')}</MenuItem>
              <MenuItem value="not_taken">{t('ai.feedback.intakeNot')}</MenuItem>
              <MenuItem value="partially_taken">{t('ai.feedback.intakePartial')}</MenuItem>
              <MenuItem value="unknown">{t('ai.feedback.intakeUnknown')}</MenuItem>
            </TextField>
            <TextField size="small" label={t('ai.feedback.difficulty')} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            <FormControlLabel control={<Switch checked={adverse} onChange={(e) => setAdverse(e.target.checked)} />} label={t('ai.feedback.adr')} />
            {adverse && <TextField multiline minRows={2} label={t('ai.feedback.desc')} value={desc} onChange={(e) => setDesc(e.target.value)} />}
            <TextField multiline minRows={2} label={t('ai.feedback.other')} value={comments} onChange={(e) => setComments(e.target.value)} />
            <Button variant="contained" onClick={submit}>{t('ai.feedback.submit')}</Button>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
