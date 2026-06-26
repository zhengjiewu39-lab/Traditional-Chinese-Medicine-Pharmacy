import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Autocomplete, Chip, Alert,
  LinearProgress, List, ListItem, ListItemText, Divider, Card, CardContent, Stepper, Step, StepLabel,
} from '@mui/material';
import { Save, CheckCircle, ContentCopy, LocalHospital } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { patientsApi, prescriptionApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STEPS = ['待审核', '已审核', '配药中', '待取药', '已完成'];

function statusStep(status) {
  const map = { 待审核: 0, 已审核: 1, 配药中: 2, 待取药: 3, 已完成: 4, 已驳回: 0 };
  return map[status] ?? 0;
}

function DoctorWorkbench() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [patient, setPatient] = useState(null);
  const [template, setTemplate] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptionText, setPrescriptionText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        patientsApi.getAllPatients(),
        prescriptionApi.getTemplates(),
      ]);
      setPatients(p.data);
      setTemplates(t.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!patient) { setHistory([]); return; }
    prescriptionApi.getAllPrescriptions({ patientId: patient.id })
      .then(res => setHistory(res.data.filter(rx => rx.status === '已完成').slice(0, 5)))
      .catch(() => setHistory([]));
  }, [patient]);

  useEffect(() => {
    if (!template) return;
    setDiagnosis(template.indication || '');
    setPrescriptionText(
      (template.herbs || []).map(h => {
        const name = typeof h === 'string' ? h : h.name;
        const dosage = typeof h === 'object' && h.dosage ? h.dosage : '10g';
        return `${name}${dosage}`;
      }).join('，')
    );
  }, [template]);

  const applyHistory = (rx) => {
    setDiagnosis(rx.diagnosis || '');
    setPrescriptionText((rx.herbs || []).map(h => `${h.name}${h.dosage || '10g'}`).join('，'));
  };

  const handleSubmit = async (autoApprove = false) => {
    if (!patient) { setError('请选择患者'); return; }
    if (!prescriptionText.trim()) { setError('请填写处方'); return; }
    setSubmitting(true);
    setError('');
    try {
      const herbs = prescriptionText.split(/[，,、]+/).filter(Boolean).map(s => {
        const m = s.match(/^(.+?)(\d+(?:\.\d+)?\s*(?:g|克|盒|瓶|袋)?)$/);
        return m ? { name: m[1].trim(), dosage: m[2].trim() } : { name: s.trim(), dosage: '10g' };
      });

      const created = await prescriptionApi.createPrescription({
        patientId: patient.id,
        patientName: patient.name,
        doctor: user?.name || '医生',
        diagnosis,
        herbs,
        prescriptionText,
        patientAge: patient.age,
        patientGender: patient.gender,
      });

      let final = created.data;
      if (autoApprove && final.status === '待审核') {
        const approved = await prescriptionApi.approvePrescription(final.id, { reviewer: user?.name });
        final = approved.data;
      }

      setResult(final);
    } catch (e) {
      setError(e.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (result?.pickupCode) navigator.clipboard?.writeText(result.pickupCode);
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>医生工作台</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        选患者 → 调模板/历史方 → 开方提交 → 自动生成取药码
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {result ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <CheckCircle color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h6" gutterBottom>处方已提交</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {result.patientName} · {result.diagnosis} · 状态：{result.status}
          </Typography>
          {result.pickupCode && (
            <>
              <Typography variant="h3" fontWeight={800} color="primary.main" sx={{ my: 2, letterSpacing: 4 }}>
                {result.pickupCode}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>请将此取药码告知患者，到店收银台出示即可</Typography>
              <Button startIcon={<ContentCopy />} onClick={copyCode} sx={{ mr: 1 }}>复制取药码</Button>
            </>
          )}
          <Button variant="contained" onClick={() => navigate(`/billing?code=${result.pickupCode}`)} sx={{ mr: 1 }}>
            跳转收银台
          </Button>
          <Button onClick={() => { setResult(null); setPrescriptionText(''); setDiagnosis(''); }}>继续开方</Button>
          <Box sx={{ mt: 3, maxWidth: 500, mx: 'auto' }}>
            <Stepper activeStep={statusStep(result.status)} alternativeLabel>
              {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
            </Stepper>
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>1. 选择患者</Typography>
              <Autocomplete
                options={patients}
                getOptionLabel={p => `${p.name} (${p.phone})`}
                value={patient}
                onChange={(_, v) => setPatient(v)}
                renderInput={params => <TextField {...params} label="患者" size="small" />}
              />
              {patient && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">过敏史</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {(patient.allergies || []).length
                      ? patient.allergies.map(a => <Chip key={a} label={a} size="small" color="error" sx={{ mr: 0.5 }} />)
                      : <Typography variant="body2">无</Typography>}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>病史</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {(patient.medicalHistory || []).map(h => <Chip key={h} label={h} size="small" sx={{ mr: 0.5 }} />)}
                  </Box>
                </Box>
              )}
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>2. 处方模板</Typography>
              <Autocomplete
                options={templates}
                getOptionLabel={t => t.name}
                value={template}
                onChange={(_, v) => setTemplate(v)}
                renderInput={params => <TextField {...params} label="经典方剂" size="small" />}
              />
              {history.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>历史有效方</Typography>
                  <List dense>
                    {history.map(rx => (
                      <ListItem key={rx.id} button onClick={() => applyHistory(rx)}>
                        <ListItemText primary={rx.diagnosis} secondary={rx.date} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>3. 开方</Typography>
              <TextField fullWidth label="诊断/病证" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} sx={{ mb: 2 }} />
              <TextField
                fullWidth multiline rows={6} label="处方内容"
                placeholder="黄芪15g，当归10g，白芍10g，川芎6g，甘草6g"
                value={prescriptionText} onChange={e => setPrescriptionText(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" startIcon={<LocalHospital />} onClick={() => navigate('/prescriptions/review')}>
                  高级审方
                </Button>
                <Button variant="outlined" startIcon={<Save />} disabled={submitting} onClick={() => handleSubmit(false)}>
                  提交待审
                </Button>
                <Button variant="contained" startIcon={<CheckCircle />} disabled={submitting} onClick={() => handleSubmit(true)}>
                  提交并发取药码
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default DoctorWorkbench;
