import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Alert, List, ListItem, ListItemText, Chip, Stack,
  Button, TextField, MenuItem, FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { STATE_LABELS } from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';
import { displayFact, scalarFromFact } from '../../utils/clinicalFacts';

const TRI = ['no', 'yes', 'unknown'];
const split = (s) => String(s || '').split(/[，,、;；]+/).map((x) => x.trim()).filter(Boolean);

function parseClarValue(fieldType, raw) {
  if (fieldType === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (fieldType === 'boolean') return raw === 'true' || raw === 'yes';
  if (fieldType === 'list') return split(raw);
  return raw;
}

const emptyForm = {
  identityConfirmed: false, allergiesConfirmed: false, allergyCorrections: '', pregnancy: 'unknown',
  lactation: 'unknown', ageConfirmed: false, currentMedications: '', fulfillment: 'pickup',
  educationReceived: false, educationUnderstood: false, declineReason: '',
  intakeStatus: 'unknown', difficulty: '', adverse: false, desc: '',
};

function matchesView(c, view) {
  if (view === 'clarifications') return Boolean(c.actions?.canClarify || (c.clarifications || []).length);
  if (view === 'education') return c.educationStatus === 'published' || Boolean((c.education || []).length);
  if (view === 'feedback') return Boolean(c.actions?.canFeedback || (c.followUps || []).length);
  return true;
}

const VIEW_TITLE = {
  all: 'ai.mine.title',
  clarifications: 'nav.myClarifications',
  education: 'nav.myEducation',
  feedback: 'nav.myFeedback',
};

const VIEW_EMPTY = {
  all: 'ai.mine.empty',
  clarifications: 'ai.mine.emptyClar',
  education: 'ai.mine.emptyEdu',
  feedback: 'ai.mine.emptyFb',
};

export default function MyPrescriptions({ view = 'all' }) {
  const { t } = useLanguage();
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [forms, setForms] = useState({});
  const [clar, setClar] = useState({});

  const load = () => patientPortalApi.myCases()
    .then((r) => setCases(r.data.cases))
    .catch((e) => setError(formatApiError(e)));

  useEffect(() => { load(); }, []);

  const formOf = (id) => forms[id] || emptyForm;
  const setF = (id, k) => (e) => setForms((prev) => ({
    ...prev,
    [id]: { ...emptyForm, ...prev[id], [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value },
  }));

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t(VIEW_TITLE[view] || VIEW_TITLE.all)}</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>{t('ai.mine.inboxHint')}</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {cases && !cases.filter((c) => matchesView(c, view)).length && <Alert severity="info">{t(VIEW_EMPTY[view] || VIEW_EMPTY.all)}</Alert>}
      {cases?.filter((c) => matchesView(c, view)).map((c) => {
        const f = formOf(c.caseId);
        const rec = c.recordedInformation;
        const allergy = displayFact(rec?.allergies, rec?.allergyItems, { none: t('ai.confirm.noAllergy'), unknown: t('ai.unknown'), notAsked: t('ai.confirm.notAsked') });
        const meds = displayFact(rec?.currentMedications, rec?.medicationItems, { none: t('ai.none'), unknown: t('ai.unknown'), notAsked: t('ai.unknown') });
        const age = scalarFromFact(rec?.ageYears) ?? rec?.ageYearsDisplay;
        return (
          <Paper key={c.caseId} sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontFamily: 'monospace' }}>{c.caseRef}</Typography>
              <Chip size="small" label={t(STATE_LABELS[c.state] || c.state)} />
              {c.educationStatus === 'published' && <Chip size="small" variant="outlined" label={t('nav.myEducation')} />}
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>{(c.prescription?.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}${h.unit || ''}`).join(', ')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{c.explanation?.text || t('ai.mine.educationPending')}</Typography>

            {c.actions?.canConfirm && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('ai.mine.confirmNow')}</Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <FormControlLabel control={<Checkbox checked={f.identityConfirmed} onChange={setF(c.caseId, 'identityConfirmed')} />} label={t('ai.confirm.identity')} />
                  <FormControlLabel control={<Checkbox checked={f.ageConfirmed} onChange={setF(c.caseId, 'ageConfirmed')} />} label={t('ai.confirm.ageOk', { age: age ?? t('ai.unregistered') })} />
                  <FormControlLabel control={<Checkbox checked={f.allergiesConfirmed} onChange={setF(c.caseId, 'allergiesConfirmed')} />} label={t('ai.confirm.allergiesOk', { v: allergy.text })} />
                  <TextField size="small" label={t('ai.confirm.allergyAdd')} value={f.allergyCorrections} onChange={setF(c.caseId, 'allergyCorrections')} />
                  <Stack direction="row" spacing={1}>
                    <TextField select size="small" fullWidth label={t('ai.confirm.pregnancy')} value={f.pregnancy} onChange={setF(c.caseId, 'pregnancy')}>{TRI.map((v) => <MenuItem key={v} value={v}>{t(`ai.tri.${v}`)}</MenuItem>)}</TextField>
                    <TextField select size="small" fullWidth label={t('ai.confirm.lactation')} value={f.lactation} onChange={setF(c.caseId, 'lactation')}>{TRI.map((v) => <MenuItem key={v} value={v}>{t(`ai.tri.${v}`)}</MenuItem>)}</TextField>
                  </Stack>
                  <TextField size="small" label={t('ai.confirm.otherMeds', { v: meds.text })} value={f.currentMedications} onChange={setF(c.caseId, 'currentMedications')} />
                  <TextField select size="small" label={t('ai.confirm.fulfill')} value={f.fulfillment} onChange={setF(c.caseId, 'fulfillment')}>
                    {['pickup', 'delivery', 'decoction_pickup', 'decoction_delivery'].map((v) => <MenuItem key={v} value={v}>{t(`ai.fulfillment.${v}`)}</MenuItem>)}
                  </TextField>
                  <FormControlLabel control={<Checkbox checked={f.educationReceived} onChange={setF(c.caseId, 'educationReceived')} />} label={t('ai.confirm.readEdu')} />
                  <FormControlLabel control={<Checkbox checked={f.educationUnderstood} onChange={setF(c.caseId, 'educationUnderstood')} />} label={t('ai.confirm.understoodEdu')} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button variant="contained" disabled={!f.identityConfirmed} onClick={async () => {
                      try {
                        const r = await patientPortalApi.confirmOwn(c.caseId, {
                          decision: 'confirm',
                          identityConfirmed: f.identityConfirmed,
                          allergiesConfirmed: f.allergiesConfirmed,
                          allergyCorrections: split(f.allergyCorrections),
                          ...(f.pregnancy === 'yes' || f.pregnancy === 'no' ? { pregnancy: f.pregnancy } : {}),
                          ...(f.lactation === 'yes' || f.lactation === 'no' ? { lactation: f.lactation } : {}),
                          ageConfirmed: f.ageConfirmed,
                          currentMedications: split(f.currentMedications),
                          fulfillment: f.fulfillment,
                          contactConfirmed: true,
                          educationReceived: f.educationReceived,
                          educationUnderstood: f.educationUnderstood,
                        });
                        setNotice(r.data.outcome === 'confirmed' ? t('ai.confirm.ok') : (r.data.message || r.data.outcome));
                        setError('');
                        await load();
                      } catch (e) { setError(formatApiError(e)); }
                    }}>{t('ai.confirm.confirmBtn')}</Button>
                    <TextField size="small" label={t('ai.confirm.declineReason')} value={f.declineReason} onChange={setF(c.caseId, 'declineReason')} />
                    <Button color="error" onClick={async () => {
                      try {
                        await patientPortalApi.confirmOwn(c.caseId, { decision: 'decline', identityConfirmed: f.identityConfirmed, declineReason: f.declineReason });
                        setNotice(t('ai.confirm.declined'));
                        await load();
                      } catch (e) { setError(formatApiError(e)); }
                    }}>{t('ai.confirm.decline')}</Button>
                  </Stack>
                </Stack>
              </>
            )}

            {(c.factCandidates || []).map((cand) => (
              <Alert key={cand.candidateId} severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">系统从您的描述中读到：{cand.fieldPath} = {String(cand.candidateValue)}（原文「{cand.sourceText}」）。这还不是已核实资料。</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button size="small" variant="contained" onClick={async () => {
                    try {
                      await patientPortalApi.confirmOwnFactCandidate(c.caseId, { candidateId: cand.candidateId, action: 'accept' });
                      setNotice('已确认该资料');
                      await load();
                    } catch (e) { setError(formatApiError(e)); }
                  }}>确认</Button>
                  <Button size="small" onClick={async () => {
                    try {
                      await patientPortalApi.confirmOwnFactCandidate(c.caseId, { candidateId: cand.candidateId, action: 'deny' });
                      setNotice('已否认该资料');
                      await load();
                    } catch (e) { setError(formatApiError(e)); }
                  }}>不是这样</Button>
                </Stack>
              </Alert>
            ))}
            {(c.clarifications || []).map((q) => (
              <Alert key={q.taskId} severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>{q.question}</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField select size="small" label={t('ai.clar.status')} value={clar[q.taskId]?.status || 'unknown'} onChange={(e) => setClar((p) => ({ ...p, [q.taskId]: { ...p[q.taskId], status: e.target.value } }))} sx={{ minWidth: 160 }}>
                    {(q.allowedStatuses || ['unknown', 'none', 'reported']).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label={t('ai.clar.value')} value={clar[q.taskId]?.value || ''} onChange={(e) => setClar((p) => ({ ...p, [q.taskId]: { ...p[q.taskId], value: e.target.value } }))} />
                  <Button variant="outlined" onClick={async () => {
                    try {
                      const st = clar[q.taskId]?.status || 'unknown';
                      await patientPortalApi.answerOwnClarification(c.caseId, q.taskId, {
                        status: st,
                        kind: 'correct',
                        value: st === 'reported' ? parseClarValue(q.fieldType, clar[q.taskId]?.value) : null,
                      });
                      setNotice(t('ai.mine.answered'));
                      await load();
                    } catch (e) { setError(formatApiError(e)); }
                  }}>{t('ai.clar.submit')}</Button>
                </Stack>
              </Alert>
            ))}

            {c.actions?.canFeedback && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('ai.feedback.title')}</Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <TextField select size="small" label={t('ai.feedback.intake')} value={f.intakeStatus} onChange={setF(c.caseId, 'intakeStatus')}>
                    <MenuItem value="taken">{t('ai.feedback.intakeTaken')}</MenuItem>
                    <MenuItem value="not_taken">{t('ai.feedback.intakeNot')}</MenuItem>
                    <MenuItem value="partially_taken">{t('ai.feedback.intakePartial')}</MenuItem>
                    <MenuItem value="unknown">{t('ai.feedback.intakeUnknown')}</MenuItem>
                  </TextField>
                  <TextField size="small" label={t('ai.feedback.difficulty')} value={f.difficulty} onChange={setF(c.caseId, 'difficulty')} />
                  <FormControlLabel control={<Checkbox checked={f.adverse} onChange={setF(c.caseId, 'adverse')} />} label={t('ai.feedback.adr')} />
                  {f.adverse && <TextField multiline minRows={2} label={t('ai.feedback.desc')} value={f.desc} onChange={setF(c.caseId, 'desc')} />}
                  <Button variant="outlined" onClick={async () => {
                    try {
                      await patientPortalApi.submitOwnFeedback(c.caseId, {
                        effectiveness: 3,
                        intakeStatus: f.intakeStatus,
                        ...(f.difficulty ? { difficulty: f.difficulty } : {}),
                        adverseReaction: !!f.adverse,
                        newSymptom: !!f.adverse,
                        ...(f.desc ? { adverseDescription: f.desc } : {}),
                      });
                      setNotice(t('ai.feedback.thanks'));
                      await load();
                    } catch (e) { setError(formatApiError(e)); }
                  }}>{t('ai.feedback.submit')}</Button>
                </Stack>
              </>
            )}

            <List dense>
              {(c.events || []).map((e, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemText
                    primary={`${(() => { const k = `ai.event.${e.eventType}`; const lab = t(k); return lab === k ? e.eventType : lab; })()}${e.summary && e.eventType === 'state_transition' ? `: ${t(STATE_LABELS[e.summary] || e.summary)}` : ''}`}
                    secondary={new Date(e.timestamp).toLocaleString()}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        );
      })}
    </Box>
  );
}
