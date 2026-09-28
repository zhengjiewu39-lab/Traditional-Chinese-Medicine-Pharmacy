import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Alert, List, ListItem, ListItemText, Chip, Stack,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { STATE_LABELS } from '../../config/aiLabels';

const EVENT_LABELS = {
  case_received: '处方已接收',
  state_transition: '状态更新',
  patient_confirmation_requested: '请您确认信息',
  patient_confirmed: '您已确认',
  patient_declined: '您已拒绝服务',
  patient_feedback_submitted: '反馈已提交',
};

export default function MyPrescriptions() {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    patientPortalApi.myCases().then((r) => setCases(r.data.cases)).catch((e) => setError(formatApiError(e)));
  }, []);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>我的处方</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {cases && !cases.length && <Alert severity="info">暂无处方记录</Alert>}
      {cases?.map((c) => (
        <Paper key={c.caseRef} sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontFamily: 'monospace' }}>{c.caseRef}</Typography>
            <Chip size="small" label={STATE_LABELS[c.state] || c.state} />
          </Stack>
          <Typography variant="body2" sx={{ mt: 1 }}>{c.prescription.herbs.map((h) => `${h.name}${h.dosage ?? ''}${h.unit}`).join('、')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{c.explanation.text}</Typography>
          <List dense>
            {c.events.map((e, i) => (
              <ListItem key={i} disableGutters>
                <ListItemText primary={`${EVENT_LABELS[e.eventType] || e.eventType}${e.summary && e.eventType === 'state_transition' ? `：${STATE_LABELS[e.summary] || e.summary}` : ''}`} secondary={new Date(e.timestamp).toLocaleString()} />
              </ListItem>
            ))}
          </List>
        </Paper>
      ))}
    </Box>
  );
}
