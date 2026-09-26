import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Alert, Button,
} from '@mui/material';
import { simulationApi, loadSelectedPolicies, saveSelectedPolicies } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StrategyComparison() {
  const { t } = useLanguage();
  const [policies, setPolicies] = useState([]);
  const [selected, setSelected] = useState(loadSelectedPolicies());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    simulationApi.getPolicies().then((res) => setPolicies(res.data.policies || []));
  }, []);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSaved(false);
  };

  const persist = () => {
    saveSelectedPolicies(selected);
    setSaved(true);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('strategies.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('strategies.intro')}</Typography>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('strategies.saved')}</Alert>}
      <Paper sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('strategies.select')}</TableCell>
              <TableCell>{t('strategies.policyId')}</TableCell>
              <TableCell>{t('strategies.name')}</TableCell>
              <TableCell>{t('strategies.version')}</TableCell>
              <TableCell>{t('strategies.algorithm')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Checkbox checked={selected.includes(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                <TableCell>{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.version}</TableCell>
                <TableCell>{p.algorithm || p.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button sx={{ mt: 2 }} variant="contained" disabled={!selected.length} onClick={persist}>
          {t('strategies.saveSelection')}
        </Button>
      </Paper>
    </Box>
  );
}
