import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLanguage } from '../i18n/LanguageContext';

export default function SimulationDisclaimer() {
  const { t } = useLanguage();
  return (
    <Box
      component="footer"
      sx={{
        mt: 4,
        py: 2,
        px: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {t('disclaimer.main')}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {t('disclaimer.sub')}
      </Typography>
    </Box>
  );
}
