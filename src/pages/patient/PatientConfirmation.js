import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Alert, Stack, Button, TextField, MenuItem, FormControlLabel, Checkbox, Divider, Table, TableBody, TableCell, TableRow, CircularProgress, Box,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { SYNTHETIC_LABEL } from '../../config/aiLabels';

const TRI = [{ v: 'no', l: '否' }, { v: 'yes', l: '是' }, { v: 'unknown', l: '不确定' }];
const split = (s) => s.split(/[，,、;；]+/).map((x) => x.trim()).filter(Boolean);

export default function PatientConfirmation() {
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    identityConfirmed: false, allergiesConfirmed: false, allergyCorrections: '', pregnancy: 'unknown', lactation: 'unknown', ageConfirmed: false,
    currentMedications: '', fulfillment: 'pickup', contactConfirmed: false, substitutionConsent: 'decline', educationAcknowledged: false, declineReason: '',
  });

  useEffect(() => {
    patientPortalApi.getConfirmation(token)
      .then((r) => {
        setView(r.data);
        setF((x) => ({ ...x, pregnancy: r.data.recordedInformation.pregnancy || 'unknown', lactation: r.data.recordedInformation.lactation || 'unknown' }));
      })
      .catch((e) => setError(formatApiError(e)));
  }, [token]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (decision) => {
    setBusy(true);
    setError('');
    try {
      const body = decision === 'decline'
        ? { decision, identityConfirmed: f.identityConfirmed, ...(f.declineReason ? { declineReason: f.declineReason } : {}) }
        : {
          decision,
          identityConfirmed: f.identityConfirmed,
          allergiesConfirmed: f.allergiesConfirmed,
          allergyCorrections: split(f.allergyCorrections),
          pregnancy: f.pregnancy,
          lactation: f.lactation,
          ageConfirmed: f.ageConfirmed,
          currentMedications: split(f.currentMedications),
          fulfillment: f.fulfillment,
          contactConfirmed: f.contactConfirmed,
          substitutionConsent: f.substitutionConsent,
          educationAcknowledged: f.educationAcknowledged,
        };
      setResult((await patientPortalApi.submitConfirmation(token, body)).data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const r = view?.recordedInformation;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>处方信息确认</Typography>
        <Alert severity="info" sx={{ my: 2 }}>{SYNTHETIC_LABEL}。您的确认用于核对个人信息和服务选择，不代替药师的专业审核。</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!view && !error && <Box sx={{ textAlign: 'center' }}><CircularProgress /></Box>}
        {result && (
          <Alert severity={result.outcome === 'confirmed' ? 'success' : 'info'}>
            {result.outcome === 'confirmed' && '确认成功，药房将按您的选择安排调剂。'}
            {result.outcome === 'declined' && '您已拒绝本次服务，药房不会为您调剂此处方。'}
            {result.outcome === 'returned_for_review' && result.message}
            {result.outcome === 'identity_not_confirmed' && result.message}
            {result.feedbackPath && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                服药后可通过此链接反馈疗效或不良反应（仅可使用一次）：{`${window.location.origin}${result.feedbackPath}`}
              </Typography>
            )}
          </Alert>
        )}
        {view && !result && (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>处方内容（只读）</Typography>
            <Table size="small">
              <TableBody>
                {view.prescription.herbs.map((h) => <TableRow key={h.name}><TableCell>{h.name}</TableCell><TableCell>{h.dosage}{h.unit}</TableCell></TableRow>)}
              </TableBody>
            </Table>
            <Typography variant="body2" sx={{ mt: 1 }}>剂数：{view.prescription.doseCount ?? '—'} · 用法：{view.prescription.usage || '—'}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>用药说明</Typography>
            <Typography variant="body2">{view.explanation.text}</Typography>
            {view.explanation.label && <Typography variant="caption" color="text.secondary">{view.explanation.label}</Typography>}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>请核对您的信息</Typography>
            <Stack spacing={1}>
              <FormControlLabel control={<Checkbox checked={f.identityConfirmed} onChange={set('identityConfirmed')} />} label="我确认是本人（或本人授权的代理人）" />
              <FormControlLabel control={<Checkbox checked={f.ageConfirmed} onChange={set('ageConfirmed')} />} label={`年龄登记为 ${r.ageYears ?? '未登记'} 岁，信息正确`} />
              <FormControlLabel control={<Checkbox checked={f.allergiesConfirmed} onChange={set('allergiesConfirmed')} />} label={`过敏史登记为：${r.allergies ? (r.allergies.length ? r.allergies.join('、') : '无') : '未登记'}`} />
              <TextField size="small" label="如有未登记的过敏，请填写" value={f.allergyCorrections} onChange={set('allergyCorrections')} />
              <Stack direction="row" spacing={1}>
                <TextField select size="small" fullWidth label="是否妊娠" value={f.pregnancy} onChange={set('pregnancy')}>{TRI.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}</TextField>
                <TextField select size="small" fullWidth label="是否哺乳" value={f.lactation} onChange={set('lactation')}>{TRI.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}</TextField>
              </Stack>
              <TextField size="small" label={`正在使用的其他药物（已登记：${r.currentMedications?.join('、') || '无'}）`} value={f.currentMedications} onChange={set('currentMedications')} />
              <FormControlLabel control={<Checkbox checked={f.contactConfirmed} onChange={set('contactConfirmed')} />} label={`联系电话 ${r.phoneMasked || '未登记'} 正确`} />
            </Stack>
            <Alert severity="warning" sx={{ my: 2 }}>如您补充或更正了过敏、妊娠、哺乳或用药信息，药师需要重新审核处方，审核后会再次通知您。</Alert>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>服务选择</Typography>
            <Stack spacing={1}>
              <TextField select size="small" label="取药方式" value={f.fulfillment} onChange={set('fulfillment')}>
                <MenuItem value="pickup">到店自取</MenuItem><MenuItem value="delivery">配送到家</MenuItem><MenuItem value="decoction_pickup">代煎后自取</MenuItem><MenuItem value="decoction_delivery">代煎后配送</MenuItem>
              </TextField>
              <TextField select size="small" label="饮片同规格批次替换（非必要替换）" value={f.substitutionConsent} onChange={set('substitutionConsent')}>
                <MenuItem value="decline">不接受</MenuItem><MenuItem value="accept">接受（仅限药师审核的同规格合格批次）</MenuItem>
              </TextField>
              <FormControlLabel control={<Checkbox checked={f.educationAcknowledged} onChange={set('educationAcknowledged')} />} label="我已阅读用药说明（这不等于专业批准）" />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
              <Button variant="contained" disabled={busy || !f.identityConfirmed} onClick={() => submit('confirm')}>确认</Button>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth label="拒绝原因（可选）" value={f.declineReason} onChange={set('declineReason')} />
              <Button color="error" disabled={busy} onClick={() => submit('decline')}>拒绝服务</Button>
            </Stack>
          </>
        )}
      </Paper>
    </Container>
  );
}
