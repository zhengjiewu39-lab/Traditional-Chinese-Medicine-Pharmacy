import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert,
} from '@mui/material';
import { aiGovernanceApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';

const STATUS = { approved: ['已审核', 'success'], draft: ['草稿', 'default'], retired: ['已废止', 'default'], rejected: ['已拒绝', 'error'] };

export default function KnowledgeSources() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    aiGovernanceApi.knowledge().then((r) => setData(r.data)).catch((e) => setError(formatApiError(e)));
  }, []);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>证据知识库</Typography>
      <Alert severity="error" sx={{ mb: 2 }}>
        合成知识库，不得用于临床。正式模式只检索经药师审核且在有效期内的来源。找不到足够证据时必须标记“证据不足，需要人工判断”，禁止编造引用。禁忌、剂量、配伍和特殊人群建议的引用完整率生产门槛为 100%。
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <Paper>
          <Typography variant="caption" sx={{ p: 1, display: 'block' }}>版本：{data.knowledgeBaseVersion}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>编号</TableCell><TableCell>标题</TableCell><TableCell>权威来源</TableCell><TableCell>版本 / 生效</TableCell><TableCell>状态</TableCell><TableCell>审核</TableCell><TableCell>完整性</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {data.sources.map((s) => (
                <TableRow key={s.sourceId}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{s.sourceId}</TableCell>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{s.authority}</TableCell>
                  <TableCell>v{s.version} · {s.effectiveDate}</TableCell>
                  <TableCell><Chip size="small" color={STATUS[s.reviewStatus]?.[1]} label={STATUS[s.reviewStatus]?.[0] || s.reviewStatus} /></TableCell>
                  <TableCell>{s.reviewedBy || '—'} {s.reviewedAt || ''}</TableCell>
                  <TableCell><Chip size="small" color={s.integrityOk ? 'success' : 'error'} label={s.integrityOk ? `sha256 ${s.hash.slice(0, 8)}…` : '校验失败'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
