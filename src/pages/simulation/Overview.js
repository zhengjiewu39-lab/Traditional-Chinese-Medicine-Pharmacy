import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Alert, CircularProgress, List, ListItem, ListItemText,
} from '@mui/material';
import { simulationApi } from '../../services/simulationApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

export default function Overview() {
  const { t } = useLanguage();
  const [meta, setMeta] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([simulationApi.getMeta(), simulationApi.listExperiments()])
      .then(([m, e]) => {
        setMeta(m.data);
        setExperiments(e.data.experiments || []);
      })
      .catch((err) => setError(formatApiError(err, t('errors.loadSimulation'))))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = experiments[0];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('overview.title')}</Typography>
      <Chip label={t('overview.badge')} color="warning" sx={{ mb: 2 }} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('overview.purposeTitle')}</Typography>
            <Typography variant="body2" paragraph>{t('overview.purposeBody')}</Typography>
            {meta && (
              <Typography variant="caption" color="text.secondary" display="block">
                Engine: {meta.engineVersion} · {meta.dataClassification}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('overview.experimentsTitle')}</Typography>
            <Typography variant="h3" color="primary">{experiments.length}</Typography>
            <Typography variant="body2" color="text.secondary">{t('overview.savedRuns')}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('overview.latestTitle')}</Typography>
            {!latest ? (
              <Typography color="text.secondary">{t('overview.noRuns')}</Typography>
            ) : (
              <List dense>
                <ListItem><ListItemText primary={t('overview.id')} secondary={latest.id} /></ListItem>
                <ListItem><ListItemText primary={t('overview.scenario')} secondary={latest.scenarioId} /></ListItem>
                <ListItem><ListItemText primary={t('overview.policy')} secondary={latest.policyId} /></ListItem>
                <ListItem><ListItemText primary={t('overview.seed')} secondary={latest.randomSeed} /></ListItem>
                <ListItem><ListItemText primary={t('overview.finished')} secondary={latest.finishedAt || latest.startedAt} /></ListItem>
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
