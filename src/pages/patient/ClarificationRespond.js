import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';

export default function ClarificationRespond() {
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [status, setStatus] = useState('unknown');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    patientPortalApi.getClarification(token).then((r) => setView(r.data)).catch((e) => setError(formatApiError(e)));
  }, [token]);
  const submit = async () => {
    try {
      const out = await patientPortalApi.submitClarification(token, { status, value: status === 'reported' ? value : null, kind: 'correct' });
      setMsg(out.data.outcome);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  };
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>待补充问题</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {view && (
        <Paper sx={{ p: 2 }}>
          <Typography sx={{ mb: 1 }}>{view.task?.question}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>{view.task?.reason}</Typography>
          <TextField select fullWidth size="small" label="状态（含未知）" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 2 }}>
            {(view.task?.allowedStatuses || ['unknown', 'none', 'reported']).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="内容（选择 reported 时填写）" value={value} onChange={(e) => setValue(e.target.value)} sx={{ mb: 2 }} />
          <Button variant="contained" onClick={submit}>提交</Button>
        </Paper>
      )}
    </Box>
  );
}
