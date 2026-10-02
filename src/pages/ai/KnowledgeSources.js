import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert,
} from '@mui/material';
import { aiGovernanceApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

const STATUS_COLOR = { approved: 'success', draft: 'default', retired: 'default', rejected: 'error' };

export default function KnowledgeSources() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    aiGovernanceApi.knowledge().then((r) => setData(r.data)).catch((e) => setError(formatApiError(e)));
  }, []);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.knowledge.title')}</Typography>
      <Alert severity="error" sx={{ mb: 2 }}>
        {t('ai.knowledge.warn')}
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <Paper>
          <Typography variant="caption" sx={{ p: 1, display: 'block' }}>{t('ai.knowledge.version', { v: data.knowledgeBaseVersion })} · {data.note}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('ai.knowledge.id')}</TableCell>
                <TableCell>{t('ai.knowledge.titleCol')}</TableCell>
                <TableCell>{t('ai.knowledge.authority')}</TableCell>
                <TableCell>{t('ai.knowledge.verDate')}</TableCell>
                <TableCell>{t('ai.knowledge.status')}</TableCell>
                <TableCell>{t('ai.knowledge.review')}</TableCell>
                <TableCell>{t('ai.knowledge.integrity')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.sources.map((s) => (
                <TableRow key={s.sourceId}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{s.sourceId}</TableCell>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{s.authority}</TableCell>
                  <TableCell>v{s.version} · {s.effectiveDate}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.reviewStatus]} label={t(`ai.reviewStatus.${s.reviewStatus}`) || s.reviewStatus} /></TableCell>
                  <TableCell>{s.reviewedBy || t('ai.dash')} {s.reviewedAt || ''}</TableCell>
                  <TableCell><Chip size="small" color={s.integrityOk ? 'success' : 'error'} label={s.integrityOk ? `sha256 ${s.hash.slice(0, 8)}…` : t('ai.knowledge.hashFail')} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
