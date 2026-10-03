import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete, Box, Paper, Typography, TextField, Grid, MenuItem, Button, Alert, Stack, Divider,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { patientsApi } from '../../services/api';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';
import { meansNoAllergy } from '../../i18n/lookup';

const splitList = (s) => s.split(/[，,、;；\n]+/).map((x) => x.trim()).filter(Boolean);

function parseHerbLines(text) {
  return splitList(text).map((part) => {
    const m = part.match(/^(.+?)(\d+(?:\.\d+)?)\s*(g|克)?$/);
    return m ? { name: m[1].trim(), dosage: Number(m[2]), unit: 'g' } : { name: part, dosage: null, unit: 'g' };
  });
}

const EXAMPLES = {
  routine: { herbs: '黄芪15g，白术10g，茯苓12g，陈皮6g，甘草6g', age: '45', sex: 'male', allergies: 'none', meds: '' },
  hardStop: { herbs: '甘草6g，甘遂1g，大枣10g', age: '52', sex: 'female', allergies: 'none', meds: '' },
  interaction: { herbs: '丹参15g，当归10g，川芎9g，黄芪15g', age: '68', sex: 'male', allergies: 'none', meds: '' },
  missing: { herbs: '附子9g，干姜6g，甘草6g', age: '', sex: 'female', allergies: '', meds: '' },
};

export default function CaseIntake() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    herbs: '', rawText: '', age: '', sex: 'unknown', pregnancy: 'unknown', lactation: 'unknown', allergies: '', meds: '',
    doseCount: '7', usage: '', form: 'decoction', decoctionNotes: '',
    doctor: '', patientRef: 'P1', name: '', diagnosis: '', weightKg: '', allergySeverity: 'unknown', clinicalNotes: '',
  });
  const [legacyId, setLegacyId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    patientsApi.getAllPatients().then((r) => setPatients(r.data || [])).catch(() => setPatients([]));
  }, []);

  const applyPatient = (p) => {
    setSelected(p);
    if (!p) return;
    setForm((f) => ({
      ...f,
      patientRef: p.patientRef || `P${p.id}`,
      name: p.name || '',
      age: p.age != null ? String(p.age) : '',
      sex: p.gender === '男' ? 'male' : p.gender === '女' ? 'female' : 'unknown',
      allergies: Array.isArray(p.allergies) && p.allergies.length ? p.allergies.join('，') : f.allergies,
    }));
  };

  const loadExample = (key) => {
    const ex = EXAMPLES[key];
    const prefer = { routine: 1, hardStop: 2, interaction: 3, missing: 2 }[key];
    const p = patients.find((x) => x.id === prefer) || patients[0] || null;
    setForm((f) => ({
      ...f,
      herbs: ex.herbs,
      age: p?.age != null ? String(p.age) : ex.age,
      sex: p ? (p.gender === '女' ? 'female' : p.gender === '男' ? 'male' : ex.sex) : ex.sex,
      allergies: p?.allergies?.length ? p.allergies.join('，') : ex.allergies,
      meds: key === 'interaction' ? t('ai.intake.exWarfarin') : ex.meds,
      doctor: t('ai.intake.demoDoctor'),
      patientRef: p ? (p.patientRef || `P${p.id}`) : 'P1',
      name: p?.name || t('ai.intake.demoPatient'),
    }));
    setSelected(p);
  };

  const submit = async (body) => {
    setBusy(true);
    setError('');
    try {
      const created = await aiCasesApi.create(body);
      const id = created.data.case.caseId;
      await aiCasesApi.analyze(id);
      navigate(`/ai/reviews/${id}`);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitForm = () => {
    const allergies = form.allergies.trim() === '' ? undefined : (meansNoAllergy(form.allergies) ? [] : splitList(form.allergies));
    submit({
      source: { channel: 'counter', ...(form.rawText ? { rawText: form.rawText } : {}) },
      patient: {
        ...(form.patientRef ? { patientRef: form.patientRef } : {}),
        ...(form.name ? { name: form.name } : {}),
        ...(form.age !== '' ? { ageYears: Number(form.age) } : {}),
        ...(Number.isFinite(Number(form.weightKg)) && String(form.weightKg).trim() !== '' ? { weightKg: Number(form.weightKg) } : {}),
        sex: form.sex,
        pregnancy: form.pregnancy,
        lactation: form.lactation,
        allergySeverity: form.allergySeverity,
        ...(allergies !== undefined ? { allergies } : {}),
        currentMedications: splitList(form.meds),
      },
      prescriber: form.doctor ? { name: form.doctor } : {},
      prescription: {
        ...(form.herbs ? { herbs: parseHerbLines(form.herbs) } : {}),
        doseCount: Number(form.doseCount) || undefined,
        usage: form.usage || t('ai.intake.defaultUsage'),
        form: form.form,
        ...(form.diagnosis ? { diagnosisText: form.diagnosis } : {}),
        ...(form.decoctionNotes ? { decoctionNotes: form.decoctionNotes } : {}),
        ...(form.clinicalNotes ? { clinicalNotes: form.clinicalNotes } : {}),
        issuedAt: new Date().toISOString().slice(0, 10),
      },
    });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.intake.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('ai.intake.intro')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('ai.intake.importTitle')}</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" label={t('ai.intake.rxId')} value={legacyId} onChange={(e) => setLegacyId(e.target.value)} />
          <Button variant="outlined" disabled={busy || !Number(legacyId)} onClick={() => submit({ fromPrescriptionId: Number(legacyId) })}>{t('ai.intake.import')}</Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>{t('ai.intake.manual')}</Typography>
          <Button size="small" onClick={() => loadExample('routine')}>{t('ai.intake.exRoutine')}</Button>
          <Button size="small" onClick={() => loadExample('hardStop')}>{t('ai.intake.exHard')}</Button>
          <Button size="small" onClick={() => loadExample('interaction')}>{t('ai.intake.exInteract')}</Button>
          <Button size="small" onClick={() => loadExample('missing')}>{t('ai.intake.exMissing')}</Button>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label={t('ai.intake.herbs')} value={form.herbs} onChange={set('herbs')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label={t('ai.intake.rawText')} value={form.rawText} onChange={set('rawText')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={patients}
              value={selected}
              onChange={(_, v) => applyPatient(v)}
              getOptionLabel={(p) => `${p.name} · ${p.patientRef || `P${p.id}`}`}
              renderInput={(params) => <TextField {...params} label={t('ai.intake.pickPatient')} />}
            />
          </Grid>
          <Grid item xs={6} md={2}><TextField fullWidth label={t('ai.intake.patientRef')} value={form.patientRef} onChange={set('patientRef')} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth label={t('ai.intake.name')} value={form.name} onChange={set('name')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label={t('ai.intake.diagnosis')} value={form.diagnosis} onChange={set('diagnosis')} /></Grid>
          <Grid item xs={4} md={2}><TextField fullWidth label={t('ai.intake.age')} type="number" value={form.age} onChange={set('age')} /></Grid>
          <Grid item xs={4} md={2}><TextField fullWidth label={t('ai.intake.weight')} type="number" value={form.weightKg} onChange={set('weightKg')} /></Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label={t('ai.intake.allergySeverity')} value={form.allergySeverity} onChange={set('allergySeverity')}>
              <MenuItem value="unknown">{t('ai.allergySeverity.unknown')}</MenuItem>
              <MenuItem value="mild">{t('ai.allergySeverity.mild')}</MenuItem>
              <MenuItem value="severe">{t('ai.allergySeverity.severe')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label={t('ai.intake.sex')} value={form.sex} onChange={set('sex')}>
              <MenuItem value="male">{t('ai.sex.male')}</MenuItem>
              <MenuItem value="female">{t('ai.sex.female')}</MenuItem>
              <MenuItem value="unknown">{t('ai.sex.unknown')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label={t('ai.intake.pregnancy')} value={form.pregnancy} onChange={set('pregnancy')}>
              <MenuItem value="no">{t('ai.tri.no')}</MenuItem>
              <MenuItem value="yes">{t('ai.tri.yes')}</MenuItem>
              <MenuItem value="unknown">{t('ai.tri.unknown')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label={t('ai.intake.lactation')} value={form.lactation} onChange={set('lactation')}>
              <MenuItem value="no">{t('ai.tri.no')}</MenuItem>
              <MenuItem value="yes">{t('ai.tri.yes')}</MenuItem>
              <MenuItem value="unknown">{t('ai.tri.unknown')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label={t('ai.intake.allergies')} value={form.allergies} onChange={set('allergies')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label={t('ai.intake.meds')} value={form.meds} onChange={set('meds')} /></Grid>
          <Grid item xs={4} md={2}><TextField fullWidth label={t('ai.intake.doseCount')} type="number" value={form.doseCount} onChange={set('doseCount')} /></Grid>
          <Grid item xs={8} md={4}><TextField fullWidth label={t('ai.intake.usage')} value={form.usage} placeholder={t('ai.intake.defaultUsage')} onChange={set('usage')} /></Grid>
          <Grid item xs={6} md={2}>
            <TextField select fullWidth label={t('ai.intake.form')} value={form.form} onChange={set('form')}>
              {['decoction', 'granule', 'pill', 'powder', 'other'].map((v) => <MenuItem key={v} value={v}>{t(`ai.form.${v}`)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={4}><TextField fullWidth label={t('ai.intake.decoctionNotes')} value={form.decoctionNotes} onChange={set('decoctionNotes')} /></Grid>
          <Grid item xs={12}><TextField fullWidth label={t('ai.intake.clinicalNotes')} value={form.clinicalNotes} onChange={set('clinicalNotes')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label={t('ai.intake.doctor')} value={form.doctor} onChange={set('doctor')} helperText={t('ai.license.helper')} /></Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Button variant="contained" disabled={busy || !form.herbs} onClick={submitForm}>{t('ai.intake.submit')}</Button>
      </Paper>
    </Box>
  );
}
