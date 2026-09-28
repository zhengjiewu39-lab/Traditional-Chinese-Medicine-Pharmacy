import React from 'react';
import { Alert } from '@mui/material';
import { SYNTHETIC_LABEL } from '../../config/aiLabels';

export default function SyntheticDataNotice() {
  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0 }}>
      {SYNTHETIC_LABEL}。本系统为研究原型：AI不独立诊断、开方或批准处方，处方安全与调剂放行由药师最终审核。
    </Alert>
  );
}
