import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, Chip,
} from '@mui/material';
import { QrCode2, Search } from '@mui/icons-material';
import { pickupApi } from '../services/aiApi';
import { formatApiError } from '../config/httpClient';

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
      const res = await pickupApi.redeem(code.trim());
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error?.message || formatApiError(e) || '取药令牌无效');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <QrCode2 sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" fontWeight={700}>取药核验</Typography>
        <Typography variant="body2" color="text.secondary">
          使用药师签发的短时一次性令牌。接口不返回完整患者或完整处方。
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            label="取药令牌"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <Button variant="contained" startIcon={<Search />} onClick={lookup} disabled={loading}>核验</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <Paper sx={{ p: 3 }}>
          <Chip label={data.ready ? '可取药' : '未就绪'} color={data.ready ? 'success' : 'warning'} sx={{ mb: 2 }} />
          <Typography variant="body2">病例尾号：{data.caseRef}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {(data.herbs || []).map((h) => `${h.name} ${h.dosage}${h.unit || 'g'}`).join('，') || '—'}
          </Typography>
          {data.synthetic && <Alert severity="warning" sx={{ mt: 2 }}>合成演示数据，不得当作真实患者处方。</Alert>}
        </Paper>
      )}
    </Box>
  );
}

export default PatientPickup;
