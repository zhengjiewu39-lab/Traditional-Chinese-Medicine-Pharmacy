import React, { useEffect, useState } from 'react';
import { Alert, Button, Box } from '@mui/material';
import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase';
import { useLanguage } from '../i18n/LanguageContext';

export default function ApiStatusBanner() {
  const { t } = useLanguage();
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(true);

  const check = () => {
    setChecking(true);
    axios
      .get(`${getApiBaseUrl().replace(/\/api$/, '')}/api/health`, { timeout: 5000 })
      .then((res) => {
        const routeVer = res.data?.simulationRouteVersion ?? 1;
        setDown(
          !res.data?.features?.includes('supply-simulation-research')
          || routeVer < 2
        );
      })
      .catch(() => setDown(true))
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  if (checking || !down) return null;

  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={check}>
          {t('apiBanner.retry')}
        </Button>
      }
    >
      {t('apiBanner.message')}{' '}
      <Box component="code" sx={{ mx: 0.5 }}>npm run server</Box>
      {t('apiBanner.or')}{' '}
      <Box component="code" sx={{ mx: 0.5 }}>npm run dev</Box>
      {t('apiBanner.ports')}
    </Alert>
  );
}
