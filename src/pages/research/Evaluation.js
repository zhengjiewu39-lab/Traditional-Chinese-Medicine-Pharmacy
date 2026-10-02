import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, Paper, Typography } from '@mui/material';
import { researchEvalApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';

export default function Evaluation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    researchEvalApi.home().then((r) => setData(r.data)).catch((e) => setError(formatApiError(e)));
  }, []);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>研究评估</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <Paper sx={{ p: 2 }}>
          <Typography sx={{ mb: 1 }}>{data.paperQuestion}</Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>{data.warning}</Alert>
          <Chip label={data.liveModelReport?.present === false ? 'No live-model file' : 'Live report present'} sx={{ mr: 1 }} />
          <Chip label="Mock is engineering only" />
          <Typography variant="body2" sx={{ mt: 2 }}>Groups: {(data.groups || []).join(' · ')}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>{data.liveModelReport?.reason || ''}</Typography>
          <Typography variant="caption" display="block" sx={{ mt: 2 }}>MedWear: disabled. This is not a clinical validation.</Typography>
        </Paper>
      )}
    </Box>
  );
}
