import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Alert, Stack, Button, TextField, Table, TableBody, TableCell, TableHead, TableRow, Chip,
} from '@mui/material';
import { aiCasesApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { StateChip } from '../../components/ai/Badges';

const COLUMNS = [
  { state: 'patient_confirmed', title: '待调剂（患者已确认）' },
  { state: 'dispensing', title: '调剂中' },
  { state: 'pharmacist_final_check', title: '待药师复核' },
  { state: 'ready_for_pickup', title: '待取药 / 配送' },
];

const FULFILLMENT = {
  pickup: '到店自取', delivery: '配送', decoction_pickup: '代煎后自取', decoction_delivery: '代煎后配送',
};

function WeighForm({ c, onSubmit, busy }) {
  const [grams, setGrams] = useState(() => Object.fromEntries((c.prescription.herbs || []).map((h) => [h.name, h.dosage ?? ''])));
  return (
    <Box>
      <Table size="small">
        <TableHead><TableRow><TableCell>药味</TableCell><TableCell>处方/剂</TableCell><TableCell>实称/剂(g)</TableCell></TableRow></TableHead>
        <TableBody>
          {(c.prescription.herbs || []).map((h) => (
            <TableRow key={h.name}>
              <TableCell>{h.name}</TableCell>
              <TableCell>{h.dosage}g</TableCell>
              <TableCell><TextField size="small" type="number" value={grams[h.name]} onChange={(e) => setGrams((g) => ({ ...g, [h.name]: e.target.value }))} sx={{ width: 90 }} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button sx={{ mt: 1 }} size="small" variant="contained" disabled={busy} onClick={() => onSubmit(Object.entries(grams).filter(([, v]) => v !== '').map(([name, v]) => ({ name, grams: Number(v) })))}>
        提交复核
      </Button>
    </Box>
  );
}

export default function DispensingBoard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const lists = await Promise.all(COLUMNS.map((col) => aiCasesApi.list({ state: col.state })));
      const full = {};
      for (let i = 0; i < COLUMNS.length; i += 1) {
        full[COLUMNS[i].state] = await Promise.all(lists[i].data.cases.map((s) => aiCasesApi.get(s.caseId).then((r) => r.data.case)));
      }
      setCases(full);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, body) => {
    setBusy(true);
    setError('');
    try {
      await aiCasesApi.dispensing(id, { ...body, ...(note ? { note } : {}) });
      setNote('');
      setOpen(null);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const lastWeighed = (c) => [...(c.dispensingRecords || [])].reverse().find((r) => r.type === 'weighed');

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>调剂与复核</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        仅药师批准且患者确认的处方可进入调剂。复核必须由药师完成，且不能与称量人为同一人。系统不会因调剂自动修改库存。
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        {COLUMNS.map((col) => (
          <Grid item xs={12} md={3} key={col.state}>
            <Paper sx={{ p: 1.5, minHeight: 200 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{col.title}（{cases[col.state]?.length || 0}）</Typography>
              {(cases[col.state] || []).map((c) => {
                const w = lastWeighed(c);
                const deviations = w ? w.items.filter((i) => i.outOfTolerance).length + w.missing.length : 0;
                return (
                  <Paper key={c.caseId} variant="outlined" sx={{ p: 1, mb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate(`/ai/reviews/${c.caseId}`)}>{c.caseId.slice(-8)}</Typography>
                      <StateChip state={c.state} />
                    </Stack>
                    <Typography variant="caption" display="block">{(c.prescription.herbs || []).length} 味 × {c.prescription.doseCount ?? '?'} 剂 · {FULFILLMENT[c.serviceChoices?.fulfillment] || '自取'}</Typography>
                    {c.serviceChoices?.substitutionConsent === 'accept' && <Chip size="small" label="患者接受同规格批次替换" sx={{ mt: 0.5 }} />}
                    {w && <Chip size="small" color={deviations ? 'warning' : 'success'} label={deviations ? `称量偏差 ${deviations} 项` : '称量在允差内'} sx={{ mt: 0.5 }} />}
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {col.state === 'patient_confirmed' && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(c.caseId, { action: 'start' })}>开始调剂</Button>}
                      {col.state === 'dispensing' && (open === c.caseId
                        ? <WeighForm c={c} busy={busy} onSubmit={(items) => act(c.caseId, { action: 'submit_final_check', weighedItems: items })} />
                        : <Button size="small" variant="outlined" onClick={() => setOpen(c.caseId)}>录入称量</Button>)}
                      {col.state === 'pharmacist_final_check' && user?.role === 'pharmacist' && (
                        <>
                          <TextField size="small" label="复核意见（有偏差时必填）" value={open === c.caseId ? note : ''} onFocus={() => setOpen(c.caseId)} onChange={(e) => setNote(e.target.value)} />
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => act(c.caseId, { action: 'final_check_pass' })}>复核通过</Button>
                            <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => act(c.caseId, { action: 'final_check_fail' })}>退回调剂</Button>
                          </Stack>
                        </>
                      )}
                      {col.state === 'pharmacist_final_check' && user?.role !== 'pharmacist' && <Typography variant="caption" color="text.secondary">等待药师复核</Typography>}
                      {col.state === 'ready_for_pickup' && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(c.caseId, { action: 'handover' })}>确认交付</Button>}
                    </Stack>
                  </Paper>
                );
              })}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
