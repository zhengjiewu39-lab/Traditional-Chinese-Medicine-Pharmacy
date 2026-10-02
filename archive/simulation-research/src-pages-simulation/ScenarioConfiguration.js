import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Alert, MenuItem,
} from '@mui/material';
import { simulationApi, loadScenarioDraft, saveScenarioDraft } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';

const REGION_TYPES = ['urban', 'suburban', 'rural'];

function formatErrors(errors) {
  if (!errors?.length) return [];
  return errors.map((e) => (typeof e === 'string' ? e : `${e.path || e.code}: ${e.message}`));
}

export default function ScenarioConfiguration() {
  const { t } = useLanguage();
  const [scenario, setScenario] = useState(null);
  const [help, setHelp] = useState({});
  const [presets, setPresets] = useState([]);
  const [errors, setErrors] = useState([]);
  const [jsonText, setJsonText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const draft = loadScenarioDraft();
    Promise.all([
      simulationApi.getDefaultScenario(),
      simulationApi.listPresets().catch(() => ({ data: { presets: [] } })),
    ])
      .then(async ([defRes, presetRes]) => {
        setHelp(defRes.data.help || {});
        setPresets(presetRes.data.presets || []);
        const initial = draft || defRes.data.scenario;
        const validated = await simulationApi.validateScenario(initial);
        const scen = validated.data.scenario || initial;
        setScenario(scen);
        if (draft) saveScenarioDraft(scen);
      });
  }, []);

  const update = (field, value) => setScenario((s) => ({ ...s, [field]: value }));

  const updateRegion = (rt, field, value) => {
    setScenario((s) => ({
      ...s,
      regions: { ...s.regions, [rt]: { ...s.regions[rt], [field]: Number(value) } },
    }));
  };

  const updateRegionPharmacyCount = (rt, value) => {
    setScenario((s) => ({
      ...s,
      regionPharmacyCounts: { ...s.regionPharmacyCounts, [rt]: Number(value) },
    }));
  };

  const updateDrug = (idx, field, value) => {
    setScenario((s) => {
      const drugs = [...s.drugs];
      drugs[idx] = { ...drugs[idx], [field]: field === 'name' || field === 'priority' || field === 'id' ? value : Number(value) };
      return { ...s, drugs };
    });
  };

  const updateLogistics = (field, value) => {
    setScenario((s) => ({
      ...s,
      logistics: { ...s.logistics, [field]: Number(value) },
    }));
  };

  const loadPreset = async (key) => {
    const { data } = await simulationApi.getPreset(key);
    setScenario(data.scenario);
    setMessage(t('scenario.presetLoaded', { name: key }));
  };

  const validateAndSave = async () => {
    const res = await simulationApi.validateScenario(scenario);
    if (!res.data.valid) {
      setErrors(formatErrors(res.data.errors));
      return;
    }
    saveScenarioDraft(res.data.scenario);
    setScenario(res.data.scenario);
    setErrors([]);
    const warn = res.data.warnings?.length ? ` (${res.data.warnings.join('; ')})` : '';
    setMessage(t('scenario.saved') + warn);
  };

  const exportJson = () => setJsonText(JSON.stringify(scenario, null, 2));

  const importJson = () => {
    try {
      setScenario(JSON.parse(jsonText));
      setMessage(t('scenario.imported'));
      setErrors([]);
    } catch {
      setErrors([t('scenario.invalidJson')]);
    }
  };

  if (!scenario) return null;

  const drugsShown = scenario.drugs.slice(0, scenario.drugCount ?? scenario.drugs.length);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('scenario.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('scenario.intro')}</Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((e, i) => <Typography key={i} variant="body2">{e}</Typography>)}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>{t('scenario.presets')}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {presets.map((p) => (
            <Button key={p.key} size="small" variant="outlined" onClick={() => loadPreset(p.key)}>{p.name}</Button>
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.core')}</Typography>
        <Grid container spacing={2}>
          {[
            ['randomSeed', t('scenario.fields.randomSeed'), scenario.randomSeed, false],
            ['simulationDays', t('scenario.fields.simulationDays'), scenario.simulationDays, false],
            ['warehouseCount', t('scenario.fields.warehouseCount'), scenario.warehouseCount, false],
            ['pharmacyCount', t('scenario.fields.pharmacyCount'), scenario.pharmacyCount, false],
            ['drugCount', t('scenario.fields.drugCount'), scenario.drugCount, false],
            ['defaultReplicates', t('scenario.fields.defaultReplicates'), scenario.defaultReplicates, false],
          ].map(([key, label, val]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <TextField
                fullWidth
                label={label}
                type="number"
                value={val}
                onChange={(e) => update(key, Number(e.target.value))}
                helperText={help[key]}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.logistics')}</Typography>
        <Grid container spacing={2}>
          {[
            ['orderCost', t('scenario.fields.orderCost'), scenario.logistics?.orderCost],
            ['transportCostPerUnit', t('scenario.fields.transportCostPerUnit'), scenario.logistics?.transportCostPerUnit],
            ['truckCapacityUnits', t('scenario.fields.truckCapacityUnits'), scenario.logistics?.truckCapacityUnits],
            ['dailyDispatchCapacityPerWarehouse', t('scenario.fields.dailyDispatchCap'), scenario.logistics?.dailyDispatchCapacityPerWarehouse],
          ].map(([key, label, val]) => (
            <Grid item xs={12} sm={6} md={3} key={key}>
              <TextField fullWidth type="number" label={label} value={val ?? ''} onChange={(e) => updateLogistics(key, e.target.value)} />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.regionPharmacyCounts')}</Typography>
        <Grid container spacing={2}>
          {REGION_TYPES.map((rt) => (
            <Grid item xs={4} key={rt}>
              <TextField
                fullWidth
                type="number"
                label={rt}
                value={scenario.regionPharmacyCounts?.[rt] ?? ''}
                onChange={(e) => updateRegionPharmacyCount(rt, e.target.value)}
                helperText={t('scenario.regionPharmacyHint')}
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
              {[
                ['population', t('scenario.fields.population')],
                ['baseDemand', t('scenario.fields.baseDemand')],
                ['demandVolatility', t('scenario.fields.demandVolatility')],
                ['distanceKm', t('scenario.fields.distanceKm')],
                ['roadAccessibility', t('scenario.fields.roadAccessibility')],
                ['transitDays', t('scenario.fields.transitDays')],
                ['vulnerabilityWeight', t('scenario.fields.vulnerabilityWeight')],
              ].map(([f, label]) => (
                <TextField
                  key={f}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                  label={label}
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
        <Typography variant="h6" gutterBottom>{t('scenario.drugs')}</Typography>
        {drugsShown.map((d, idx) => (
          <Grid container spacing={1} key={d.id} sx={{ mb: 1 }}>
            <Grid item xs={2}><TextField size="small" fullWidth label="id" value={d.id} disabled /></Grid>
            <Grid item xs={2}>
              <TextField size="small" select fullWidth label="priority" value={d.priority} onChange={(e) => updateDrug(idx, 'priority', e.target.value)}>
                {['essential', 'chronic-care', 'routine'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={2}><TextField size="small" fullWidth type="number" label={t('scenario.fields.initialStock')} value={d.initialStock} onChange={(e) => updateDrug(idx, 'initialStock', e.target.value)} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth type="number" label={t('scenario.fields.unitProcurementCost')} value={d.unitProcurementCost} onChange={(e) => updateDrug(idx, 'unitProcurementCost', e.target.value)} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth type="number" label={t('scenario.fields.holdingCost')} value={d.holdingCostPerUnitDay} onChange={(e) => updateDrug(idx, 'holdingCostPerUnitDay', e.target.value)} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth type="number" label={t('scenario.fields.stockoutPenalty')} value={d.stockoutPenalty} onChange={(e) => updateDrug(idx, 'stockoutPenalty', e.target.value)} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth type="number" label={t('scenario.fields.leadTimeDays')} value={d.leadTimeDays} onChange={(e) => updateDrug(idx, 'leadTimeDays', e.target.value)} /></Grid>
          </Grid>
        ))}
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
            <Grid item xs={2}><TextField size="small" fullWidth label="durationDays" type="number" value={ev.durationDays} onChange={(e) => {
              const events = [...scenario.events];
              events[idx] = { ...ev, durationDays: Number(e.target.value) };
              update('events', events);
            }} /></Grid>
            <Grid item xs={2}><TextField size="small" fullWidth label="magnitude" type="number" value={ev.magnitude} onChange={(e) => {
              const events = [...scenario.events];
              events[idx] = { ...ev, magnitude: Number(e.target.value) };
              update('events', events);
            }} /></Grid>
            <Grid item xs={3}><TextField size="small" fullWidth label="targetRegions" value={(ev.targetRegions || []).join(', ')} disabled helperText={t('scenario.eventRegionsHint')} /></Grid>
          </Grid>
        ))}
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>{t('scenario.jsonTitle')}</Typography>
        <TextField fullWidth multiline minRows={6} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder={t('scenario.jsonPlaceholder')} />
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={exportJson}>{t('scenario.export')}</Button>
          <Button variant="outlined" onClick={importJson}>{t('scenario.import')}</Button>
          <Button variant="contained" onClick={validateAndSave}>{t('scenario.validateSave')}</Button>
        </Box>
      </Paper>
    </Box>
  );
}
