import React from 'react';
import { Alert } from '@mui/material';
import { useLanguage } from '../../i18n/LanguageContext';

export default function SyntheticDataNotice() {
  const { t } = useLanguage();
  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0 }}>
      {t('ai.syntheticNotice')}
    </Alert>
  );
}
