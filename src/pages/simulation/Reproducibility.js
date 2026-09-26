import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, MenuItem, TextField, Button, Alert, List, ListItem, ListItemText,
} from '@mui/material';
import { simulationApi, saveScenarioDraft } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

export default function Reproducibility() {
  const { t } = useLanguage();
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rerunMsg, setRerunMsg] = useState('');

  useEffect(() => {
    simulationApi.listExperiments().then((res) => {
      const list = res.data.experiments || [];
      setExperiments(list);
      if (list.length) setSelectedId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    simulationApi.getExperiment(selectedId).then((res) => setDetail(res.data));
  }, [selectedId]);

  const copyConfig = () => {
    if (!detail?.scenario) return;
    navigator.clipboard.writeText(JSON.stringify({
      scenario: detail.scenario,
      policyId: detail.policyId,
      replicates: detail.replicates || 1,
    }, null, 2));
    setCopied(true);
  };

  const rerun = async () => {
    if (!detail) return;
    saveScenarioDraft(detail.scenario);
    const { data } = await simulationApi.run({
      scenario: detail.scenario,
      policyId: detail.policyId,
      replicates: detail.replicates || 1,
    });
    setRerunMsg(`${t('reproducibility.rerunAccepted')} ${data.jobId} ${t('reproducibility.sameConfig')}`);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('reproducibility.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('reproducibility.intro')}</Typography>

      <TextField select label={t('results.experiment')} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 320, mb: 2 }}>
        {experiments.map((e) => (
          <MenuItem key={e.id} value={e.id}>{e.id}</MenuItem>
        ))}
      </TextField>

      {detail && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <List dense>
            <ListItem><ListItemText primary={t('reproducibility.experimentId')} secondary={detail.id} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.scenarioId')} secondary={detail.scenarioId} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.policy')} secondary={`${detail.policyId} v${detail.policyVersion}`} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.engine')} secondary={detail.engineVersion} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.node')} secondary={detail.nodeVersion} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.randomSeed')} secondary={detail.randomSeed} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.startedFinished')} secondary={`${detail.startedAt} → ${detail.finishedAt}`} /></ListItem>
            <ListItem><ListItemText primary={t('reproducibility.dataClass')} secondary={detail.dataClassification} /></ListItem>
          </List>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button variant="outlined" onClick={copyConfig}>{t('reproducibility.copyConfig')}</Button>
            <Button variant="contained" onClick={rerun}>{t('reproducibility.rerun')}</Button>
          </Box>
          {copied && <Alert severity="success" sx={{ mt: 2 }}>{t('reproducibility.copied')}</Alert>}
          {rerunMsg && <Alert severity="info" sx={{ mt: 2 }}>{rerunMsg}</Alert>}
        </Paper>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{t('reproducibility.howTo')}</Typography>
        <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
          <li>{t('reproducibility.step1')}</li>
          <li>{t('reproducibility.step2')}</li>
          <li>{t('reproducibility.step3')}</li>
          <li>{t('reproducibility.step4')}</li>
        </Typography>
      </Paper>
    </Box>
  );
}
