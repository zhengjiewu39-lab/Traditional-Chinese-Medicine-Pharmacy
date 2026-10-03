import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { researchEvalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ResearchDesk() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([researchEvalApi.home(), researchEvalApi.protocol()])
      .then(([home, proto]) => {
        setData(home.data);
        setProtocol(proto.data.protocol || home.data.protocol);
        setError('');
      })
      .catch((e) => setError(formatApiError(e)));
  }, []);

  const patch = (section, key, value) => {
    setProtocol((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await researchEvalApi.saveProtocol({
        note: protocol.note,
        fastTrack: protocol.fastTrack,
        dualReview: protocol.dualReview,
      });
      setProtocol(res.data.protocol);
      setNotice(t('researchDesk.saved'));
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('researchDesk.title')}</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>{t('researchDesk.intro')}</Alert>
      <Alert severity="warning" sx={{ mb: 2 }}>{t('researchDesk.noSign')}</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {protocol && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{t('researchDesk.protocol')}</Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={t('researchDesk.note')}
            value={protocol.note || ''}
            onChange={(e) => setProtocol((p) => ({ ...p, note: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('researchDesk.fast')}</Typography>
              <FormControlLabel
                control={<Switch checked={Boolean(protocol.fastTrack?.enabled)} onChange={(e) => patch('fastTrack', 'enabled', e.target.checked)} />}
                label={t('researchDesk.enabled')}
              />
              <TextField
                select
                size="small"
                fullWidth
                label={t('researchDesk.maxTier')}
                value={protocol.fastTrack?.maxTier || 'A1'}
                onChange={(e) => patch('fastTrack', 'maxTier', e.target.value)}
                sx={{ my: 1 }}
              >
                <MenuItem value="A0">A0</MenuItem>
                <MenuItem value="A1">A1</MenuItem>
              </TextField>
              <FormControlLabel
                control={<Switch checked={Boolean(protocol.fastTrack?.noAbstain)} onChange={(e) => patch('fastTrack', 'noAbstain', e.target.checked)} />}
                label={t('researchDesk.noAbstain')}
              />
              <FormControlLabel
                control={<Switch checked={Boolean(protocol.fastTrack?.noCriticalMissing)} onChange={(e) => patch('fastTrack', 'noCriticalMissing', e.target.checked)} />}
                label={t('researchDesk.noCritical')}
              />
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('researchDesk.dual')}</Typography>
              <FormControlLabel
                control={<Switch checked={Boolean(protocol.dualReview?.enabled)} onChange={(e) => patch('dualReview', 'enabled', e.target.checked)} />}
                label={t('researchDesk.enabled')}
              />
              <TextField
                select
                size="small"
                fullWidth
                label={t('researchDesk.minTier')}
                value={protocol.dualReview?.minTier || 'A2'}
                onChange={(e) => patch('dualReview', 'minTier', e.target.value)}
                sx={{ my: 1 }}
              >
                <MenuItem value="A1">A1</MenuItem>
                <MenuItem value="A2">A2</MenuItem>
                <MenuItem value="A3">A3</MenuItem>
              </TextField>
              <FormControlLabel
                control={<Switch checked={Boolean(protocol.dualReview?.onAbstain)} onChange={(e) => patch('dualReview', 'onAbstain', e.target.checked)} />}
                label={t('researchDesk.onAbstain')}
              />
            </Paper>
          </Stack>
          <Button sx={{ mt: 2 }} variant="contained" disabled={busy} onClick={save}>{t('researchDesk.save')}</Button>
        </Paper>
      )}
      {data && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('researchDesk.eval')}</Typography>
          <Typography sx={{ mb: 1 }}>{data.paperQuestion}</Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>{data.warning}</Alert>
          <Chip label={data.liveModelReport?.present === false ? 'No live-model file' : 'Live report present'} sx={{ mr: 1 }} />
          <Chip label="Mock is engineering only" />
          <Typography variant="body2" sx={{ mt: 2 }}>Groups: {(data.groups || []).join(' · ')}</Typography>
          <Button component={RouterLink} to="/research/evaluation" sx={{ mt: 2 }}>{t('nav.researchEval')}</Button>
        </Paper>
      )}
    </Box>
  );
}
