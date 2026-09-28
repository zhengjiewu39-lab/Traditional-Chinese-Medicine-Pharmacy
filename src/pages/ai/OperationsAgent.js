import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Alert, Table, TableBody, TableCell, TableHead, TableRow, Button, Stack, Chip, TextField, MenuItem, Checkbox, CircularProgress,
} from '@mui/material';
import { aiOperationsApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { AiLabel } from '../../components/ai/Badges';

const ACTIONS = { purchase: '采购补货', transfer: '库位调拨', expedite: '催办供应商', hold: '暂缓采购' };
const METRIC_LABELS = {
  overallFillRate: '总体满足率', essentialMedicineFillRate: '基本药物满足率', worstRegionEssentialFillRate: '最差区域基本药物满足率', p95WaitingTime: 'P95等待天数', recoveryTime95: '恢复时间(95%)', totalCost: '总成本',
};
const fmt = (k, v) => (v == null ? '—' : /Rate$/.test(k) ? `${(v * 100).toFixed(2)}%` : v.toFixed(k === 'totalCost' ? 0 : 2));

export default function OperationsAgent() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [proposals, setProposals] = useState({ proposals: [], purchaseDrafts: [] });
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);
  const [action, setAction] = useState('purchase');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const canPropose = ['admin', 'pharmacist', 'technician'].includes(user?.role);
  const canApprove = ['admin', 'pharmacist'].includes(user?.role);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([aiOperationsApi.analysis(), aiOperationsApi.proposals()]);
      setAnalysis(a.data);
      setProposals(p.data);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !analysis) return <Alert severity="error">{error}</Alert>;
  if (!analysis) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const s = analysis.summary;
  const riskRows = [...analysis.shortageRisk, ...analysis.risingDemand.filter((r) => !analysis.shortageRisk.some((x) => x.inventoryId === r.inventoryId))].slice(0, 20);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>AI运营建议</Typography>
        <AiLabel />
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{analysis.label}。数字孪生评估使用合成情景（ERRRA启发式策略，未修改），结果不代表真实药房的预测。批准只生成草稿单据，库存不会被自动修改。</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[['品规数', s.skuCount], ['低于最低库存', s.lowStock], ['接近最低库存', s.nearMin], ['近效期(90天)', s.nearExpiry], ['需求上升', s.risingDemand], ['基本药物风险', s.essentialAtRisk]].map(([k, v]) => (
          <Grid item xs={4} md={2} key={k}><Paper sx={{ p: 1.5 }}><Typography variant="caption">{k}</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{v}</Typography></Paper></Grid>
        ))}
      </Grid>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>缺货风险与需求趋势（参考日 {analysis.trendReferenceDate}）</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>品名</TableCell><TableCell>库存 / 最低</TableCell><TableCell>近30天 / 前30天</TableCell><TableCell>供应商</TableCell><TableCell>效期</TableCell><TableCell>标记</TableCell></TableRow></TableHead>
          <TableBody>
            {riskRows.map((r) => (
              <TableRow key={r.inventoryId}>
                <TableCell padding="checkbox"><Checkbox size="small" disabled={!canPropose} checked={picked.includes(r.inventoryId)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.inventoryId] : p.filter((x) => x !== r.inventoryId)))} /></TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.stock} / {r.minStock} {r.unit}</TableCell>
                <TableCell>{r.demandRecent} / {r.demandPrior}</TableCell>
                <TableCell>{r.supplier}</TableCell>
                <TableCell>{r.expiryDate}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {r.lowStock && <Chip size="small" color="error" label="低库存" />}
                    {r.nearExpiry && <Chip size="small" color="warning" label="近效期" />}
                    {r.essential && <Chip size="small" label="基本药物类" />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!riskRows.length && <TableRow><TableCell colSpan={7} align="center">当前无缺货或需求上升风险</TableCell></TableRow>}
          </TableBody>
        </Table>
        {canPropose && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField select size="small" label="建议类型" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 160 }}>
              {Object.entries(ACTIONS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <Button variant="contained" disabled={busy} onClick={() => run(() => aiOperationsApi.propose({ action, ...(picked.length ? { inventoryIds: picked } : {}) }))}>生成建议草稿</Button>
          </Stack>
        )}
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>建议与审批</Typography>
        {proposals.proposals.map((p) => {
          const ev = p.digitalTwinEvaluation;
          return (
            <Paper variant="outlined" key={p.proposalId} sx={{ p: 1.5, mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{p.proposalId.slice(-10)}</Typography>
                <Chip size="small" label={ACTIONS[p.action]} />
                <Chip size="small" variant="outlined" label={{ draft: '草稿', simulated: '已孪生评估', approved: '已批准（草稿单据）', rejected: '已拒绝' }[p.status]} />
                <Typography variant="body2">{p.items.map((i) => `${i.name}${i.quantity ? ` +${i.quantity}` : ''}`).join('、') || '—'}</Typography>
              </Stack>
              <Typography variant="caption" display="block">理由：{p.reason} · 预期收益：{p.expectedBenefit} · 风险：{p.risk}</Typography>
              {ev && (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead><TableRow><TableCell>合成指标（{ev.replicates} 次复制，ERRRA）</TableCell><TableCell>基线</TableCell><TableCell>建议方案</TableCell><TableCell>差值</TableCell></TableRow></TableHead>
                  <TableBody>
                    {Object.keys(ev.baselineMetrics).map((k) => (
                      <TableRow key={k}><TableCell>{METRIC_LABELS[k] || k}</TableCell><TableCell>{fmt(k, ev.baselineMetrics[k])}</TableCell><TableCell>{fmt(k, ev.proposalMetrics[k])}</TableCell><TableCell>{fmt(k, ev.difference[k])}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell colSpan={4}><Typography variant="caption">scenarioHash {ev.scenarioHash.slice(0, 16)}… · {ev.label}</Typography></TableCell></TableRow>
                  </TableBody>
                </Table>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {['draft', 'simulated'].includes(p.status) && <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => aiOperationsApi.simulate(p.proposalId, 3))}>数字孪生评估</Button>}
                {p.status === 'simulated' && canApprove && (
                  <>
                    <TextField size="small" label="审批意见（必填）" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Button size="small" variant="contained" disabled={busy || !comment} onClick={() => run(() => aiOperationsApi.approve(p.proposalId, 'approve', comment).then(() => setComment('')))}>批准（生成草稿单据）</Button>
                    <Button size="small" color="error" disabled={busy || !comment} onClick={() => run(() => aiOperationsApi.approve(p.proposalId, 'reject', comment).then(() => setComment('')))}>拒绝</Button>
                  </>
                )}
                {p.status === 'draft' && <Typography variant="caption" color="text.secondary">需先完成数字孪生评估，再由药师或管理员审批</Typography>}
              </Stack>
            </Paper>
          );
        })}
        {!proposals.proposals.length && <Typography variant="body2" color="text.secondary">暂无建议</Typography>}
        {proposals.purchaseDrafts.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>已生成的草稿单据（待员工在库存/采购模块执行）</Typography>
            {proposals.purchaseDrafts.map((d) => <Typography key={d.docId} variant="body2">{d.docId} · {d.type} · {d.items.length} 项 · 批准人 #{d.approvedBy}</Typography>)}
          </>
        )}
      </Paper>
    </Box>
  );
}
