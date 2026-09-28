import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Alert, Chip, Stack, Button, TextField, Table, TableBody, TableCell, TableRow, CircularProgress,
} from '@mui/material';
import { aiGovernanceApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { SEMANTIC_STATUS_LABELS, OVERRIDE_REASONS } from '../../config/aiLabels';
import ConnectRealAi from '../../components/ConnectRealAi';

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

function Metric({ label, value, hint }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}

export default function Governance() {
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setM((await aiGovernanceApi.metrics()).data);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    try {
      await aiGovernanceApi.killSwitch(!m.runtime.aiEnabled, reason);
      setReason('');
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  if (error && !m) return <Alert severity="error">{error}</Alert>;
  if (!m) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>;
  const rt = m.runtime;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>AI治理中心</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {m.label && <Alert severity="warning" sx={{ mb: 2 }}>{m.label}</Alert>}
      {user?.role === 'admin' && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <ConnectRealAi onSaved={load} />
        </Paper>
      )}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip color={rt.aiEnabled ? 'success' : 'default'} label={rt.aiEnabled ? 'AI总开关：开启' : 'AI总开关：关闭（仅规则）'} />
          <Chip variant="outlined" label={`提供方：${rt.provider}`} />
          <Chip variant="outlined" label={`模型：${rt.model || '无'}`} />
          {rt.endpointHost && <Chip variant="outlined" label={`端点：${rt.endpointHost}`} />}
          <Chip variant="outlined" label={`API Key：${rt.apiKeyConfigured ? '已配置（不显示）' : '未配置'}`} />
          <Chip variant="outlined" label={`AI模式：${rt.aiMode || '—'}`} />
          <Chip variant="outlined" label={`数据模式：${rt.dataMode || '—'}`} />
          {rt.degradedMode && <Chip color="warning" label="降级模式：规则兜底" />}
          <Chip color={m.auditChain.valid ? 'success' : 'error'} label={m.auditChain.valid ? `审计链完整（${m.auditChain.length} 条）` : `审计链校验失败：${m.auditChain.reason}`} />
        </Stack>
        {user?.role === 'admin' && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField size="small" label="操作原因（必填，写入审计链）" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ minWidth: 320 }} />
            <Button variant="contained" color={rt.aiEnabled ? 'error' : 'success'} disabled={!reason} onClick={toggle}>{rt.aiEnabled ? '关闭AI（Kill Switch）' : '重新启用AI'}</Button>
          </Stack>
        )}
      </Paper>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><Metric label="模型调用成功率" value={pct(m.rates.modelSuccessRate)} hint={`${m.counts.modelAttempts} 次调用`} /></Grid>
        <Grid item xs={6} md={3}><Metric label="结构化输出失败率" value={pct(m.rates.schemaFailureRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="弃权率" value={pct(m.rates.abstainRate)} hint={`${m.counts.analyses} 次筛查`} /></Grid>
        <Grid item xs={6} md={3}><Metric label="规则—模型冲突率" value={pct(m.rates.ruleModelConflictRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="药师覆盖率" value={pct(m.rates.overrideRate)} hint={`${m.counts.decisions} 项决定`} /></Grid>
        <Grid item xs={6} md={3}><Metric label="证据引用完整率" value={pct(m.rates.citationCompleteness)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="平均模型延迟" value={m.averageLatencyMs == null ? '—' : `${m.averageLatencyMs.toFixed(1)} ms`} /></Grid>
        <Grid item xs={6} md={3}><Metric label="建议采纳率" value={pct(m.suggestions?.rates?.acceptanceRate)} hint="非总体覆盖率" /></Grid>
        <Grid item xs={6} md={3}><Metric label="部分采纳率" value={pct(m.suggestions?.rates?.partialAcceptanceRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="医师提示后改方率" value={pct(m.suggestions?.rates?.prescriptionChangeAfterPromptRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="药师—AI一致率" value={pct(m.suggestions?.rates?.pharmacistAiAgreementRate)} /></Grid>
        <Grid item xs={6} md={3}><Metric label="低风险抽查条数" value={m.counts.lowRiskSamples ?? 0} /></Grid>
        <Grid item xs={6} md={3}><Metric label="药师补充而AI未提示" value={m.rates.pharmacistAddedRisksNotInAi ?? 0} /></Grid>
      </Grid>
      {m.suggestions && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>建议级追踪（不要只用 override rate）</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            待处置 {m.suggestions.counts.pending} · 采纳 {m.suggestions.counts.accepted} · 部分采纳 {m.suggestions.counts.partially_accepted} · 拒绝 {m.suggestions.counts.rejected} · 忽略 {m.suggestions.counts.ignored} · 被覆盖 {m.suggestions.counts.superseded}
          </Typography>
          <Table size="small">
            <TableBody>
              {Object.entries(m.suggestions.rejectReasons || {}).map(([k, v]) => (
                <TableRow key={k}><TableCell>拒绝原因 {k}</TableCell><TableCell>{v}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          {user?.role === 'admin' && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" onClick={async () => { await aiGovernanceApi.sample(0.1); load(); }}>抽取低风险复核样本</Button>
              <Button size="small" onClick={async () => { await aiGovernanceApi.learningExport(); load(); }}>导出去标识化学习候选</Button>
            </Stack>
          )}
        </Paper>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>版本</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>规则集</TableCell><TableCell>{m.versions.ruleSetVersion}</TableCell></TableRow>
                <TableRow><TableCell>知识库</TableCell><TableCell>{m.versions.knowledgeBaseVersion}</TableCell></TableRow>
                {m.versions.prompts.map((p) => <TableRow key={p.id}><TableCell>提示词 {p.id}</TableCell><TableCell>{p.ref}</TableCell></TableRow>)}
                <TableRow><TableCell>知识条目</TableCell><TableCell>可用 {m.knowledgeIntegrity.usable}/{m.knowledgeIntegrity.total}；未审核/废止：{m.knowledgeIntegrity.notApproved.join('、') || '无'}；哈希失败：{m.knowledgeIntegrity.integrityFailed.join('、') || '无'}</TableCell></TableRow>
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>语言模型轨状态分布</Typography>
            <Table size="small">
              <TableBody>
                {Object.entries(m.semanticStatusCounts).map(([k, v]) => <TableRow key={k}><TableCell>{SEMANTIC_STATUS_LABELS[k] || k}</TableCell><TableCell>{v}</TableCell></TableRow>)}
              </TableBody>
            </Table>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>覆盖原因分布</Typography>
            <Table size="small">
              <TableBody>
                {OVERRIDE_REASONS.map((r) => <TableRow key={r.value}><TableCell>{r.label}</TableCell><TableCell>{m.overrideReasons[r.value] || 0}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
      <Alert severity="info" sx={{ mt: 2 }}>
        安全控制：总开关；模型不可用时规则兜底；发送给模型前去除姓名、电话、证件号与地址；日志脱敏且不记录API Key或完整患者令牌；输入长度限制；注入检测；结构化输出校验；超时控制；患者文本仅作为数据处理。
        指标仅反映本系统中的合成演示数据，不代表临床效果。
      </Alert>
    </Box>
  );
}
