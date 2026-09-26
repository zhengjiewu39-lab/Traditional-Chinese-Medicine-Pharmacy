import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, LinearProgress, Alert, List, ListItem, ListItemText,
} from '@mui/material';
import {
  simulationApi, loadScenarioDraft, loadSelectedPolicies, saveScenarioDraft,
} from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

export default function SimulationRun() {
  const { t } = useLanguage();
  const [replicates, setReplicates] = useState(1);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');

  const pollJob = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await simulationApi.getJob(jobId);
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, ...data } : j)));
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 800);
  };

  const resolveScenario = async () => {
    let scenario = loadScenarioDraft();
    if (!scenario) {
      const def = await simulationApi.getDefaultScenario();
      scenario = def.data.scenario;
    }
    const validated = await simulationApi.validateScenario(scenario);
    if (!validated.data.valid) {
      throw new Error((validated.data.errors || []).join('; ') || t('simulationRun.runFailed'));
    }
    const normalized = validated.data.scenario;
    saveScenarioDraft(normalized);
    return normalized;
  };

  const startRun = async (policyId) => {
    setError('');
    try {
      const scenario = await resolveScenario();
      const rep = Math.min(100, Math.max(1, Number(replicates) || 1));
      const { data } = await simulationApi.run({ scenario, policyId, replicates: rep });
      setJobs((prev) => [{ jobId: data.jobId, status: 'running', policyId }, ...prev]);
      pollJob(data.jobId);
    } catch (e) {
      const errs = e.response?.data?.errors;
      setError(
        Array.isArray(errs) ? errs.join('; ')
          : e.response?.data?.message || e.message || t('simulationRun.runFailed')
      );
    }
  };

  const runAll = () => {
    const policies = loadSelectedPolicies();
    if (!policies.length) {
      setError(t('simulationRun.needPolicies'));
      return;
    }
    policies.forEach((p) => startRun(p));
  };

  const cancel = async (jobId) => {
    await simulationApi.cancelJob(jobId);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('simulationRun.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('simulationRun.intro')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 3, mb: 2 }}>
        <TextField
          label={t('simulationRun.replicates')}
          type="number"
          value={replicates}
          onChange={(e) => setReplicates(e.target.value)}
          sx={{ mr: 2, width: 200 }}
        />
        <Button variant="contained" onClick={runAll}>{t('simulationRun.runSelected')}</Button>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{t('simulationRun.jobs')}</Typography>
        <List dense>
          {jobs.map((j) => (
            <ListItem key={j.jobId} secondaryAction={
              j.status === 'running' ? <Button size="small" onClick={() => cancel(j.jobId)}>{t('simulationRun.cancel')}</Button> : null
            }>
              <ListItemText
                primary={`${j.policyId} · ${j.jobId}`}
                secondary={`${t('simulationRun.status')}: ${j.status}${j.progress?.pct != null ? ` · ${j.progress.pct.toFixed(0)}%` : ''}`}
              />
              {j.status === 'running' && <LinearProgress sx={{ width: 120, ml: 2 }} />}
            </ListItem>
          ))}
        </List>
        {!jobs.length && <Typography color="text.secondary">{t('simulationRun.noJobs')}</Typography>}
      </Paper>
    </Box>
  );
}
