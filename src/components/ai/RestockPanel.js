import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

export default function RestockPanel({ compact = false, onApplied }) {
  const { t } = useLanguage();
  const [desk, setDesk] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await aiCasesApi.opsDesk();
      setDesk(r.data);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    setBusy(true);
    setNotice('');
    try {
      const r = await aiCasesApi.restock({});
      setDesk(r.data.desk);
      setNotice(t('ai.opsDesk.applied', { n: r.data.applied.length }));
      if (onApplied) onApplied(r.data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const items = desk?.restock || [];
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('ai.opsDesk.title')}</Typography>
          {!compact && <Typography variant="body2" color="text.secondary">{t('ai.opsDesk.intro')}</Typography>}
        </Box>
        <Button variant="contained" disabled={busy || !items.length} onClick={apply}>
          {t('ai.opsDesk.applyAll')}
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1 }}>{notice}</Alert>}
      {!items.length && <Typography variant="body2" color="text.secondary">{t('ai.opsDesk.empty')}</Typography>}
      <Stack spacing={1}>
        {items.slice(0, compact ? 6 : 20).map((row) => (
          <Stack key={row.inventoryId} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('ai.opsDesk.stock', {
                stock: row.stock, min: row.minStock, pending: row.pendingDemand, qty: row.suggestedQty, unit: row.unit || '',
              })}
            </Typography>
            {row.reasons.includes('below_min') && <Chip size="small" color="warning" label={t('ai.opsDesk.belowMin')} />}
            {row.reasons.includes('pending_prescriptions') && <Chip size="small" label={t('ai.opsDesk.pendingRx')} />}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
