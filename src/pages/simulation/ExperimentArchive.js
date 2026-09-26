import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button, Alert,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { simulationApi } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ExperimentArchive() {
  const { t } = useLanguage();
  const [experiments, setExperiments] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    simulationApi.listExperiments().then((res) => setExperiments(res.data.experiments || [])).catch((e) => setErr(e.message));
  };

  useEffect(() => { load(); }, []);

  const rerunExact = async (id) => {
    setMsg('');
    setErr('');
    try {
      const { data } = await simulationApi.rerunExact(id);
      setMsg(`${t('archive.rerunStarted')} ${data.jobId}`);
      setTimeout(load, 2000);
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('archive.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('archive.intro')}</Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {msg && <Alert severity="info" sx={{ mb: 2 }}>{msg}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('overview.id')}</TableCell>
              <TableCell>{t('overview.scenario')}</TableCell>
              <TableCell>{t('overview.policy')}</TableCell>
              <TableCell>{t('archive.replicates')}</TableCell>
              <TableCell>{t('archive.gitCommit')}</TableCell>
              <TableCell>{t('overview.finished')}</TableCell>
              <TableCell align="right">{t('archive.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {experiments.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.id}</TableCell>
                <TableCell>{e.scenarioId}</TableCell>
                <TableCell>{e.policyId}</TableCell>
                <TableCell>{e.replicates ?? 1}</TableCell>
                <TableCell title={e.gitCommitHash || ''}>
                  {e.gitCommitHash ? e.gitCommitHash.slice(0, 7) : '—'}
                </TableCell>
                <TableCell>{e.finishedAt || e.startedAt}</TableCell>
                <TableCell align="right">
                  <Button size="small" component={RouterLink} to={`/simulation/results?experiment=${e.id}`}>{t('archive.view')}</Button>
                  <Button size="small" onClick={() => rerunExact(e.id)}>{t('archive.rerunExact')}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!experiments.length && (
          <Typography sx={{ p: 3 }} color="text.secondary">{t('overview.noRuns')}</Typography>
        )}
      </Paper>
    </Box>
  );
}
