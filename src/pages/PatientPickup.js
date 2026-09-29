import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, Chip,
} from '@mui/material';
import { QrCode2, Search } from '@mui/icons-material';
import { pickupApi } from '../services/aiApi';
import { formatApiError } from '../config/httpClient';
import { useLanguage } from '../i18n/LanguageContext';

function PatientPickup() {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await pickupApi.redeem(code.trim());
      setData(res.data);
    } catch (e) {
      setError(formatApiError(e) || t('ai.pickup.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <QrCode2 sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" fontWeight={700}>{t('ai.pickup.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('ai.pickup.intro')}
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            label={t('ai.pickup.token')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <Button variant="contained" startIcon={<Search />} onClick={lookup} disabled={loading}>{t('ai.pickup.check')}</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <Paper sx={{ p: 3 }}>
          <Chip label={data.ready ? t('ai.pickup.ready') : t('ai.pickup.notReady')} color={data.ready ? 'success' : 'warning'} sx={{ mb: 2 }} />
          <Typography variant="body2">{t('ai.pickup.caseRef', { ref: data.caseRef })}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {(data.herbs || []).map((h) => `${h.name} ${h.dosage}${h.unit || 'g'}`).join(', ') || t('ai.dash')}
          </Typography>
          {data.synthetic && <Alert severity="warning" sx={{ mt: 2 }}>{t('ai.pickup.synthetic')}</Alert>}
        </Paper>
      )}
    </Box>
  );
}

export default PatientPickup;
