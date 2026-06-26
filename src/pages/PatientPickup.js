import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, Chip, Stepper, Step, StepLabel,
  Grid, Card, CardContent, Divider,
} from '@mui/material';
import { QrCode2, Search } from '@mui/icons-material';
import { prescriptionApi } from '../services/api';

const STEPS = ['待审核', '配药中', '待取药', '已完成'];
const stepIndex = { 待审核: 0, 已审核: 0, 配药中: 1, 待取药: 2, 已完成: 3 };

function PatientPickup() {
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await prescriptionApi.getPickupByCode(code.trim().toUpperCase());
      setData(res.data);
    } catch {
      setError('取药码无效，请核对后重试');
    } finally {
      setLoading(false);
    }
  };

  const rx = data?.prescription;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <QrCode2 sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" fontWeight={700}>取药进度查询</Typography>
        <Typography variant="body2" color="text.secondary">输入医生提供的 6 位取药码，查看配药进度</Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth label="取药码" placeholder="TCM128456"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
          <Button variant="contained" startIcon={<Search />} onClick={lookup} disabled={loading}>
            查询
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          演示码：TCM128456（张三）· TCM339812（李四）
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {rx && (
        <>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>{rx.patientName}</Typography>
              <Chip label={rx.status} color={rx.status === '已完成' ? 'success' : rx.status === '待取药' ? 'secondary' : 'warning'} />
            </Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>诊断：{rx.diagnosis}</Typography>
            <Typography variant="body2" gutterBottom>开方医生：{rx.doctor} · {rx.date}</Typography>
            <Stepper activeStep={stepIndex[rx.status] ?? 0} alternativeLabel sx={{ mt: 3 }}>
              {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
            </Stepper>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>处方明细</Typography>
                  {(rx.herbs || []).map((h, i) => (
                    <Typography key={i} variant="body2">{h.name} {h.dosage}</Typography>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>取药指引</Typography>
                  {rx.status === '待取药' && (
                    <Alert severity="success" sx={{ mb: 1 }}>药品已备好，请前往收银台出示取药码 {rx.pickupCode} 完成付款取药</Alert>
                  )}
                  {rx.status === '配药中' && <Alert severity="info">药师正在配药，请稍候</Alert>}
                  {rx.status === '待审核' && <Alert severity="warning">处方审核中，请等待药师确认</Alert>}
                  {rx.status === '已完成' && <Alert severity="success">已完成取药，祝您早日康复</Alert>}
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    预计金额：¥{data.prefill?.subtotal ?? '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {(rx.timeline || []).length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>进度记录</Typography>
              {rx.timeline.map((t, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  {new Date(t.at).toLocaleString()} · {t.status} · {t.note}
                </Typography>
              ))}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

export default PatientPickup;
