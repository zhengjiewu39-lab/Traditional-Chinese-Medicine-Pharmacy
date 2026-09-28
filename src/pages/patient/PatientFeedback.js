import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Alert, Stack, Button, TextField, Rating, FormControlLabel, Switch,
} from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { SYNTHETIC_LABEL } from '../../config/aiLabels';

export default function PatientFeedback() {
  const { token } = useParams();
  const [effectiveness, setEffectiveness] = useState(3);
  const [adverse, setAdverse] = useState(false);
  const [desc, setDesc] = useState('');
  const [comments, setComments] = useState('');
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const submit = async () => {
    try {
      const r = await patientPortalApi.submitFeedback(token, {
        effectiveness, adverseReaction: adverse, ...(desc ? { adverseDescription: desc } : {}), ...(comments ? { comments } : {}),
      });
      setDone(r.data);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>用药反馈</Typography>
        <Alert severity="info" sx={{ my: 2 }}>{SYNTHETIC_LABEL}。如出现严重不适，请立即就医，不要等待线上回复。</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {done ? (
          <Alert severity="success">感谢反馈。{done.pharmacistFollowUp ? '药师将就您报告的不良反应与您联系。' : ''}</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2">服药后的整体感受</Typography>
            <Rating value={effectiveness} onChange={(e, v) => setEffectiveness(v || 1)} />
            <FormControlLabel control={<Switch checked={adverse} onChange={(e) => setAdverse(e.target.checked)} />} label="服药后出现不适或不良反应" />
            {adverse && <TextField multiline minRows={2} label="请描述症状" value={desc} onChange={(e) => setDesc(e.target.value)} />}
            <TextField multiline minRows={2} label="其他意见" value={comments} onChange={(e) => setComments(e.target.value)} />
            <Button variant="contained" onClick={submit}>提交</Button>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
