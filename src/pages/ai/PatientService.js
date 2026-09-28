import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Alert, Table, TableBody, TableCell, TableHead, TableRow, Button, Chip, Stack,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { StateChip } from '../../components/ai/Badges';

const STATES = ['pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed', 'patient_declined', 'completed'];

export default function PatientService() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [links, setLinks] = useState({});

  const load = useCallback(async () => {
    try {
      const lists = await Promise.all(STATES.map((s) => aiCasesApi.list({ state: s })));
      const summaries = lists.flatMap((l) => l.data.cases);
      const full = await Promise.all(summaries.map((s) => aiCasesApi.get(s.caseId).then((r) => r.data.case)));
      setRows(full);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const issue = async (id) => {
    try {
      const r = await aiCasesApi.issuePatientConfirmation(id);
      setLinks((l) => ({ ...l, [id]: r.data }));
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>患者用药服务</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        患者通过一次性、限时、仅限本处方的链接确认身份与安全信息、选择取药/配送/代煎、决定是否接受同规格批次替换，或拒绝服务。
        患者的确认不等于专业批准，也不能解除A3阻断；患者补充的安全信息会使原批准失效并返回药师审核。
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>任务</TableCell><TableCell>状态</TableCell><TableCell>服务选择</TableCell><TableCell>反馈 / 不良反应</TableCell><TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => {
              const fb = c.patientFeedback || [];
              return (
                <TableRow key={c.caseId}>
                  <TableCell sx={{ fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>{c.caseId.slice(-8)}</TableCell>
                  <TableCell><StateChip state={c.state} /></TableCell>
                  <TableCell>{c.serviceChoices ? `${c.serviceChoices.fulfillment} · 替换：${c.serviceChoices.substitutionConsent === 'accept' ? '接受' : '不接受'}` : '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {fb.map((f, i) => <Chip key={i} size="small" label={`疗效 ${f.effectiveness}/5`} />)}
                      {c.pharmacovigilanceFollowUp && <Chip size="small" color="error" label="不良反应待药师随访" />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360, wordBreak: 'break-all' }}>
                    {['pharmacist_approved', 'patient_confirmation_required'].includes(c.state) && (
                      <Button size="small" variant="outlined" onClick={() => issue(c.caseId)}>{c.state === 'pharmacist_approved' ? '生成确认链接' : '重新生成链接（旧链接作废）'}</Button>
                    )}
                    {links[c.caseId] && <Typography variant="caption" display="block">{`${window.location.origin}${links[c.caseId].path}`}</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={5} align="center">暂无需要患者参与的处方</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
