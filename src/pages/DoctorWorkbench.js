import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Autocomplete, Chip, Alert,
  LinearProgress, List, ListItem, ListItemText, Stack,
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

export default function DoctorWorkbench() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [ownCases, setOwnCases] = useState([]);
  const [patient, setPatient] = useState(null);
  const [template, setTemplate] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
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
    if (!prescriptionText.trim()) { setError('请填写处方'); return; }
    setBusy(true);
    setError('');
    try {
      const body = {
        diagnosisText: diagnosis,
        prescriptionText,
        ...(patient ? {
          patient: {
            name: patient.name,
            ageYears: patient.age,
            sex: patient.gender === '男' ? 'male' : patient.gender === '女' ? 'female' : 'unknown',
            allergies: patient.allergies || [],
          },
        } : {}),
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
        setNotice(`AI 已完成筛查并提交药师（病例 ${submitted.data.case.caseId.slice(-8)}）。药师签署前不会发药。`);
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
      setNotice('已按 AI 候选修改处方，正在重新分析。');
      await runAi();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  if (loading) return <LinearProgress />;
  const sourceLabel = DISPLAY_SOURCE_LABELS[analysis?.displaySource] || analysis?.displaySource;
  const hard = (analysis?.hardStops || []);
  const alerts = (analysis?.alerts || []).slice(0, 6);
  const candidates = suggestions.filter((s) => s.proposedChange && s.status === 'pending');
  const usingMock = runtime?.isMock || runtime?.provider === 'mock';
  const canPrescribe = user?.role === 'prescriber' || user?.role === 'pharmacist';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>AI 开方</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        写好处方，点一次即可：AI 负责审方提示并送给药师。AI 不能自己签字或发药。
        {draft ? ` 当前草稿 ${draft.draftId.slice(-8)}。` : ''}
      </Typography>
      {user?.role === 'admin' && (
        <Paper sx={{ p: 2, mb: 2 }}><ConnectRealAi onSaved={load} /></Paper>
      )}
      {usingMock && user?.role !== 'admin' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          当前是模拟 AI。请让管理员在「AI治理中心」接入 OpenAI、DeepSeek 或本地 Ollama；接入后本页会自动改用真实模型。
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
              getOptionLabel={(p) => `${p.name} · ${p.gender || ''} ${p.age || ''}岁`}
              value={patient}
              onChange={(_, v) => setPatient(v)}
              renderInput={(params) => <TextField {...params} label="患者（可空）" size="small" sx={{ mb: 2 }} />}
              sx={{ mb: 2 }}
            />
            <Autocomplete
              options={templates}
              getOptionLabel={(t) => `${t.name} · ${t.category || ''}`}
              value={template}
              onChange={(_, v) => setTemplate(v)}
              renderInput={(params) => <TextField {...params} label="选用方剂（可选）" size="small" />}
              sx={{ mb: 2 }}
            />
            <TextField fullWidth label="诊断" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth
              multiline
              rows={7}
              label="处方"
              placeholder="黄芪15g，当归10g，白芍10g，川芎6g，甘草6g"
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              sx={{ mb: 2 }}
            />
            {!canPrescribe && (
              <Alert severity="info" sx={{ mb: 2 }}>开方请用医师账号（prescriber / doc123）。管理员只负责接入模型。</Alert>
            )}
            <Button
              fullWidth
              size="large"
              variant="contained"
              startIcon={<AutoAwesome />}
              disabled={busy || !canPrescribe}
              onClick={() => runAi({ submitAfter: true })}
            >
              让 AI 审方并提交药师
            </Button>
            <Button fullWidth sx={{ mt: 1 }} startIcon={<Send />} disabled={busy || !canPrescribe} onClick={() => runAi()}>
              只看 AI 提示，先不提交
            </Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, mb: 2, minHeight: 220 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={600}>AI 正在驱动的审方结果</Typography>
              {analysis && <TierChip tier={analysis.riskTier} />}
              {sourceLabel && <Chip size="small" color={analysis?.displaySource === 'live_model' ? 'success' : 'warning'} label={sourceLabel} />}
            </Stack>
            {!analysis && <Typography color="text.secondary">填写处方后点上方按钮，AI 会在这里给出风险、缺失信息和是否需要药师重点审。</Typography>}
            {analysis && (
              <>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{analysis.pharmacistExplanation}</Typography>
                {hard.map((h) => <Alert key={h.code} severity="error" sx={{ mb: 1 }}>{h.message}</Alert>)}
                {alerts.map((a) => <Alert key={a.code} severity="warning" sx={{ mb: 1 }}>{a.message}</Alert>)}
                {candidates.map((s) => (
                  <Alert
                    key={s.suggestionId}
                    severity="info"
                    sx={{ mb: 1 }}
                    action={<Button size="small" onClick={() => applyChange(s.suggestionId)}>按此改方</Button>}
                  >
                    {s.message}
                  </Alert>
                ))}
              </>
            )}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>已送审病例</Typography>
            <List dense>
              {ownCases.slice(0, 6).map((c) => (
                <ListItem key={c.caseId} button onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>
                  <ListItemText primary={`${c.caseId.slice(-8)} · ${c.state}`} secondary={c.patientLabel} />
                </ListItem>
              ))}
              {!ownCases.length && <ListItem><ListItemText secondary="提交后显示在这里" /></ListItem>}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
