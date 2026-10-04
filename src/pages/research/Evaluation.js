import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel, MenuItem,
  Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Pagination,
} from '@mui/material';
import { researchEvalApi } from '../../services/aiApi';
import { nextRequestGeneration, shouldApplyJobResponse, bindAfterJobSwitch } from './jobResultBinding';
import { formatApiError } from '../../config/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

const GROUPS = ['A', 'B', 'C', 'D', 'RAG_off'];
const GROUP_KEYS = {
  A: 'researchEval.groupA',
  B: 'researchEval.groupB',
  C: 'researchEval.groupC',
  D: 'researchEval.groupD',
  RAG_off: 'researchEval.groupRag',
};
const CAT_KEYS = {
  complete: 'researchEval.catComplete',
  critical_missing: 'researchEval.catMissing',
  unknown: 'researchEval.catUnknown',
  colloquial: 'researchEval.catColloquial',
};
const SOURCE_KEYS = {
  rules: 'researchEval.sourceRules',
  mock: 'researchEval.sourceMock',
  shadow_model: 'researchEval.sourceShadow',
  policy_paused: 'researchEval.sourcePaused',
};

function AdviceBox({ advice, t }) {
  if (!advice) return null;
  return (
    <Alert severity="info" sx={{ mt: 1 }}>
      <Typography variant="subtitle2">{t('researchEval.adviceTitle')}</Typography>
      <Typography variant="caption" display="block">
        {t('researchEval.adviceSource')}：{t(SOURCE_KEYS[advice.source] || 'researchEval.sourceRules')}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>{advice.summary}</Typography>
      {(advice.meaning || []).slice(1).map((line) => (
        <Typography key={line} variant="body2">{line}</Typography>
      ))}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('researchEval.next')}</Typography>
      {(advice.nextSteps || []).map((line) => (
        <Typography key={line} variant="body2">· {line}</Typography>
      ))}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('researchEval.caveats')}</Typography>
      {(advice.caveats || []).map((line) => (
        <Typography key={line} variant="caption" display="block">· {line}</Typography>
      ))}
      {advice.pathHint && <Typography variant="caption" display="block" sx={{ mt: 1 }}>{advice.pathHint}</Typography>}
    </Alert>
  );
}

export default function Evaluation() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [home, setHome] = useState(null);
  const [snap, setSnap] = useState(null);
  const [cases, setCases] = useState({ records: [], total: 0 });
  const [exceptions, setExceptions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [results, setResults] = useState([]);
  const [resultsJobId, setResultsJobId] = useState(null);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultPage, setResultPage] = useState(1);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [busyAdvise, setBusyAdvise] = useState(false);
  const [busyStart, setBusyStart] = useState(false);
  const requestGen = useRef(0);
  const selectedRef = useRef({ jobId: null, page: 1, gen: 0 });
  const [cfg, setCfg] = useState({
    groups: ['A', 'C', 'D'],
    split: 'test',
    limit: 1,
    replicates: 1,
    inferenceMode: 'mock',
    inputMode: 'structured',
    maxBurden: 6,
    maxRounds: 3,
    confirmLive: false,
    confirmFullLive: false,
    contentHash: '',
    newRun: false,
  });

  const load = useCallback(async () => {
    const [h, s, c, e, j] = await Promise.all([
      researchEvalApi.home(),
      researchEvalApi.snapshot(),
      researchEvalApi.snapshotCases({ q, offset: (page - 1) * 10, limit: 10, contentHash: cfg.contentHash || undefined }),
      researchEvalApi.snapshotExceptions(),
      researchEvalApi.listJobs(),
    ]);
    setHome(h.data);
    setSnap(s.data);
    setCases(c.data);
    setExceptions(e.data.records || []);
    setJobs(j.data.jobs || []);
  }, [page, q, cfg.contentHash]);

  useEffect(() => {
    load().catch((err) => setError(formatApiError(err)));
  }, [load]);

  useEffect(() => {
    selectedRef.current = { jobId: selectedJob?.id || null, page: resultPage, gen: requestGen.current };
  }, [selectedJob?.id, resultPage]);

  useEffect(() => {
    if (!selectedJob?.id) return undefined;
    requestGen.current = nextRequestGeneration(requestGen.current);
    const request = { jobId: selectedJob.id, page: resultPage, gen: requestGen.current };
    selectedRef.current = request;
    researchEvalApi.jobResults(request.jobId, { offset: (request.page - 1) * 20, limit: 20 }).then((r) => {
      if (!shouldApplyJobResponse(request, selectedRef.current)) return;
      setResults(r.data.results || []);
      setResultsTotal(r.data.total ?? (r.data.results || []).length);
      setResultsJobId(request.jobId);
    }).catch((err) => {
      if (shouldApplyJobResponse(request, selectedRef.current)) setError(formatApiError(err));
    });
    return undefined;
  }, [selectedJob?.id, resultPage]);

  useEffect(() => {
    const running = jobs.some((j) => ['queued', 'running'].includes(j.status));
    if (!running) return undefined;
    const tmr = setInterval(() => {
      load().catch(() => {});
      const jobId = selectedRef.current.jobId;
      if (!jobId) return;
      researchEvalApi.jobProgress(jobId).then((r) => {
        if (selectedRef.current.jobId !== jobId) return;
        setSelectedJob((cur) => (cur?.id === jobId ? { ...cur, ...r.data, id: jobId } : cur));
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(tmr);
  }, [jobs, selectedJob?.id, load]);

  const start = async (preset) => {
    setError('');
    setNotice('');
    if (!cfg.groups.length) {
      setError(t('researchEval.needGroup'));
      return;
    }
    if (preset === 'single' && !selectedSceneId) {
      setError(t('researchEval.needCase'));
      return;
    }
    setBusyStart(true);
    try {
      const body = {
        groups: preset === 'single' ? ['D'] : cfg.groups,
        split: cfg.split,
        selectUnit: preset === 'single' ? 'scene' : 'base_case',
        limit: preset === 'single' ? 1 : preset === 'pilot' ? Math.min(8, Number(cfg.limit) || 8) : cfg.limit,
        replicates: cfg.replicates,
        inferenceMode: cfg.inferenceMode,
        inputMode: cfg.inputMode,
        maxBurden: cfg.maxBurden,
        maxRounds: cfg.maxRounds,
        confirmLive: cfg.confirmLive,
        confirmFullLive: cfg.confirmFullLive,
        ...(preset === 'single' && selectedSceneId ? { ids: [selectedSceneId] } : {}),
        ...(cfg.contentHash ? { contentHash: cfg.contentHash } : {}),
        ...(cfg.newRun ? { runTag: `rerun-${Date.now()}` } : {}),
      };
      const res = await researchEvalApi.createJob(body);
      requestGen.current = nextRequestGeneration(requestGen.current);
      const bound = bindAfterJobSwitch(res.data.job.id);
      selectedRef.current = { jobId: bound.jobId, page: bound.page, gen: requestGen.current };
      setNotice(res.data.replayed ? t('researchEval.replayed') : t('researchEval.created', { id: res.data.job.id }));
      setSelectedJob(res.data.job);
      setResults(bound.results);
      setResultsJobId(bound.jobId);
      setResultsTotal(0);
      setResultPage(bound.page);
      setTrace(bound.trace);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyStart(false);
    }
  };

  const act = async (fn, id) => {
    try {
      const res = await fn(id);
      requestGen.current = nextRequestGeneration(requestGen.current);
      setTrace(null);
      setSelectedJob(res.data.job);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const openResults = async (job) => {
    requestGen.current = nextRequestGeneration(requestGen.current);
    const bound = bindAfterJobSwitch(job.id);
    const request = { jobId: job.id, page: bound.page, gen: requestGen.current };
    selectedRef.current = request;
    setSelectedJob(job);
    setResults(bound.results);
    setTrace(bound.trace);
    setResultsJobId(bound.jobId);
    setResultPage(bound.page);
    try {
      const res = await researchEvalApi.jobResults(job.id, { offset: 0, limit: 20 });
      if (!shouldApplyJobResponse(request, selectedRef.current)) return;
      setResults(res.data.results || []);
      setResultsTotal(res.data.total ?? (res.data.results || []).length);
    } catch (err) {
      if (shouldApplyJobResponse(request, selectedRef.current)) setError(formatApiError(err));
    }
  };

  const downloadExport = async (id, format) => {
    const res = await researchEvalApi.exportJob(id, format);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const advise = async (scope, row, job) => {
    const jobId = job?.id || selectedJob?.id;
    if (!jobId) return;
    setBusyAdvise(true);
    setError('');
    try {
      const res = await researchEvalApi.adviseJob(jobId, {
        scope,
        lang,
        researchCaseId: row?.researchCaseId,
        groupId: row?.groupId,
        replicate: row?.replicate || 1,
      });
      if (scope === 'job') setSelectedJob(res.data.job);
      else {
        setResults((prev) => prev.map((r) => (r.key === res.data.result?.key ? res.data.result : r)));
        setTrace((cur) => (cur?.kind === 'result' ? { ...cur, row: res.data.result, advisor: res.data.advisor } : cur));
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyAdvise(false);
    }
  };

  const counts = snap?.counts || home?.snapshot?.counts || {};
  const categoryLabel = (c) => t(CAT_KEYS[c] || 'researchEval.colCategory');

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('researchEval.title')}</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>{t('researchEval.intro')}</Alert>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.pathTitle')}</Typography>
        {[1, 2, 3, 4, 5].map((n) => (
          <Typography key={n} variant="body2">{t(`researchEval.path${n}`)}</Typography>
        ))}
        <Button component={RouterLink} to="/research/desk" size="small" sx={{ mt: 1 }}>{t('researchEval.deskLink')}</Button>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {home && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('researchEval.warningExtra', { n: counts.baseCases || '—' })}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.dataset')}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{t('researchEval.datasetHelp')}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {snap?.datasetId} · {snap?.version} · hash {(snap?.contentHash || '').slice(0, 12)} · {snap?.generatedAt}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
          <Chip label={`${t('researchEval.baseCases')} ${counts.baseCases ?? '—'}`} />
          <Chip label={`${t('researchEval.scenes')} ${counts.scenes ?? '—'}`} />
          <Chip label={`${t('researchEval.exceptions')} ${counts.exceptions ?? 0}`} />
          <Chip label={`${t('researchEval.review')} ${snap?.expertReviewStatus || 'unreviewed'}`} />
          <Chip label={`${t('researchEval.clinical')} not_evaluated`} />
        </Stack>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>{snap?.selectionRule?.text}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField size="small" label={t('researchEval.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </Stack>
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('researchEval.colScene')}</TableCell>
              <TableCell>{t('researchEval.colBase')}</TableCell>
              <TableCell>{t('researchEval.colSplit')}</TableCell>
              <TableCell>{t('researchEval.colCategory')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(cases.records || []).map((c) => (
              <TableRow
                key={c.id}
                hover
                selected={selectedSceneId === c.id}
                onClick={() => {
                  setSelectedSceneId(c.id);
                  researchEvalApi.snapshotCase(c.id, { contentHash: cfg.contentHash || snap?.contentHash }).then((r) => setTrace({ kind: 'case', ...r.data })).catch((err) => setError(formatApiError(err)));
                }}
              >
                <TableCell>{c.id}</TableCell>
                <TableCell>{c.baseId}</TableCell>
                <TableCell>{c.split}</TableCell>
                <TableCell>{categoryLabel(c.category)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination count={Math.max(1, Math.ceil((cases.total || 0) / 10))} page={page} onChange={(_, p) => setPage(p)} sx={{ mt: 1 }} />
        {exceptions.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>{t('researchEval.exceptionNote', { n: exceptions.length })} {exceptions.slice(0, 3).map((e) => e.code).join(' · ')}</Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.config')}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{t('researchEval.configHelp')}</Typography>
        {(snap?.versions || []).length > 0 && (
          <FormControl size="small" sx={{ minWidth: 280, mt: 2 }}>
            <InputLabel>{t('researchEval.snapshot')}</InputLabel>
            <Select
              label={t('researchEval.snapshot')}
              value={cfg.contentHash || snap?.contentHash || ''}
              onChange={(e) => {
                setCfg({ ...cfg, contentHash: e.target.value });
                setSelectedSceneId('');
                setTrace(null);
              }}
            >
              {(snap.versions || [snap]).map((v) => (
                <MenuItem key={v.contentHash} value={v.contentHash}>
                  {v.datasetId} {v.version} · {(v.contentHash || '').slice(0, 12)} · {t('researchEval.snapshotBase')} {v.counts?.baseCases ?? '—'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Stack sx={{ mt: 2 }}>
          {GROUPS.map((g) => (
            <FormControlLabel
              key={g}
              control={(
                <Checkbox
                  checked={cfg.groups.includes(g)}
                  onChange={(e) => setCfg({
                    ...cfg,
                    groups: e.target.checked ? [...cfg.groups, g] : cfg.groups.filter((x) => x !== g),
                  })}
                />
              )}
              label={t(GROUP_KEYS[g])}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t('researchEval.inference')}</InputLabel>
            <Select label={t('researchEval.inference')} value={cfg.inferenceMode} onChange={(e) => setCfg({ ...cfg, inferenceMode: e.target.value })}>
              <MenuItem value="mock">{t('researchEval.mock')}</MenuItem>
              <MenuItem value="rules">{t('researchEval.rulesOnly')}</MenuItem>
              <MenuItem value="real">{t('researchEval.real')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>{t('researchEval.input')}</InputLabel>
            <Select label={t('researchEval.input')} value={cfg.inputMode} onChange={(e) => setCfg({ ...cfg, inputMode: e.target.value })}>
              <MenuItem value="structured">{t('researchEval.structured')}</MenuItem>
              <MenuItem value="end_to_end_nl">{t('researchEval.e2e')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>{t('researchEval.split')}</InputLabel>
            <Select label={t('researchEval.split')} value={cfg.split} onChange={(e) => setCfg({ ...cfg, split: e.target.value })}>
              <MenuItem value="test">{t('researchEval.splitTest')}</MenuItem>
              <MenuItem value="dev">{t('researchEval.splitDev')}</MenuItem>
              <MenuItem value="all">{t('researchEval.splitAll')}</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="number" label={t('researchEval.limit')} value={cfg.limit} onChange={(e) => setCfg({ ...cfg, limit: Number(e.target.value) })} sx={{ width: 120 }} />
          <TextField size="small" type="number" label={t('researchEval.replicates')} value={cfg.replicates} onChange={(e) => setCfg({ ...cfg, replicates: Number(e.target.value) })} sx={{ width: 100 }} />
          <TextField size="small" type="number" label={t('researchEval.budget')} value={cfg.maxBurden} onChange={(e) => setCfg({ ...cfg, maxBurden: Number(e.target.value) })} sx={{ width: 120 }} />
          <TextField size="small" type="number" label={t('researchEval.rounds')} value={cfg.maxRounds} onChange={(e) => setCfg({ ...cfg, maxRounds: Number(e.target.value) })} sx={{ width: 100 }} />
        </Stack>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={cfg.confirmLive} onChange={(e) => setCfg({ ...cfg, confirmLive: e.target.checked })} />}
          label={t('researchEval.confirmLive')}
        />
        <FormControlLabel
          control={<Switch checked={cfg.confirmFullLive} onChange={(e) => setCfg({ ...cfg, confirmFullLive: e.target.checked })} />}
          label={t('researchEval.confirmFullLive')}
        />
        <FormControlLabel
          control={<Switch checked={cfg.newRun} onChange={(e) => setCfg({ ...cfg, newRun: e.target.checked })} />}
          label={t('researchEval.newRun')}
        />
        {selectedSceneId && <Typography variant="caption" display="block">{t('researchEval.selectedCase')}: {selectedSceneId}</Typography>}
        <Typography variant="caption" display="block">
          {t('researchEval.estimate', {
            bases: cfg.limit,
            scenes: Number(cfg.limit || 0) * 3,
            groups: cfg.groups.length,
            tasks: Number(cfg.limit || 0) * 3 * cfg.groups.length * (cfg.replicates || 1),
          })}
          {home?.limits?.maxRequestsPerJob ? ` · cap ${home.limits.maxRequestsPerJob}` : ''}
        </Typography>
        {selectedJob?.estimate && (
          <Typography variant="caption" display="block">
            {t('researchEval.estimate', {
              bases: selectedJob.estimate.baseCases,
              scenes: selectedJob.estimate.scenes,
              groups: selectedJob.estimate.groups,
              tasks: selectedJob.estimate.tasks,
            })}
          </Typography>
        )}
        <Alert severity={home?.limits?.allowLive ? 'success' : 'warning'} sx={{ mt: 1 }}>
          {home?.limits?.allowLive
            ? t('researchEval.liveOpen', { n: home.limits.maxCasesLive || 8 })
            : t('researchEval.liveClosed')}
        </Alert>
        <Typography variant="caption" display="block">{t('researchEval.noKeys')}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button variant="contained" disabled={busyStart} onClick={() => start('single')}>{t('researchEval.startSingle')}</Button>
          <Button disabled={busyStart} onClick={() => start('pilot')}>{t('researchEval.startPilot')}</Button>
          <Button color="warning" disabled={busyStart} onClick={() => start('full')}>{t('researchEval.startRange')}</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.run')}</Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>{t('researchEval.runHelp')}</Typography>
        {!jobs.length && <Typography variant="body2">{t('researchEval.emptyJobs')}</Typography>}
        {(jobs || []).map((j) => (
          <Stack key={j.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={j.status} color={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'error' : 'default'} />
            <Typography variant="body2">{j.id} · {j.config?.inferenceMode} · {j.counts?.completed}/{j.tasks?.length || 0}</Typography>
            {j.error && <Typography variant="caption" color="error">{t('researchEval.jobError')}：{j.error}</Typography>}
            <Button size="small" onClick={() => openResults(j)}>{t('researchEval.view')}</Button>
            <Button size="small" onClick={() => act(researchEvalApi.cancelJob, j.id)}>{t('researchEval.cancel')}</Button>
            <Button size="small" onClick={() => act(researchEvalApi.resumeJob, j.id)}>{t('researchEval.resume')}</Button>
            <Button size="small" onClick={() => act(researchEvalApi.retryJob, j.id)}>{t('researchEval.retry')}</Button>
            <Button size="small" onClick={() => downloadExport(j.id, 'json')}>{t('researchEval.exportJson')}</Button>
            <Button size="small" onClick={() => downloadExport(j.id, 'csv')}>{t('researchEval.exportCsv')}</Button>
          </Stack>
        ))}
        {selectedJob && (
          <Alert severity="info" sx={{ mt: 1 }}>
            {selectedJob.usage?.known
              ? t('researchEval.usageKnown', { n: selectedJob.usage.totalTokens })
              : t('researchEval.usageUnknown')}
            {selectedJob.pausedReason ? ` · ${selectedJob.pausedReason}` : ''}
          </Alert>
        )}
        {selectedJob && (
          <Button size="small" sx={{ mt: 1 }} disabled={busyAdvise} onClick={() => advise('job')}>{t('researchEval.adviseJob')}</Button>
        )}
        <AdviceBox advice={selectedJob?.advisor} t={t} />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.results')}</Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>{t('researchEval.resultsHelp')}</Typography>
        {!results.length && <Typography variant="body2">{t('researchEval.emptyResults')}</Typography>}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('researchEval.colGroup')}</TableCell>
              <TableCell>{t('researchEval.colScene')}</TableCell>
              <TableCell>{t('researchEval.colRisk')}</TableCell>
              <TableCell>{t('researchEval.colAsk')}</TableCell>
              <TableCell>{t('researchEval.colStop')}</TableCell>
              <TableCell>{t('researchEval.colClinical')}</TableCell>
              <TableCell>{t('researchEval.colAdvice')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resultsJobId === selectedJob?.id && results.map((r) => (
              <TableRow key={r.key || `${r.groupId}-${r.researchCaseId}`} hover onClick={() => setTrace({ kind: 'result', row: r, advisor: r.advisor, jobId: selectedJob.id })}>
                <TableCell>{r.groupId}</TableCell>
                <TableCell>{r.researchCaseId}</TableCell>
                <TableCell>{r.filteredRisk || '—'}</TableCell>
                <TableCell>{r.asked}/{r.answered}</TableCell>
                <TableCell>{r.stopReason || r.error || '—'}</TableCell>
                <TableCell>{r.clinicalAccuracy || 'not_evaluated'}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    disabled={busyAdvise}
                    onClick={(ev) => { ev.stopPropagation(); const job = selectedJob || jobs[0]; setSelectedJob(job); setTrace({ kind: 'result', row: r, advisor: r.advisor }); advise('result', r, job); }}
                  >
                    {r.advisor ? t('researchEval.adviseRow') : t('researchEval.advicePending')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination count={Math.max(1, Math.ceil((resultsTotal || 0) / 20))} page={resultPage} onChange={(_, p) => setResultPage(p)} sx={{ mt: 1 }} />
      </Paper>

      {trace && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('researchEval.trace')}</Typography>
          <Typography variant="caption" display="block" sx={{ mb: 1 }}>{t('researchEval.traceHelp')}</Typography>
          {trace.row && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">{trace.row.groupId} · {trace.row.researchCaseId} · {trace.row.baseId}</Typography>
              <Typography variant="body2">{t('researchEval.stop')}：{trace.row.whyStopped || trace.row.stopReason || '—'} · {t('researchEval.inputMode')} {trace.row.extractTurn?.mode || 'structured'}</Typography>
              <Typography variant="body2">{t('researchEval.rawRisk')} {trace.row.rawRisk || '—'} / {t('researchEval.filteredRisk')} {trace.row.filteredRisk || '—'} / {t('researchEval.reviewBox')} {trace.row.professionalReview?.clinicalCorrectness || 'not_evaluated'}</Typography>
              {(trace.row.clarificationTurns || []).map((turn, i) => (
                <Typography key={`${turn.fieldPath}-${i}`} variant="caption" display="block">
                  {turn.round} · {turn.fieldPath} · {t('researchEval.whyAsk')}：{turn.whyAsked} · {t('researchEval.scriptAns')} {turn.factResolved ? '✓' : (turn.answeredUnknown ? 'unknown' : (turn.noScript ? 'no_script' : '—'))} · {turn.kind}
                </Typography>
              ))}
              <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('researchEval.filteredSemantic')}</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(trace.row.semanticResult || trace.row.filteredOutput, null, 2)}</pre>
              <Typography variant="subtitle2">{t('researchEval.filtered')}</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(trace.row.filteredOutput, null, 2)}</pre>
            </Box>
          )}
          <AdviceBox advice={trace.advisor || trace.row?.advisor} t={t} />
          {user?.role === 'researcher' ? (
            <Button size="small" onClick={() => {
              const id = trace.case?.id || trace.row?.researchCaseId;
              const hash = selectedJob?.datasetHash || cfg.contentHash || snap?.contentHash;
              if (id) {
                researchEvalApi.snapshotCase(id, { annotate: 1, contentHash: hash })
                  .then((r) => setTrace({ kind: 'reference', ...r.data, advisor: trace.advisor, jobId: selectedJob?.id }))
                  .catch((err) => setError(formatApiError(err)));
              }
            }}
            >
              {t('researchEval.annotate')}
            </Button>
          ) : null}
          {trace.case && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(trace.case, null, 2)}</pre>
          )}
        </Paper>
      )}
    </Box>
  );
}
