import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

const split = (s) => String(s || '').split(/[，,、;；]+/).map((x) => x.trim()).filter(Boolean);

function parseValue(fieldType, raw) {
  if (fieldType === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (fieldType === 'boolean') return raw === 'true' || raw === 'yes';
  if (fieldType === 'list') return split(raw);
  return raw;
}

export default function ClarificationRespond() {
  const { t } = useLanguage();
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [status, setStatus] = useState('unknown');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    patientPortalApi.getClarification(token).then((r) => {
      setView(r.data);
      const allowed = r.data.task?.allowedStatuses || ['unknown', 'none', 'reported'];
      setStatus(allowed.includes('unknown') ? 'unknown' : allowed[0]);
    }).catch((e) => setError(formatApiError(e)));
  }, [token]);
  const fieldType = view?.task?.fieldType || 'string';
  const submit = async () => {
    try {
      const body = {
        status,
        kind: 'correct',
        value: status === 'reported' ? parseValue(fieldType, value) : null,
      };
      const out = await patientPortalApi.submitClarification(token, body);
      setMsg(out.data.outcome);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  };
  const valueField = () => {
    if (status !== 'reported') return null;
    if (fieldType === 'number') {
      return <TextField fullWidth size="small" type="number" label={`${t('ai.clar.number')}${view.task?.unit ? ` (${view.task.unit})` : ''}`} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }} />;
    }
    if (fieldType === 'tri') {
      return (
        <TextField select fullWidth size="small" label={t('ai.clar.value')} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }}>
          {['yes', 'no', 'unknown'].map((v) => <MenuItem key={v} value={v}>{t(`ai.tri.${v}`)}</MenuItem>)}
        </TextField>
      );
    }
    if (fieldType === 'boolean') {
      return (
        <TextField select fullWidth size="small" label={t('ai.clar.value')} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }}>
          <MenuItem value="true">{t('ai.review.yesNoUnknown.yes')}</MenuItem>
          <MenuItem value="false">{t('ai.review.yesNoUnknown.no')}</MenuItem>
        </TextField>
      );
    }
    if (fieldType === 'sex') {
      return (
        <TextField select fullWidth size="small" label={t('ai.clar.value')} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }}>
          {['male', 'female', 'unknown'].map((v) => <MenuItem key={v} value={v}>{t(`ai.sex.${v}`)}</MenuItem>)}
        </TextField>
      );
    }
    return <TextField fullWidth size="small" label={fieldType === 'list' ? t('ai.clar.list') : t('ai.clar.value')} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }} />;
  };
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t('ai.clar.title')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {view && !msg && (
        <Paper sx={{ p: 2 }}>
          <Typography sx={{ mb: 1 }}>{view.task?.question}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>{view.task?.reason}</Typography>
          <TextField select fullWidth size="small" label={t('ai.clar.status')} value={status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 2 }}>
            {(view.task?.allowedStatuses || ['unknown', 'none', 'reported']).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          {valueField()}
          <Button variant="contained" onClick={submit} disabled={status === 'reported' && value === ''}>{t('ai.clar.submit')}</Button>
        </Paper>
      )}
    </Box>
  );
}
