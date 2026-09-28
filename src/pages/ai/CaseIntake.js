import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Grid, MenuItem, Button, Alert, Stack, Divider, FormControlLabel, Switch,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';

const splitList = (s) => s.split(/[，,、;；\n]+/).map((x) => x.trim()).filter(Boolean);

function parseHerbLines(text) {
  return splitList(text).map((part) => {
    const m = part.match(/^(.+?)(\d+(?:\.\d+)?)\s*(g|克)?$/);
    return m ? { name: m[1].trim(), dosage: Number(m[2]), unit: 'g' } : { name: part, dosage: null, unit: 'g' };
  });
}

const EXAMPLES = {
  routine: { herbs: '黄芪15g，白术10g，茯苓12g，陈皮6g，甘草6g', age: '45', sex: 'male', allergies: '无', meds: '' },
  hardStop: { herbs: '甘草6g，甘遂1g，大枣10g', age: '52', sex: 'female', allergies: '无', meds: '' },
  interaction: { herbs: '丹参15g，当归10g，川芎9g，黄芪15g', age: '68', sex: 'male', allergies: '无', meds: '华法林' },
  missing: { herbs: '附子9g，干姜6g，甘草6g', age: '', sex: 'female', allergies: '', meds: '' },
};

export default function CaseIntake() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    herbs: '', rawText: '', age: '', sex: 'unknown', pregnancy: 'unknown', lactation: 'unknown', allergies: '', meds: '',
    doseCount: '7', usage: '水煎服，日一剂，分两次温服', form: 'decoction', decoctionNotes: '', doctor: '', licenseVerified: true, patientRef: '', name: '',
  });
  const [legacyId, setLegacyId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const loadExample = (key) => {
    const ex = EXAMPLES[key];
    setForm((f) => ({ ...f, herbs: ex.herbs, age: ex.age, sex: ex.sex, allergies: ex.allergies, meds: ex.meds, doctor: '合成医师', patientRef: 'P1', name: '合成患者' }));
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
    const allergies = form.allergies.trim() === '' ? undefined : (form.allergies.trim() === '无' ? [] : splitList(form.allergies));
    submit({
      source: { channel: 'counter', ...(form.rawText ? { rawText: form.rawText } : {}) },
      patient: {
        ...(form.patientRef ? { patientRef: form.patientRef } : {}),
        ...(form.name ? { name: form.name } : {}),
        ...(form.age !== '' ? { ageYears: Number(form.age) } : {}),
        sex: form.sex,
        pregnancy: form.pregnancy,
        lactation: form.lactation,
        ...(allergies !== undefined ? { allergies } : {}),
        currentMedications: splitList(form.meds),
      },
      prescriber: form.doctor ? { name: form.doctor, licenseVerified: form.licenseVerified } : {},
      prescription: {
        ...(form.herbs ? { herbs: parseHerbLines(form.herbs) } : {}),
        doseCount: Number(form.doseCount) || undefined,
        usage: form.usage || undefined,
        form: form.form,
        ...(form.decoctionNotes ? { decoctionNotes: form.decoctionNotes } : {}),
        issuedAt: new Date().toISOString().slice(0, 10),
      },
    });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>患者与处方接收</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        录入处方后系统自动进行规则筛查、证据检索和AI解释生成，然后进入药师审核队列。AI不会批准处方。
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>从已有处方记录导入</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" label="处方编号" value={legacyId} onChange={(e) => setLegacyId(e.target.value)} />
          <Button variant="outlined" disabled={busy || !Number(legacyId)} onClick={() => submit({ fromPrescriptionId: Number(legacyId) })}>导入并筛查</Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>手工录入</Typography>
          <Button size="small" onClick={() => loadExample('routine')}>示例：常规</Button>
          <Button size="small" onClick={() => loadExample('hardStop')}>示例：十八反</Button>
          <Button size="small" onClick={() => loadExample('interaction')}>示例：药物相互作用</Button>
          <Button size="small" onClick={() => loadExample('missing')}>示例：信息缺失</Button>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="药味与剂量（如：黄芪15g，白术10g）" value={form.herbs} onChange={set('herbs')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="原始处方文字（可选，作为数据而非指令处理）" value={form.rawText} onChange={set('rawText')} />
          </Grid>
          <Grid item xs={6} md={2}><TextField fullWidth label="患者编号" value={form.patientRef} onChange={set('patientRef')} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth label="姓名" value={form.name} onChange={set('name')} /></Grid>
          <Grid item xs={4} md={2}><TextField fullWidth label="年龄" type="number" value={form.age} onChange={set('age')} /></Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label="性别" value={form.sex} onChange={set('sex')}>
              <MenuItem value="male">男</MenuItem><MenuItem value="female">女</MenuItem><MenuItem value="unknown">未知</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label="妊娠" value={form.pregnancy} onChange={set('pregnancy')}>
              <MenuItem value="no">否</MenuItem><MenuItem value="yes">是</MenuItem><MenuItem value="unknown">未确认</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label="哺乳" value={form.lactation} onChange={set('lactation')}>
              <MenuItem value="no">否</MenuItem><MenuItem value="yes">是</MenuItem><MenuItem value="unknown">未确认</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="过敏史（填“无”表示无过敏；留空表示未记录）" value={form.allergies} onChange={set('allergies')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="当前合并用药（逗号分隔）" value={form.meds} onChange={set('meds')} /></Grid>
          <Grid item xs={4} md={2}><TextField fullWidth label="剂数" type="number" value={form.doseCount} onChange={set('doseCount')} /></Grid>
          <Grid item xs={8} md={4}><TextField fullWidth label="用法用量" value={form.usage} onChange={set('usage')} /></Grid>
          <Grid item xs={6} md={2}>
            <TextField select fullWidth label="剂型" value={form.form} onChange={set('form')}>
              <MenuItem value="decoction">汤剂</MenuItem><MenuItem value="granule">颗粒</MenuItem><MenuItem value="pill">丸剂</MenuItem><MenuItem value="powder">散剂</MenuItem><MenuItem value="other">其他</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={4}><TextField fullWidth label="煎煮说明（如：附子先煎）" value={form.decoctionNotes} onChange={set('decoctionNotes')} /></Grid>
          <Grid item xs={6} md={3}><TextField fullWidth label="处方医师" value={form.doctor} onChange={set('doctor')} /></Grid>
          <Grid item xs={6} md={3}>
            <FormControlLabel control={<Switch checked={form.licenseVerified} onChange={set('licenseVerified')} />} label="医师资质已核验" />
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Button variant="contained" disabled={busy || !form.herbs} onClick={submitForm}>提交并进行AI筛查</Button>
      </Paper>
    </Box>
  );
}
