import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Alert, Tooltip, IconButton,
} from '@mui/material';
import HelpOutline from '@mui/icons-material/HelpOutline';
import { simulationApi, loadScenarioDraft, saveScenarioDraft } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

const REGION_TYPES = ['urban', 'suburban', 'rural'];

export default function ScenarioConfiguration() {
  const { t } = useLanguage();
  const [scenario, setScenario] = useState(null);
  const [help, setHelp] = useState({});
  const [errors, setErrors] = useState([]);
  const [jsonText, setJsonText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const draft = loadScenarioDraft();
    simulationApi.getDefaultScenario().then(async (res) => {
      setHelp(res.data.help || {});
      const initial = draft || res.data.scenario;
      const validated = await simulationApi.validateScenario(initial);
      const scen = validated.data.scenario || initial;
      setScenario(scen);
      if (draft) saveScenarioDraft(scen);
    });
  }, []);

  const update = (field, value) => {
    setScenario((s) => ({ ...s, [field]: value }));
  };

  const updateRegion = (rt, field, value) => {
    setScenario((s) => ({
      ...s,
      regions: { ...s.regions, [rt]: { ...s.regions[rt], [field]: Number(value) } },
    }));
  };

  const validateAndSave = async () => {
    const res = await simulationApi.validateScenario(scenario);
    if (!res.data.valid) {
      setErrors(res.data.errors || []);
      return;
    }
    saveScenarioDraft(res.data.scenario);
    setScenario(res.data.scenario);
    setErrors([]);
    const warn = res.data.warnings?.length ? ` (${res.data.warnings.join('; ')})` : '';
    setMessage(t('scenario.saved') + warn);
  };

  const exportJson = () => {
    setJsonText(JSON.stringify(scenario, null, 2));
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setScenario(parsed);
      setMessage(t('scenario.imported'));
    } catch {
      setErrors([t('scenario.invalidJson')]);
    }
  };

  if (!scenario) return null;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('scenario.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('scenario.intro')}</Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {errors.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{errors.join('; ')}</Alert>}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Grid container spacing={2}>
          {[
            ['randomSeed', t('scenario.fields.randomSeed'), scenario.randomSeed],
            ['simulationDays', t('scenario.fields.simulationDays'), scenario.simulationDays],
            ['warehouseCount', t('scenario.fields.warehouseCount'), scenario.warehouseCount],
            ['pharmacyCount', t('scenario.fields.pharmacyCount'), scenario.pharmacyCount],
            ['drugCount', t('scenario.fields.drugCount'), scenario.drugCount],
          ].map(([key, label, val]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <TextField
                fullWidth
                label={label}
                type="number"
                value={val}
                onChange={(e) => update(key, Number(e.target.value))}
                helperText={help[key]}
                InputProps={{
                  endAdornment: help[key] ? (
                    <Tooltip title={help[key]}><IconButton size="small"><HelpOutline fontSize="small" /></IconButton></Tooltip>
                  ) : null,
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.regions')}</Typography>
        <Grid container spacing={2}>
          {REGION_TYPES.map((rt) => (
            <Grid item xs={12} md={4} key={rt}>
              <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{rt}</Typography>
              {['population', 'baseDemand', 'demandVolatility', 'transitDays', 'vulnerabilityWeight'].map((f) => (
                <TextField
                  key={f}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                  label={f}
                  type="number"
                  value={scenario.regions[rt][f]}
                  onChange={(e) => updateRegion(rt, f, e.target.value)}
                />
              ))}
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.events')}</Typography>
        {scenario.events.map((ev, idx) => (
          <Grid container spacing={1} key={idx} sx={{ mb: 1 }}>
            <Grid item xs={3}><TextField size="small" fullWidth label="type" value={ev.type} disabled /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth label="startDay" type="number" value={ev.startDay} onChange={(e) => {
              const events = [...scenario.events];
              events[idx] = { ...ev, startDay: Number(e.target.value) };
              update('events', events);
            }} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth label="duration" type="number" value={ev.durationDays} onChange={(e) => {
              const events = [...scenario.events];
              events[idx] = { ...ev, durationDays: Number(e.target.value) };
              update('events', events);
            }} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth label="magnitude" type="number" value={ev.magnitude} onChange={(e) => {
              const events = [...scenario.events];
              events[idx] = { ...ev, magnitude: Number(e.target.value) };
              update('events', events);
            }} /></Grid>
          </Grid>
        ))}
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.jsonTitle')}</Typography>
        <TextField fullWidth multiline minRows={6} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder={t('scenario.jsonPlaceholder')} />
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={exportJson}>{t('scenario.export')}</Button>
          <Button variant="outlined" onClick={importJson}>{t('scenario.import')}</Button>
          <Button variant="contained" onClick={validateAndSave}>{t('scenario.validateSave')}</Button>
        </Box>
      </Paper>
    </Box>
  );
}
