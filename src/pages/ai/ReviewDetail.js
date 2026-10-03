import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Alert, Stack, Chip, Button, TextField, MenuItem, Table, TableBody, TableCell, TableHead, TableRow,
  Divider, Checkbox, FormControlLabel, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { RiskTierChip, StateChip, AiLabel } from '../../components/ai/Badges';
import {
  RECOMMENDATION_LABELS, OVERRIDE_REASONS, ABSTAIN_REASON_LABELS, SEMANTIC_STATUS_LABELS, STATE_LABELS, DISPLAY_SOURCE_LABELS,
} from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';
import { meansNoAllergy } from '../../i18n/lookup';
import { displayFact, triFromFact, scalarFromFact, factStatus } from '../../utils/clinicalFacts';

const CLAR_FIELDS = [
  'patient.facts.ageYears',
  'patient.facts.weightKg',
  'patient.facts.allergies',
  'patient.facts.currentMedications',
  'patient.facts.pregnancy',
  'patient.facts.lactation',
  'patient.facts.liverImpairment',
  'patient.facts.renalImpairment',
  'patient.sex',
];

const ACTION_KEYS = {
  approve: 'ai.action.approve',
  reject: 'ai.action.reject',
  request_information: 'ai.action.request_information',
  return_to_prescriber: 'ai.action.return_to_prescriber',
  override_ai_alert: 'ai.action.override_ai_alert',
  confirm_ai_alert: 'ai.action.confirm_ai_alert',
  request_second_review: 'ai.action.request_second_review',
};

function Section({ title, children, action }) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function EditDialog({ open, onClose, c, onSaved, t }) {
  const p = c.patient || {};
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    const allergy = displayFact(p.facts?.allergies, p.allergyItems, { none: 'none', unknown: '', notAsked: '' });
    const meds = displayFact(p.facts?.currentMedications, p.medicationItems, { none: '', unknown: '', notAsked: '' });
    setF({
      age: scalarFromFact(p.facts?.ageYears) ?? p.ageYears ?? '',
      allergies: allergy.status === 'none' ? 'none' : (allergy.names || []).join(', '),
      pregnancy: triFromFact(p.facts?.pregnancy) || p.pregnancy || 'unknown',
      meds: (meds.names || (Array.isArray(p.currentMedications) ? p.currentMedications : [])).join(', '),
      herbs: (c.prescription.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}g`).join('，'), doseCount: c.prescription.doseCount ?? '', usage: c.prescription.usage || '', decoctionNotes: c.prescription.decoctionNotes || '', reason: '',
    });
    setErr('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const split = (s) => s.split(/[，,、;；]+/).map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    try {
      const herbs = split(f.herbs).map((part) => {
        const m = part.match(/^(.+?)(\d+(?:\.\d+)?)\s*g?$/);
        return m ? { name: m[1], dosage: Number(m[2]), unit: 'g' } : { name: part, dosage: null, unit: 'g' };
      });
      const body = {
        reason: f.reason,
        expectedVersion: c.contentVersion,
        patient: {
          ...(f.age !== '' ? { ageYears: Number(f.age) } : {}),
          ...(f.allergies !== '' ? { allergies: meansNoAllergy(f.allergies) ? [] : split(f.allergies) } : {}),
          pregnancy: f.pregnancy,
          currentMedications: split(f.meds),
        },
      };
      if (c.__canEditRx) {
        body.prescription = {
          herbs, ...(f.doseCount !== '' ? { doseCount: Number(f.doseCount) } : {}), ...(f.usage ? { usage: f.usage } : {}), ...(f.decoctionNotes ? { decoctionNotes: f.decoctionNotes } : {}),
        };
      }
      await aiCasesApi.update(c.caseId, body);
      onSaved();
      onClose();
    } catch (e) {
      setErr(formatApiError(e));
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('ai.review.editTitle')}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>{t('ai.review.editWarn')}</Alert>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2}>
          {c.__canEditRx && <Grid item xs={12}><TextField fullWidth label={t('ai.review.herbs')} value={f.herbs || ''} onChange={set('herbs')} /></Grid>}
          <Grid item xs={4}><TextField fullWidth label={t('ai.review.age')} type="number" value={f.age ?? ''} onChange={set('age')} /></Grid>
          <Grid item xs={4}>
            <TextField select fullWidth label={t('ai.review.pregnancy')} value={f.pregnancy || 'unknown'} onChange={set('pregnancy')}>
              {['yes', 'no', 'unknown'].map((k) => <MenuItem key={k} value={k}>{t(`ai.tri.${k}`)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4}><TextField fullWidth label={t('ai.review.doseCount')} type="number" value={f.doseCount ?? ''} onChange={set('doseCount')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label={t('ai.review.allergyHint')} value={f.allergies || ''} onChange={set('allergies')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label={t('ai.review.medsLabel')} value={f.meds || ''} onChange={set('meds')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label={t('ai.review.usage')} value={f.usage || ''} onChange={set('usage')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label={t('ai.review.decoction')} value={f.decoctionNotes || ''} onChange={set('decoctionNotes')} /></Grid>
          <Grid item xs={12}><TextField fullWidth required label={t('ai.review.reason')} value={f.reason || ''} onChange={set('reason')} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('ai.cancel')}</Button>
        <Button variant="contained" disabled={!f.reason} onClick={save}>{t('ai.review.saveRescreen')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ReviewDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [c, setC] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [infoItems, setInfoItems] = useState('');
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [clarField, setClarField] = useState('patient.facts.ageYears');
  const [clarQ, setClarQ] = useState('');
  const [eduText, setEduText] = useState('');
  const [planDue, setPlanDue] = useState('');
  const [planNote, setPlanNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await aiCasesApi.get(caseId);
      setC(res.data.case);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const analysis = useMemo(() => c?.analyses?.[c.analyses.length - 1] || null, [c]);
  const out = analysis?.output;
  const isPharmacist = user?.role === 'pharmacist' || (Array.isArray(user?.credentials) && user.credentials.includes('pharmacist'));
  const canEditContent = ['pharmacist', 'prescriber'].includes(user?.role);
  const canEditRx = user?.role === 'prescriber';
  const inReview = c?.state === 'pharmacist_review_required';

  const run = async (fn, okText) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okText);
      setComment('');
      setSelected([]);
      setReason('');
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const decide = (action, extra = {}) => run(
    () => aiCasesApi.decide(caseId, { action, analysisId: analysis.analysisId, ...(comment ? { comment } : {}), ...extra }),
    t('ai.review.recorded', { action: t(ACTION_KEYS[action] || action) }),
  );

  if (error && !c) return <Alert severity="error">{error}</Alert>;
  if (!c) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const p = c.patient || {};
  const overridable = (out?.alerts || []).filter((a) => a.code !== 'INJECTION_SUSPECTED');
  const yn = (fact) => {
    const st = factStatus(fact);
    if (st === 'reported' && fact.value === true) return t('ai.review.yesNoUnknown.yes');
    if (st === 'none' || (st === 'reported' && fact.value === false)) return t('ai.review.yesNoUnknown.no');
    if (st === 'not_asked') return t('ai.confirm.notAsked');
    return t('ai.unknown');
  };
  const allergy = displayFact(p.facts?.allergies, p.allergyItems, { none: t('ai.confirm.noAllergy'), unknown: t('ai.unknown'), notAsked: t('ai.confirm.notAsked') });
  const meds = displayFact(p.facts?.currentMedications, p.medicationItems, { none: t('ai.none'), unknown: t('ai.unknown'), notAsked: t('ai.confirm.notAsked') });

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Button size="small" onClick={() => navigate('/ai/review-queue')}>{t('ai.review.back')}</Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</Typography>
        {(p.name || p.patientRef) && (
          <Chip
            color="primary"
            variant="outlined"
            label={[p.name, p.patientRef].filter(Boolean).join(' · ')}
          />
        )}
        <StateChip state={c.state} size="medium" />
        {out && <RiskTierChip tier={out.riskTier} size="medium" />}
        {out && <Chip label={t(RECOMMENDATION_LABELS[out.recommendation] || out.recommendation)} variant="outlined" />}
        {c.reviewLane && <Chip size="small" color={c.reviewLane === 'dual' ? 'warning' : c.reviewLane === 'fast' ? 'success' : 'default'} label={t('ai.review.lane', { lane: t(`ai.cases.lane${c.reviewLane === 'fast' ? 'Fast' : c.reviewLane === 'dual' ? 'Dual' : 'Priority'}`) })} />}
        {out?.displaySource && <Chip size="small" color={out.displaySource === 'degraded_rules' ? 'warning' : 'default'} label={t(DISPLAY_SOURCE_LABELS[out.displaySource] || out.displaySource)} />}
        {c.approval && <Chip color={c.approval.valid ? 'success' : 'default'} label={c.approval.valid ? t('ai.review.approvalValid') : t('ai.review.approvalInvalid')} />}
        {c.synthetic && <Chip size="small" label={t('ai.review.synthetic')} />}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {!out && <Alert severity="info" sx={{ mb: 2 }}>{t('ai.review.notAnalyzed')} <Button size="small" onClick={() => run(() => aiCasesApi.analyze(caseId), t('ai.review.screened'))}>{t('ai.review.startScreen')}</Button></Alert>}
      {out?.abstain && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('ai.review.abstain', { reasons: out.abstainReasons.map((r) => t(ABSTAIN_REASON_LABELS[r] || r)).join(', ') })}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Section title={t('ai.review.rxTitle')} action={!['completed', 'patient_declined'].includes(c.state) && canEditContent && <Button size="small" onClick={() => setEditOpen(true)}>{t('ai.review.edit')}</Button>}>
            {c.source?.rawText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: 'grey.100', p: 1, mb: 1, borderRadius: 1 }}>
                {t('ai.review.raw', { text: c.source.rawText })}
              </Typography>
            )}
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('ai.herb')}</TableCell><TableCell>{t('ai.dose')}</TableCell><TableCell>{t('ai.note')}</TableCell></TableRow></TableHead>
              <TableBody>
                {(c.prescription.herbs || []).map((h, i) => (
                  <TableRow key={`${h.name}-${i}`}><TableCell>{h.name}</TableCell><TableCell>{h.dosage ?? '—'}{h.unit}</TableCell><TableCell>{h.processing || h.note || ''}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {t('ai.review.doseLine', {
                doses: c.prescription.doseCount ?? t('ai.notSpecified'),
                usage: c.prescription.usage || c.prescription.frequency || t('ai.notSpecified'),
                decoction: c.prescription.decoctionNotes || t('ai.notSpecified'),
              })}
            </Typography>
            <Typography variant="body2">
              {t('ai.review.prescriber', {
                name: c.prescriber?.name || t('ai.unregistered'),
                license: c.prescriber?.licenseVerified === true ? t('ai.license.verified') : c.prescriber?.licenseVerified === false ? t('ai.license.failed') : t('ai.license.unknown'),
                date: c.prescription.issuedAt || t('ai.notSpecified'),
              })}
            </Typography>
            {c.prescription.prescriberAttestations?.length > 0 && <Typography variant="body2">{t('ai.review.dualSign', { items: c.prescription.prescriberAttestations.join(', ') })}</Typography>}
          </Section>
          <Section title={t('ai.review.patientRisk')}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {[p.name || t('ai.unregistered'), p.patientRef].filter(Boolean).join(' · ')}
            </Typography>
            <Typography variant="body2">{t('ai.review.diagnosisLine', { dx: c.prescription.diagnosisText || t('ai.noneRecorded'), kg: p.weightKg ?? t('ai.noneRecorded'), sev: t(`ai.allergySeverity.${p.allergySeverity || 'unknown'}`) })}</Typography>
            <Typography variant="body2">{t('ai.review.demoLine', { age: p.ageYears ?? t('ai.noneRecorded'), sex: t(`ai.sex.${p.sex || 'unknown'}`), preg: t(`ai.tri.${p.pregnancy || 'unknown'}`), lac: t(`ai.tri.${p.lactation || 'unknown'}`) })}</Typography>
            <Typography variant="body2">{t('ai.review.allergies', { v: allergy.text })}</Typography>
            {c.prescription.clinicalNotes ? <Typography variant="body2">{t('ai.review.notes', { v: c.prescription.clinicalNotes })}</Typography> : null}
            <Typography variant="body2">{t('ai.review.meds', { v: meds.text })}</Typography>
            <Typography variant="body2">{t('ai.review.liver', { liver: yn(p.facts?.liverImpairment), kidney: yn(p.facts?.renalImpairment) })}</Typography>
          </Section>
          <Section title={t('ai.review.history')}>
            <Typography variant="caption" color="text.secondary">{t('ai.review.analyses')}</Typography>
            <List dense>
              {c.analyses.map((a) => (
                <ListItem key={a.analysisId} disableGutters>
                  <ListItemText primary={`${new Date(a.at).toLocaleString()} · ${a.output.riskTier} · ${t(RECOMMENDATION_LABELS[a.output.recommendation] || a.output.recommendation)}`} secondary={t('ai.review.trigger', { trigger: a.trigger, v: a.contentVersion, model: a.output.modelVersion })} />
                </ListItem>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary">{t('ai.review.decisions')}</Typography>
            <List dense>
              {c.decisions.map((d) => (
                <ListItem key={d.decisionId} disableGutters>
                  <ListItemText primary={`${new Date(d.at).toLocaleString()} · ${t(ACTION_KEYS[d.action] || d.action)}${d.overrideReason ? ` (${t(OVERRIDE_REASONS.find((r) => r.value === d.overrideReason)?.labelKey || d.overrideReason)})` : ''}`} secondary={`${t('ai.review.pharmacistN', { id: d.pharmacistId })}${d.alertCodes.length ? ` · ${d.alertCodes.join(', ')}` : ''}${d.comment ? ` · ${d.comment}` : ''}`} />
                </ListItem>
              ))}
              {!c.decisions.length && <ListItem disableGutters><ListItemText secondary={t('ai.review.noneYet')} /></ListItem>}
            </List>
            <Typography variant="caption" color="text.secondary">{t('ai.review.transitions')}</Typography>
            <List dense>
              {c.transitions.map((tr, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemText primary={`${t(STATE_LABELS[tr.from] || tr.from)} → ${t(STATE_LABELS[tr.to] || tr.to)}`} secondary={`${new Date(tr.at).toLocaleString()} · ${tr.actorType} #${tr.actorId}${tr.reason ? ` · ${tr.reason}` : ''}`} />
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1}>
              {['admin', 'pharmacist'].includes(user?.role) && (
                <>
                  <Button size="small" onClick={async () => { const r = await aiCasesApi.audit(caseId); setEvents(r.data); }}>{t('ai.review.audit')}</Button>
                  <Button size="small" onClick={() => run(async () => { const r = await aiCasesApi.replay(caseId); if (!r.data.comparison.identical) throw new Error(t('ai.review.replayFail')); }, t('ai.review.replayOk'))}>{t('ai.review.replay')}</Button>
                </>
              )}
            </Stack>
            {events && (
              <Box sx={{ mt: 1 }}>
                <Chip size="small" color={events.chain.valid ? 'success' : 'error'} label={events.chain.valid ? t('ai.review.auditOk', { n: events.chain.length }) : t('ai.review.auditFail', { reason: events.chain.reason })} />
                <List dense>
                  {events.events.map((e) => (
                    <ListItem key={e.eventId} disableGutters>
                      <ListItemText primary={`${e.eventType} · ${e.actorType} #${e.actorId}`} secondary={`${new Date(e.timestamp).toLocaleString()} · ${e.eventHash.slice(0, 12)}…`} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Section>
        </Grid>

        <Grid item xs={12} md={7}>
          {out && (
            <>
              <Section title={t('ai.review.rulesTitle')} action={<AiLabel isMock={out.semanticTrackResult.isMock} />}>
                {out.hardStops.map((h) => (
                  <Alert severity="error" key={`${h.code}-${h.ruleId}`} sx={{ mb: 1 }}>
                    <strong>{t('ai.review.hard', { code: h.code })}</strong>：{h.message}
                    <Typography variant="caption" display="block">
                      {t('ai.review.evidence', { ids: h.evidenceIds.join(', ') || t('ai.review.noEvidence') })} · {h.resolution === 'prescriber_attestation' ? t('ai.review.resolveAttest', { key: h.attestationKey }) : t('ai.review.resolveEdit')}
                    </Typography>
                  </Alert>
                ))}
                <Table size="small">
                  <TableHead><TableRow><TableCell>{t('ai.review.level')}</TableCell><TableCell>{t('ai.review.alert')}</TableCell><TableCell>{t('ai.review.from')}</TableCell><TableCell>{t('ai.review.evidenceCol')}</TableCell></TableRow></TableHead>
                  <TableBody>
                    {out.alerts.map((a, i) => (
                      <TableRow key={`${a.code}-${i}`}>
                        <TableCell><RiskTierChip tier={a.tier} /></TableCell>
                        <TableCell>{a.message}</TableCell>
                        <TableCell>{a.source === 'ai' ? t('ai.review.fromAi') : t('ai.review.fromRule')}</TableCell>
                        <TableCell>{a.evidenceIds.join(', ') || t('ai.dash')}</TableCell>
                      </TableRow>
                    ))}
                    {!out.alerts.length && <TableRow><TableCell colSpan={4}>{t('ai.review.noAlerts')}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Section>

              {(out.missingInformation.length > 0 || out.counterfactuals.length > 0) && (
                <Section title={t('ai.review.missingTitle')}>
                  <List dense>
                    {out.missingInformation.map((m) => (
                      <ListItem key={m.field} disableGutters><ListItemText primary={`${m.critical ? t('ai.review.critical') : ''}${m.message}`} secondary={`${m.field} · ${m.source === 'ai' ? t('ai.review.markedAi') : t('ai.review.fromRule')}`} /></ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">{t('ai.review.counterfactual')}</Typography>
                  <List dense>
                    {out.counterfactuals.map((cf, i) => <ListItem key={i} disableGutters><ListItemText primary={cf.text} secondary={cf.code} /></ListItem>)}
                  </List>
                  {out.substitutionCandidates.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">{t('ai.review.candidates')}</Typography>
                      <List dense>
                        {out.substitutionCandidates.map((s) => <ListItem key={s.ruleId} disableGutters><ListItemText primary={`${s.from} → ${s.to}`} secondary={`${s.ruleId} · ${s.condition} · ${s.approvedBy} · ${t('ai.review.basedOn', { ids: s.evidenceIds.join(', ') })}`} /></ListItem>)}
                      </List>
                    </>
                  )}
                </Section>
              )}

              <Section title={t('ai.review.explain')} action={<Chip size="small" label={t(SEMANTIC_STATUS_LABELS[out.semanticTrackResult.status] || out.semanticTrackResult.status)} />}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{out.pharmacistExplanation}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {t('ai.review.evidenceStrength', { v: out.evidenceStrength, model: out.modelVersion, prompt: out.promptVersion, rules: out.ruleSetVersion, kb: out.knowledgeBaseVersion })}
                </Typography>
                {out.disagreements.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t('ai.review.disagree', { v: out.disagreements.map((d) => d.detail).join('; ') })}
                  </Alert>
                )}
                {out.semanticTrackResult.violations.length > 0 && (
                  <Alert severity="error" sx={{ mt: 1 }}>{t('ai.review.discarded', { v: out.semanticTrackResult.violations.map((v) => v.message).join('; ') })}</Alert>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">{t('ai.review.patientExplain')}</Typography>
                <Typography variant="body2">{out.patientExplanation}</Typography>
              </Section>

              <Section title={t('ai.review.cites')}>
                <List dense>
                  {out.retrievalTrackResult.retrieved.map((e) => (
                    <ListItem key={e.sourceId} disableGutters><ListItemText primary={`${e.sourceId} · ${e.title}`} secondary={`${e.authority} · v${e.version} · sha256 ${e.hash.slice(0, 12)}…`} /></ListItem>
                  ))}
                </List>
                {out.retrievalTrackResult.missingEvidenceFor.length > 0 && <Alert severity="info">{t('ai.review.missingEvid', { v: out.retrievalTrackResult.missingEvidenceFor.join(', ') })}</Alert>}
              </Section>

              <Section title={t('ai.review.ops')}>
                {!isPharmacist && <Alert severity="info">{t('ai.review.readOnly')}</Alert>}
                {isPharmacist && !inReview && <Alert severity="info">{t('ai.review.notInReview', { state: t(STATE_LABELS[c.state] || c.state) })}</Alert>}
                {isPharmacist && inReview && (
                  <Stack spacing={2}>
                    {c.secondReview?.status === 'pending' && c.secondReview.firstSigner && String(c.secondReview.firstSigner) === String(user?.id) && (
                      <Alert severity="info">{t('ai.review.waitSecond')}</Alert>
                    )}
                    {c.secondReview?.status === 'pending' && c.secondReview.firstSigner && String(c.secondReview.firstSigner) !== String(user?.id) && (
                      <Alert severity="info">{t('ai.review.firstSigned', { id: c.secondReview.firstSigner })}</Alert>
                    )}
                    {c.secondReview?.status === 'pending' && !c.secondReview.firstSigner && (
                      <Alert severity="info">{t('ai.review.secondPending', { id: c.secondReview.requestedBy })}</Alert>
                    )}
                    <TextField label={out.abstain ? t('ai.review.commentAbstain') : t('ai.review.comment')} multiline minRows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {c.reviewLane === 'fast' && (
                        <Button variant="contained" color="success" disabled={busy || out.riskTier === 'A3'} onClick={() => decide('fast_approve')}>{t('ai.action.fast_approve')}</Button>
                      )}
                      <Button
                        variant="contained"
                        color="success"
                        disabled={busy || out.riskTier === 'A3' || (c.secondReview?.firstSigner && String(c.secondReview.firstSigner) === String(user?.id))}
                        onClick={() => decide('approve')}
                      >
                        {c.reviewLane === 'dual' && !c.secondReview?.firstSigner ? t('ai.action.first_sign') : t('ai.action.approve')}
                      </Button>
                      <Button variant="outlined" color="error" disabled={busy || !comment} onClick={() => decide('reject')}>{t('ai.action.reject')}</Button>
                      <Button variant="outlined" disabled={busy || !comment} onClick={() => decide('return_to_prescriber')}>{t('ai.action.return_to_prescriber')}</Button>
                      <Button variant="outlined" disabled={busy} onClick={() => decide('request_second_review')}>{t('ai.action.request_second_review')}</Button>
                    </Stack>
                    {out.riskTier === 'A3' && <Alert severity="error">{t('ai.review.a3only')}</Alert>}
                    <Stack direction="row" spacing={1}>
                      <TextField size="small" fullWidth label={t('ai.review.needInfo')} value={infoItems} onChange={(e) => setInfoItems(e.target.value)} />
                      <Button variant="outlined" disabled={busy || !infoItems} onClick={() => decide('request_information', { requestedInformation: infoItems.split(/[，,]/).map((x) => x.trim()).filter(Boolean) })}>{t('ai.review.askInfo')}</Button>
                    </Stack>
                    {overridable.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">{t('ai.review.overrideBox')}</Typography>
                        <Stack>
                          {overridable.map((a, i) => (
                            <FormControlLabel
                              key={`${a.code}-${i}`}
                              control={<Checkbox size="small" checked={selected.includes(a.code)} onChange={(e) => setSelected((s) => (e.target.checked ? [...new Set([...s, a.code])] : s.filter((x) => x !== a.code)))} />}
                              label={<Typography variant="body2">{a.code}: {a.message}</Typography>}
                            />
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <TextField select size="small" label={t('ai.review.overrideReason')} value={reason} onChange={(e) => setReason(e.target.value)} sx={{ minWidth: 240 }}>
                            {OVERRIDE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.labelKey)}</MenuItem>)}
                          </TextField>
                          <Button variant="outlined" disabled={busy || !selected.length || !reason || (reason === 'other' && !comment)} onClick={() => decide('override_ai_alert', { alertCodes: selected, overrideReason: reason })}>{t('ai.review.overrideBtn')}</Button>
                          <Button variant="outlined" disabled={busy || !selected.length} onClick={() => decide('confirm_ai_alert', { alertCodes: selected })}>{t('ai.review.confirmBtn')}</Button>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
                {c.state === 'pharmacist_approved' && ['pharmacist', 'technician'].includes(user?.role) && (
                  <Box sx={{ mt: 2 }}>
                    <Button variant="contained" disabled={busy} onClick={() => run(async () => { const r = await aiCasesApi.issuePatientConfirmation(caseId); setLink(r.data); }, t('ai.review.issued'))}>{t('ai.review.issueLink')}</Button>
                  </Box>
                )}
                {link && (
                  <Alert severity="info" sx={{ mt: 2, wordBreak: 'break-all' }}>
                    {t('ai.review.linkOnce', { when: new Date(link.expiresAt).toLocaleString() })}<br />
                    {`${window.location.origin}${link.path}`}
                  </Alert>
                )}
              </Section>
            </>
          )}
        </Grid>
      </Grid>
      {isPharmacist && (
        <Section title={t('ai.review.serviceTitle')}>
          <Alert severity="info" sx={{ mb: 2 }}>{t('ai.review.selfReport')}</Alert>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField select size="small" label={t('ai.review.clarField')} value={clarField} onChange={(e) => setClarField(e.target.value)} sx={{ minWidth: 260 }}>
                {CLAR_FIELDS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
              <TextField size="small" fullWidth label={t('ai.review.clarQuestion')} value={clarQ} onChange={(e) => setClarQ(e.target.value)} />
              <Button variant="outlined" disabled={busy || !clarQ} onClick={() => run(async () => {
                const r = await aiCasesApi.issueClarification(caseId, { fieldPath: clarField, question: clarQ, source: 'pharmacist' });
                setLink({ path: r.data.path, expiresAt: r.data.expiresAt, token: r.data.token });
                setClarQ('');
              }, t('ai.review.clarSent'))}>{t('ai.review.clarSend')}</Button>
            </Stack>
            {(c.clarificationTasks || []).map((task) => (
              <Stack key={task.taskId} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{task.fieldPath} · {task.status} · {task.question}</Typography>
                {task.status === 'answered' && (
                  <Button size="small" onClick={() => run(() => aiCasesApi.reviewClarification(caseId, task.taskId), t('ai.review.clarReviewed'))}>{t('ai.review.clarReview')}</Button>
                )}
              </Stack>
            ))}
            <TextField multiline minRows={3} label={t('ai.review.eduDraft')} value={eduText} onChange={(e) => setEduText(e.target.value)} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" disabled={busy || !eduText} onClick={() => run(() => aiCasesApi.createEducation(caseId, { text: eduText, source: 'pharmacist' }), t('ai.review.eduCreated'))}>{t('ai.review.eduCreate')}</Button>
            </Stack>
            {(c.educationDocuments || []).map((d) => (
              <Stack key={d.documentId} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{d.status} · {d.text?.slice(0, 80)}</Typography>
                {d.status === 'review_required' && <Button size="small" onClick={() => run(() => aiCasesApi.decideEducation(caseId, d.documentId, { action: 'approve' }), t('ai.review.eduApprove'))}>{t('ai.review.eduApprove')}</Button>}
                {d.status === 'approved' && <Button size="small" onClick={() => run(() => aiCasesApi.decideEducation(caseId, d.documentId, { action: 'publish' }), t('ai.review.eduPublish'))}>{t('ai.review.eduPublish')}</Button>}
              </Stack>
            ))}
            <Alert severity="info">{t('ai.review.noPlan')}</Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField size="small" type="datetime-local" label={t('ai.review.followDue')} value={planDue} onChange={(e) => setPlanDue(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField size="small" fullWidth label={t('ai.review.followNote')} value={planNote} onChange={(e) => setPlanNote(e.target.value)} />
              <Button variant="outlined" disabled={busy} onClick={() => run(() => aiCasesApi.setFollowUpPlan(caseId, { dueAt: planDue ? new Date(planDue).toISOString() : undefined, note: planNote || undefined }), t('ai.review.followSaved'))}>{t('ai.review.followSave')}</Button>
            </Stack>
            {['completed', 'ready_for_pickup', 'pharmacist_approved', 'dispensing'].includes(c.state) && (
              <Button variant="outlined" disabled={busy} onClick={() => run(async () => {
                const r = await aiCasesApi.issueFeedbackToken(caseId);
                setLink({ path: r.data.path || r.data.nextFeedbackPath || `/patient/feedback/${r.data.token}`, expiresAt: r.data.expiresAt });
              }, t('ai.review.feedbackIssued'))}>{t('ai.review.feedbackLink')}</Button>
            )}
          </Stack>
        </Section>
      )}
      <EditDialog t={t} open={editOpen} onClose={() => setEditOpen(false)} c={{ ...c, __canEditRx: canEditRx }} onSaved={() => { setNotice(t('ai.review.updated')); load(); }} />
    </Box>
  );
}
