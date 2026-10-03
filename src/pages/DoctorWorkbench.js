import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Autocomplete, Chip, Alert,
  LinearProgress, List, ListItem, ListItemText, Stack, MenuItem,
} from '@mui/material';
import { AutoAwesome, Send } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { patientsApi, prescriptionApi } from '../services/api';
import { aiDraftsApi, aiCasesApi, aiGovernanceApi } from '../services/aiApi';
import { formatApiError } from '../config/httpClient';
import { DISPLAY_SOURCE_LABELS } from '../config/aiLabels';
import { RiskTierChip as TierChip } from '../components/ai/Badges';
import { useAuth } from '../contexts/AuthContext';
import ConnectRealAi from '../components/ConnectRealAi';
import { useLanguage } from '../i18n/LanguageContext';

export default function DoctorWorkbench() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [ownCases, setOwnCases] = useState([]);
  const [patient, setPatient] = useState(null);
  const [template, setTemplate] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [decoctionNotes, setDecoctionNotes] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [allergySeverity, setAllergySeverity] = useState('unknown');
  const [prescriptionText, setPrescriptionText] = useState('');
  const [draft, setDraft] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const draftIdRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t, mine, cases, rt] = await Promise.all([
        patientsApi.getAllPatients(),
        prescriptionApi.getTemplates(),
        aiDraftsApi.list().catch(() => ({ data: { drafts: [] } })),
        aiCasesApi.list().catch(() => ({ data: { cases: [] } })),
        aiGovernanceApi.runtime().catch(() => ({ data: { runtime: {} } })),
      ]);
      setPatients(p.data);
      setTemplates(t.data);
      setRuntime(rt.data.runtime);
      const open = (mine.data.drafts || []).find((d) => d.status === 'draft');
      if (open) {
        setDraft(open);
        draftIdRef.current = open.draftId;
        setDiagnosis(open.clinical?.diagnosisText || '');
        setPrescriptionText(open.prescriptionText || (open.prescription?.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}g`).join('，'));
        const sug = await aiDraftsApi.suggestions(open.draftId);
        setSuggestions(sug.data.suggestions || []);
      }
      setOwnCases(cases.data.cases || []);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!template) return;
    setDiagnosis(template.indication || '');
    setPrescriptionText(
      (template.herbs || []).map((h) => {
        const name = typeof h === 'string' ? h : h.name;
        const dosage = typeof h === 'object' && h.dosage ? h.dosage : '10g';
        return `${name}${dosage}`;
      }).join('，'),
    );
  }, [template]);

  const runAi = async ({ submitAfter = false } = {}) => {
    if (!prescriptionText.trim()) { setError(t('ai.doctor.needRx')); return; }
    if (submitAfter && !patient) { setError(t('ai.doctor.needPatient')); return; }
    setBusy(true);
    setError('');
    try {
      const body = {
        diagnosisText: diagnosis,
        notes: clinicalNotes,
        prescriptionText,
        prescription: {
          diagnosisText: diagnosis,
          decoctionNotes,
          clinicalNotes,
        },
        patient: {
          ...(patient ? {
            patientRef: patient.patientRef || `P${patient.id}`,
            legacyPatientId: String(patient.id),
            name: patient.name,
            ageYears: patient.age,
            sex: patient.gender === '男' ? 'male' : patient.gender === '女' ? 'female' : 'unknown',
            allergies: patient.allergies || [],
            phone: patient.phone,
          } : {}),
          ...(Number.isFinite(Number(weightKg)) && String(weightKg).trim() !== '' ? { weightKg: Number(weightKg) } : {}),
          allergySeverity,
        },
      };
      let id = draftIdRef.current;
      if (!id) {
        const created = await aiDraftsApi.create(body);
        id = created.data.draft.draftId;
        draftIdRef.current = id;
        setDraft(created.data.draft);
      } else {
        await aiDraftsApi.patch(id, body);
      }
      const out = await aiDraftsApi.analyze(id);
      setDraft(out.data.draft);
      setAnalysis(out.data.analysis);
      setSuggestions(out.data.suggestions || []);
      if (submitAfter) {
        const submitted = await aiDraftsApi.submit(id);
        setNotice(t('ai.doctor.submitted', { id: submitted.data.case.caseId.slice(-8) }));
        draftIdRef.current = null;
        setDraft(null);
        setSuggestions([]);
        setPrescriptionText('');
        setDiagnosis('');
        const cases = await aiCasesApi.list();
        setOwnCases(cases.data.cases || []);
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const applyChange = async (suggestionId) => {
    try {
      const out = await aiDraftsApi.dispose(draftIdRef.current, suggestionId, {
        status: 'accepted', reasonCode: 'clinically_appropriate',
      });
      setDraft(out.data.draft);
      if (out.data.draft.prescriptionText) setPrescriptionText(out.data.draft.prescriptionText);
      setNotice(t('ai.doctor.applied'));
      await runAi();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  if (loading) return <LinearProgress />;
  const sourceLabel = analysis?.displaySource
    ? t(DISPLAY_SOURCE_LABELS[analysis.displaySource] || analysis.displaySource)
    : '';
  const hard = (analysis?.hardStops || []);
  const alerts = (analysis?.alerts || []).slice(0, 6);
  const candidates = suggestions.filter((s) => s.proposedChange && s.status === 'pending');
  const usingMock = runtime?.isMock || runtime?.provider === 'mock';
  const canPrescribe = user?.role === 'prescriber' || user?.role === 'pharmacist';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('ai.doctor.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('ai.doctor.intro')}
        {draft ? ` ${t('ai.doctor.draft', { id: draft.draftId.slice(-8) })}` : ''}
      </Typography>
      {user?.role === 'admin' && (
        <Paper sx={{ p: 2, mb: 2 }}><ConnectRealAi onSaved={load} /></Paper>
      )}
      {usingMock && user?.role !== 'admin' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('ai.doctor.mockAdmin')}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {busy && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Autocomplete
              options={patients}
              getOptionLabel={(p) => `${p.name} · ${p.patientRef || `P${p.id}`} · ${p.gender || ''} ${p.age != null && p.age !== '' ? t('ai.doctor.years', { n: p.age }) : ''}`}
              value={patient}
              onChange={(_, v) => setPatient(v)}
              renderInput={(params) => <TextField {...params} label={t('ai.doctor.patient')} size="small" sx={{ mb: 2 }} helperText={patient ? t('ai.doctor.boundRef', { ref: patient.patientRef || `P${patient.id}` }) : t('ai.doctor.needPatient')} />}
              sx={{ mb: 2 }}
            />
            <Autocomplete
              options={templates}
              getOptionLabel={(t) => `${t.name} · ${t.category || ''}`}
              value={template}
              onChange={(_, v) => setTemplate(v)}
              renderInput={(params) => <TextField {...params} label={t('ai.doctor.template')} size="small" />}
              sx={{ mb: 2 }}
            />
            <TextField fullWidth label={t('ai.doctor.diagnosis')} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField label={t('ai.doctor.weight')} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} size="small" sx={{ width: 120 }} />
              <TextField
                select
                label={t('ai.doctor.allergySeverity')}
                value={allergySeverity}
                onChange={(e) => setAllergySeverity(e.target.value)}
                size="small"
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="unknown">{t('ai.allergySeverity.unknown')}</MenuItem>
                <MenuItem value="mild">{t('ai.allergySeverity.mild')}</MenuItem>
                <MenuItem value="severe">{t('ai.allergySeverity.severe')}</MenuItem>
              </TextField>
            </Stack>
            <TextField fullWidth label={t('ai.doctor.decoction')} value={decoctionNotes} onChange={(e) => setDecoctionNotes(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth label={t('ai.doctor.notes')} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth
              multiline
              rows={7}
              label={t('ai.doctor.rx')}
              placeholder={t('ai.doctor.rxPh')}
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              sx={{ mb: 2 }}
            />
            {!canPrescribe && (
              <Alert severity="info" sx={{ mb: 2 }}>{t('ai.doctor.needPrescriber')}</Alert>
            )}
            <Button
              fullWidth
              size="large"
              variant="contained"
              startIcon={<AutoAwesome />}
              disabled={busy || !canPrescribe}
              onClick={() => runAi({ submitAfter: true })}
            >
              {t('ai.doctor.submit')}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} startIcon={<Send />} disabled={busy || !canPrescribe} onClick={() => runAi()}>
              {t('ai.doctor.preview')}
            </Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, mb: 2, minHeight: 220 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={600}>{t('ai.doctor.resultTitle')}</Typography>
              {analysis && <TierChip tier={analysis.riskTier} />}
              {sourceLabel && <Chip size="small" color={analysis?.displaySource === 'live_model' ? 'success' : 'warning'} label={sourceLabel} />}
            </Stack>
            {!analysis && <Typography color="text.secondary">{t('ai.doctor.resultEmpty')}</Typography>}
            {analysis && (
              <>
                {analysis.shadowResult?.pharmacistExplanation && (
                  <Alert severity="info" sx={{ mb: 1 }}>{t('ai.review.shadowHint')}</Alert>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                  {analysis.shadowResult?.pharmacistExplanation || analysis.pharmacistExplanation}
                </Typography>
                {hard.map((h) => <Alert key={h.code} severity="error" sx={{ mb: 1 }}>{h.message}</Alert>)}
                {alerts.map((a) => <Alert key={a.code} severity="warning" sx={{ mb: 1 }}>{a.message}</Alert>)}
                {candidates.map((s) => (
                  <Alert
                    key={s.suggestionId}
                    severity="info"
                    sx={{ mb: 1 }}
                    action={<Button size="small" onClick={() => applyChange(s.suggestionId)}>{t('ai.doctor.apply')}</Button>}
                  >
                    {s.message}
                  </Alert>
                ))}
              </>
            )}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{t('ai.doctor.sent')}</Typography>
            <List dense>
              {ownCases.slice(0, 6).map((c) => (
                <ListItem key={c.caseId} button onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>
                  <ListItemText primary={`${c.caseId.slice(-8)} · ${c.state}`} secondary={c.patientLabel} />
                </ListItem>
              ))}
              {!ownCases.length && <ListItem><ListItemText secondary={t('ai.doctor.noneSent')} /></ListItem>}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
