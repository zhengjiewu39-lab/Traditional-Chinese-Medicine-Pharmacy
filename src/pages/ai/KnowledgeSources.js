import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert, Stack, TextField, Button,
} from '@mui/material';
import { aiGovernanceApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

const STATUS_COLOR = { approved: 'success', draft: 'default', retired: 'default', rejected: 'error' };
const KIND_KEY = {
  local_source: 'ai.knowledge.kindLocal',
  authority_catalog: 'ai.knowledge.kindCatalog',
  pubmed_draft: 'ai.knowledge.kindPubmed',
  herb_catalog: 'ai.knowledge.kindHerb',
};

export default function KnowledgeSources() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [authorities, setAuthorities] = useState(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [herb, setHerb] = useState('黄芪');
  const [query, setQuery] = useState('甘草');
  const [hits, setHits] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');

  const runSearch = async (q) => {
    const term = String(q || '').trim();
    if (!term) {
      setHits({ query: '', hits: [] });
      return;
    }
    setSearching(true);
    try {
      const r = await aiGovernanceApi.searchKnowledge(term);
      setHits(r.data);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    aiGovernanceApi.knowledge().then((r) => setData(r.data)).catch((e) => setError(formatApiError(e)));
    aiGovernanceApi.authorities().then((r) => { setAuthorities(r.data); setAuthError(''); }).catch((e) => setAuthError(formatApiError(e)));
    runSearch('甘草');
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.knowledge.title')}</Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        {t('ai.knowledge.warn')}
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.knowledge.search')}</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>{t('ai.knowledge.searchHint')}</Alert>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" fullWidth label={t('ai.knowledge.search')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(query); }} />
          <Button variant="contained" disabled={searching} onClick={() => runSearch(query)}>{t('ai.knowledge.searchBtn')}</Button>
        </Stack>
        {hits && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.knowledge.hits')} · {hits.hits?.length || 0}</Typography>
            {hits.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{hits.note}</Typography>}
            {!hits.hits?.length && <Alert severity="info">{t('ai.knowledge.searchEmpty')}</Alert>}
            {(hits.hits || []).map((h) => (
              <Paper key={`${h.kind}-${h.id}`} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={t(KIND_KEY[h.kind] || h.kind)} />
                  {h.reviewStatus && <Chip size="small" color={STATUS_COLOR[h.reviewStatus] || 'default'} label={h.reviewStatus} />}
                  {h.access === 'no_open_fulltext_api' && <Chip size="small" variant="outlined" label={t('ai.knowledge.noOpenApi')} />}
                </Stack>
                <Typography sx={{ fontWeight: 700, mt: 0.5 }}>{h.title}</Typography>
                <Typography variant="caption" color="text.secondary">{h.authority}{h.id ? ` · ${h.id}` : ''}</Typography>
                {h.snippet && <Typography variant="body2" sx={{ mt: 0.5 }}>{h.snippet}</Typography>}
                {h.sourceUrl && <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all' }}>{h.sourceUrl}</Typography>}
              </Paper>
            ))}
          </>
        )}
      </Paper>

      {authError && <Alert severity="warning" sx={{ mb: 2 }}>{authError}</Alert>}
      {authorities && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.knowledge.authorities')}</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>{t('ai.knowledge.authoritiesNote')}</Alert>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('ai.knowledge.titleCol')}</TableCell>
                <TableCell>{t('ai.knowledge.authority')}</TableCell>
                <TableCell>{t('ai.knowledge.connector')}</TableCell>
                <TableCell>{t('ai.knowledge.sourceUrl')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {authorities.sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.authority}</TableCell>
                  <TableCell>{s.access === 'no_open_fulltext_api' ? t('ai.knowledge.noOpenApi') : s.access}</TableCell>
                  <TableCell><Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{s.verifyUrl}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField size="small" label={t('ai.knowledge.herbQuery')} value={herb} onChange={(e) => setHerb(e.target.value)} />
            <Button variant="outlined" onClick={async () => {
              try {
                const r = await aiGovernanceApi.fetchKnowledge({ herb, connector: 'pubmed' });
                setNotice(t('ai.knowledge.fetched', { n: r.data.written || 0 }));
                const a = await aiGovernanceApi.authorities();
                setAuthorities(a.data);
                setAuthError('');
                setHerb(herb);
                await runSearch(herb);
              } catch (e) {
                setAuthError(formatApiError(e));
              }
            }}>{t('ai.knowledge.fetchPubmed')}</Button>
          </Stack>
        </Paper>
      )}
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
