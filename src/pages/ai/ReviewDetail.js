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
  RECOMMENDATION_LABELS, OVERRIDE_REASONS, ABSTAIN_REASON_LABELS, SEMANTIC_STATUS_LABELS, STATE_LABELS,
} from '../../config/aiLabels';

const TRI = { yes: '是', no: '否', unknown: '未确认' };
const ACTION_LABELS = {
  approve: '批准', reject: '驳回', request_information: '要求补充信息', return_to_prescriber: '退回处方医师', override_ai_alert: '覆盖AI提示', confirm_ai_alert: '确认AI提示', request_second_review: '申请二次审核',
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

function EditDialog({ open, onClose, c, onSaved }) {
  const p = c.patient || {};
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setF({
      age: p.ageYears ?? '', allergies: p.allergies ? (p.allergies.length ? p.allergies.join('，') : '无') : '', pregnancy: p.pregnancy || 'unknown', meds: (p.currentMedications || []).join('，'),
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
      await aiCasesApi.update(c.caseId, {
        reason: f.reason,
        patient: {
          ...(f.age !== '' ? { ageYears: Number(f.age) } : {}),
          ...(f.allergies !== '' ? { allergies: f.allergies === '无' ? [] : split(f.allergies) } : {}),
          pregnancy: f.pregnancy,
          currentMedications: split(f.meds),
        },
        prescription: {
          herbs, ...(f.doseCount !== '' ? { doseCount: Number(f.doseCount) } : {}), ...(f.usage ? { usage: f.usage } : {}), ...(f.decoctionNotes ? { decoctionNotes: f.decoctionNotes } : {}),
        },
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(formatApiError(e));
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>补充信息 / 修改处方内容</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>修改已批准处方会使原审核失效，并重新进入AI筛查和药师审核。</Alert>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField fullWidth label="药味与剂量" value={f.herbs || ''} onChange={set('herbs')} /></Grid>
          <Grid item xs={4}><TextField fullWidth label="年龄" type="number" value={f.age ?? ''} onChange={set('age')} /></Grid>
          <Grid item xs={4}>
            <TextField select fullWidth label="妊娠" value={f.pregnancy || 'unknown'} onChange={set('pregnancy')}>
              {Object.entries(TRI).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4}><TextField fullWidth label="剂数" type="number" value={f.doseCount ?? ''} onChange={set('doseCount')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="过敏史（“无”表示无过敏）" value={f.allergies || ''} onChange={set('allergies')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="合并用药" value={f.meds || ''} onChange={set('meds')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="用法用量" value={f.usage || ''} onChange={set('usage')} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="煎煮说明" value={f.decoctionNotes || ''} onChange={set('decoctionNotes')} /></Grid>
          <Grid item xs={12}><TextField fullWidth required label="修改原因（必填）" value={f.reason || ''} onChange={set('reason')} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={!f.reason} onClick={save}>保存并重新筛查</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ReviewDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const isPharmacist = user?.role === 'pharmacist';
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
    `已记录：${ACTION_LABELS[action]}`,
  );

  if (error && !c) return <Alert severity="error">{error}</Alert>;
  if (!c) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const p = c.patient || {};
  const overridable = (out?.alerts || []).filter((a) => a.code !== 'INJECTION_SUSPECTED');

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Button size="small" onClick={() => navigate('/ai/review-queue')}>← 审核队列</Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.caseId.slice(-8)}</Typography>
        <StateChip state={c.state} size="medium" />
        {out && <RiskTierChip tier={out.riskTier} size="medium" />}
        {out && <Chip label={RECOMMENDATION_LABELS[out.recommendation]} variant="outlined" />}
        {c.approval && <Chip color={c.approval.valid ? 'success' : 'default'} label={c.approval.valid ? '药师批准有效' : '原批准已失效'} />}
        {c.synthetic && <Chip size="small" label="合成演示数据" />}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {!out && <Alert severity="info" sx={{ mb: 2 }}>尚未完成AI筛查。<Button size="small" onClick={() => run(() => aiCasesApi.analyze(caseId), '筛查完成')}>开始筛查</Button></Alert>}
      {out?.abstain && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          AI弃权（未给出结论），需药师独立审核。原因：{out.abstainReasons.map((r) => ABSTAIN_REASON_LABELS[r] || r).join('、')}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Section title="处方（原始与结构化）" action={!['completed', 'patient_declined'].includes(c.state) && user?.role !== 'researcher' && <Button size="small" onClick={() => setEditOpen(true)}>补充/修改</Button>}>
            {c.source?.rawText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: 'grey.100', p: 1, mb: 1, borderRadius: 1 }}>
                原始文字：{c.source.rawText}
              </Typography>
            )}
            <Table size="small">
              <TableHead><TableRow><TableCell>药味</TableCell><TableCell>剂量</TableCell><TableCell>说明</TableCell></TableRow></TableHead>
              <TableBody>
                {(c.prescription.herbs || []).map((h, i) => (
                  <TableRow key={`${h.name}-${i}`}><TableCell>{h.name}</TableCell><TableCell>{h.dosage ?? '—'}{h.unit}</TableCell><TableCell>{h.processing || h.note || ''}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="body2" sx={{ mt: 1 }}>
              剂数：{c.prescription.doseCount ?? '未注明'} · 用法：{c.prescription.usage || c.prescription.frequency || '未注明'} · 煎煮：{c.prescription.decoctionNotes || '未注明'}
            </Typography>
            <Typography variant="body2">处方医师：{c.prescriber?.name || '未登记'}{c.prescriber?.licenseVerified === false ? '（资质未通过）' : ''} · 开具日期：{c.prescription.issuedAt || '未注明'}</Typography>
            {c.prescription.prescriberAttestations?.length > 0 && <Typography variant="body2">医师双签：{c.prescription.prescriberAttestations.join('、')}</Typography>}
          </Section>
          <Section title="患者关键风险信息">
            <Typography variant="body2">年龄：{p.ageYears ?? '未记录'} · 性别：{{ male: '男', female: '女' }[p.sex] || '未知'} · 妊娠：{TRI[p.pregnancy] || '未确认'} · 哺乳：{TRI[p.lactation] || '未确认'}</Typography>
            <Typography variant="body2">过敏史：{p.allergies ? (p.allergies.length ? p.allergies.join('、') : '无') : '未记录'}</Typography>
            <Typography variant="body2">合并用药：{p.currentMedications?.length ? p.currentMedications.join('、') : '无/未记录'}</Typography>
            <Typography variant="body2">肝功能异常：{p.liverImpairment ? '是' : '否/未记录'} · 肾功能异常：{p.renalImpairment ? '是' : '否/未记录'}</Typography>
          </Section>
          <Section title="历史记录">
            <Typography variant="caption" color="text.secondary">筛查记录（只追加）</Typography>
            <List dense>
              {c.analyses.map((a) => (
                <ListItem key={a.analysisId} disableGutters>
                  <ListItemText primary={`${new Date(a.at).toLocaleString()} · ${a.output.riskTier} · ${RECOMMENDATION_LABELS[a.output.recommendation]}`} secondary={`触发：${a.trigger} · 内容版本 v${a.contentVersion} · ${a.output.modelVersion}`} />
                </ListItem>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary">药师决定（只追加）</Typography>
            <List dense>
              {c.decisions.map((d) => (
                <ListItem key={d.decisionId} disableGutters>
                  <ListItemText primary={`${new Date(d.at).toLocaleString()} · ${ACTION_LABELS[d.action]}${d.overrideReason ? `（${OVERRIDE_REASONS.find((r) => r.value === d.overrideReason)?.label}）` : ''}`} secondary={`药师 #${d.pharmacistId}${d.alertCodes.length ? ` · ${d.alertCodes.join(', ')}` : ''}${d.comment ? ` · ${d.comment}` : ''}`} />
                </ListItem>
              ))}
              {!c.decisions.length && <ListItem disableGutters><ListItemText secondary="暂无" /></ListItem>}
            </List>
            <Typography variant="caption" color="text.secondary">状态流转</Typography>
            <List dense>
              {c.transitions.map((t, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemText primary={`${STATE_LABELS[t.from]} → ${STATE_LABELS[t.to]}`} secondary={`${new Date(t.at).toLocaleString()} · ${t.actorType} #${t.actorId}${t.reason ? ` · ${t.reason}` : ''}`} />
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1}>
              {['admin', 'pharmacist'].includes(user?.role) && (
                <>
                  <Button size="small" onClick={async () => { const r = await aiCasesApi.audit(caseId); setEvents(r.data); }}>查看审计链</Button>
                  <Button size="small" onClick={() => run(async () => { const r = await aiCasesApi.replay(caseId); if (!r.data.comparison.identical) throw new Error('回放结果与原分析不一致'); }, '回放完成：结果与原分析一致')}>回放分析</Button>
                </>
              )}
            </Stack>
            {events && (
              <Box sx={{ mt: 1 }}>
                <Chip size="small" color={events.chain.valid ? 'success' : 'error'} label={events.chain.valid ? `审计链校验通过（共 ${events.chain.length} 条）` : `审计链校验失败：${events.chain.reason}`} />
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
              <Section title="规则命中与阻断" action={<AiLabel isMock={out.semanticTrackResult.isMock} />}>
                {out.hardStops.map((h) => (
                  <Alert severity="error" key={`${h.code}-${h.ruleId}`} sx={{ mb: 1 }}>
                    <strong>A3 阻断 · {h.code}</strong>：{h.message}
                    <Typography variant="caption" display="block">
                      依据：{h.evidenceIds.join('、') || '无可引用证据'} · 解除方式：{h.resolution === 'prescriber_attestation' ? `处方医师双签（${h.attestationKey}）后重新评估` : '仅能由处方医师修改处方'}
                    </Typography>
                  </Alert>
                ))}
                <Table size="small">
                  <TableHead><TableRow><TableCell>等级</TableCell><TableCell>提示</TableCell><TableCell>来源</TableCell><TableCell>证据</TableCell></TableRow></TableHead>
                  <TableBody>
                    {out.alerts.map((a, i) => (
                      <TableRow key={`${a.code}-${i}`}>
                        <TableCell><RiskTierChip tier={a.tier} /></TableCell>
                        <TableCell>{a.message}</TableCell>
                        <TableCell>{a.source === 'ai' ? 'AI' : '规则'}</TableCell>
                        <TableCell>{a.evidenceIds.join('、') || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!out.alerts.length && <TableRow><TableCell colSpan={4}>无提示</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Section>

              {(out.missingInformation.length > 0 || out.counterfactuals.length > 0) && (
                <Section title="缺失信息与重新评估条件">
                  <List dense>
                    {out.missingInformation.map((m) => (
                      <ListItem key={m.field} disableGutters><ListItemText primary={`${m.critical ? '【关键】' : ''}${m.message}`} secondary={`${m.field} · ${m.source === 'ai' ? 'AI标记' : '规则'}`} /></ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">反事实解释：满足以下条件后可重新评估（系统不会自动建议替换药材）</Typography>
                  <List dense>
                    {out.counterfactuals.map((cf, i) => <ListItem key={i} disableGutters><ListItemText primary={cf.text} secondary={cf.code} /></ListItem>)}
                  </List>
                  {out.substitutionCandidates.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">供药师审核的规则化候选（药事委员会规则，非AI建议）</Typography>
                      <List dense>
                        {out.substitutionCandidates.map((s) => <ListItem key={s.ruleId} disableGutters><ListItemText primary={`${s.from} → ${s.to}`} secondary={`${s.ruleId} · ${s.condition} · ${s.approvedBy} · 依据 ${s.evidenceIds.join('、')}`} /></ListItem>)}
                      </List>
                    </>
                  )}
                </Section>
              )}

              <Section title="AI解释（面向药师）" action={<Chip size="small" label={SEMANTIC_STATUS_LABELS[out.semanticTrackResult.status] || out.semanticTrackResult.status} />}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{out.pharmacistExplanation}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  证据充分程度：{out.evidenceStrength} · 模型 {out.modelVersion} · 提示词 {out.promptVersion} · 规则 {out.ruleSetVersion} · 知识库 {out.knowledgeBaseVersion}
                </Typography>
                {out.disagreements.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    规则与模型分歧：{out.disagreements.map((d) => d.detail).join('；')}
                  </Alert>
                )}
                {out.semanticTrackResult.violations.length > 0 && (
                  <Alert severity="error" sx={{ mt: 1 }}>模型输出已丢弃：{out.semanticTrackResult.violations.map((v) => v.message).join('；')}</Alert>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">患者版说明（药师批准后患者可见）</Typography>
                <Typography variant="body2">{out.patientExplanation}</Typography>
              </Section>

              <Section title="引用证据（仅已审核且哈希校验通过的条目）">
                <List dense>
                  {out.retrievalTrackResult.retrieved.map((e) => (
                    <ListItem key={e.sourceId} disableGutters><ListItemText primary={`${e.sourceId} · ${e.title}`} secondary={`${e.authority} · v${e.version} · sha256 ${e.hash.slice(0, 12)}…`} /></ListItem>
                  ))}
                </List>
                {out.retrievalTrackResult.missingEvidenceFor.length > 0 && <Alert severity="info">以下风险项缺少已审核证据：{out.retrievalTrackResult.missingEvidenceFor.join('、')}</Alert>}
              </Section>

              <Section title="药师操作">
                {!isPharmacist && <Alert severity="info">只有药师可以批准、驳回、退回或覆盖AI提示。当前角色只读。</Alert>}
                {isPharmacist && !inReview && <Alert severity="info">当前状态为「{STATE_LABELS[c.state]}」，无需审核操作。</Alert>}
                {isPharmacist && inReview && (
                  <Stack spacing={2}>
                    {c.secondReview?.status === 'pending' && <Alert severity="info">已申请二次审核（药师 #{c.secondReview.requestedBy}），需由另一位药师批准。</Alert>}
                    <TextField label={out.abstain ? '审核意见（AI弃权时批准必填）' : '审核意见'} multiline minRows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button variant="contained" color="success" disabled={busy || out.riskTier === 'A3'} onClick={() => decide('approve')}>批准</Button>
                      <Button variant="outlined" color="error" disabled={busy || !comment} onClick={() => decide('reject')}>驳回</Button>
                      <Button variant="outlined" disabled={busy || !comment} onClick={() => decide('return_to_prescriber')}>退回处方医师</Button>
                      <Button variant="outlined" disabled={busy} onClick={() => decide('request_second_review')}>申请二次审核</Button>
                    </Stack>
                    {out.riskTier === 'A3' && <Alert severity="error">A3 强制阻断：不能批准，请退回处方医师或驳回。</Alert>}
                    <Stack direction="row" spacing={1}>
                      <TextField size="small" fullWidth label="需补充的信息（逗号分隔）" value={infoItems} onChange={(e) => setInfoItems(e.target.value)} />
                      <Button variant="outlined" disabled={busy || !infoItems} onClick={() => decide('request_information', { requestedInformation: infoItems.split(/[，,]/).map((x) => x.trim()).filter(Boolean) })}>要求补充</Button>
                    </Stack>
                    {overridable.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">确认或覆盖AI提示（A3阻断不可覆盖）</Typography>
                        <Stack>
                          {overridable.map((a, i) => (
                            <FormControlLabel
                              key={`${a.code}-${i}`}
                              control={<Checkbox size="small" checked={selected.includes(a.code)} onChange={(e) => setSelected((s) => (e.target.checked ? [...new Set([...s, a.code])] : s.filter((x) => x !== a.code)))} />}
                              label={<Typography variant="body2">{a.code}：{a.message}</Typography>}
                            />
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <TextField select size="small" label="覆盖原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ minWidth: 240 }}>
                            {OVERRIDE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                          </TextField>
                          <Button variant="outlined" disabled={busy || !selected.length || !reason || (reason === 'other' && !comment)} onClick={() => decide('override_ai_alert', { alertCodes: selected, overrideReason: reason })}>覆盖</Button>
                          <Button variant="outlined" disabled={busy || !selected.length} onClick={() => decide('confirm_ai_alert', { alertCodes: selected })}>确认</Button>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
                {c.state === 'pharmacist_approved' && ['pharmacist', 'technician'].includes(user?.role) && (
                  <Box sx={{ mt: 2 }}>
                    <Button variant="contained" disabled={busy} onClick={() => run(async () => { const r = await aiCasesApi.issuePatientConfirmation(caseId); setLink(r.data); }, '已生成患者确认链接')}>生成患者确认链接</Button>
                  </Box>
                )}
                {link && (
                  <Alert severity="info" sx={{ mt: 2, wordBreak: 'break-all' }}>
                    一次性患者确认链接（{new Date(link.expiresAt).toLocaleString()} 前有效，仅显示一次）：<br />
                    {`${window.location.origin}${link.path}`}
                  </Alert>
                )}
              </Section>
            </>
          )}
        </Grid>
      </Grid>
      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} c={c} onSaved={() => { setNotice('内容已更新并重新筛查'); load(); }} />
    </Box>
  );
}
