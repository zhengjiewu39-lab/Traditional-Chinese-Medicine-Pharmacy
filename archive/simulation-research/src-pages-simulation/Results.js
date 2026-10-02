import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, MenuItem, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Alert, ToggleButton, ToggleButtonGroup, Chip,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { simulationApi } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  resolveExperimentView, formatMetric, formatPercent,
} from '../../utils/simulationMetricsDisplay';

function getEventEndDay(event) {
  return event.startDay + event.durationDays;
}

function phaseForDay(day, events = []) {
  if (!events.length) return 'pre';
  const start = Math.min(...events.map((e) => e.startDay ?? 0));
  const end = Math.max(...events.map((e) => getEventEndDay(e)));
  if (day < start) return 'pre';
  if (day < end) return 'during';
  return 'recovery';
}

function diffRow(d) {
  if (!d || d.meanDiff == null) return '—';
  return `${d.meanDiff.toFixed(4)} [${d.ci95Low.toFixed(4)}, ${d.ci95High.toFixed(4)}]`;
}

function ciRow(stat) {
  if (!stat || stat.mean == null) return '—';
  if (stat.ci95Low != null) {
    return `${stat.mean.toFixed(4)} [${stat.ci95Low.toFixed(4)}, ${stat.ci95High.toFixed(4)}]`;
  }
  return stat.mean.toFixed(4);
}

export default function Results() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('aggregate');
  const [replicateIndex, setReplicateIndex] = useState(0);
  const [groupPaired, setGroupPaired] = useState([]);

  useEffect(() => {
    simulationApi.listExperiments()
      .then((res) => {
        const list = res.data.experiments || [];
        setExperiments(list);
        const fromUrl = searchParams.get('experiment');
        if (fromUrl && list.some((e) => e.id === fromUrl)) setSelectedId(fromUrl);
        else if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => setError(t('results.loadFailed')));
  }, [searchParams, t]);

  useEffect(() => {
    if (!selectedId) return;
    simulationApi.getExperiment(selectedId).then((res) => setDetail(res.data)).catch(() => setDetail(null));
    setReplicateIndex(0);
    setGroupPaired([]);
  }, [selectedId]);

  useEffect(() => {
    const gid = detail?.experimentGroupId;
    const embedded = detail?.groupSummary?.pairedComparisons?.pairs;
    if (embedded?.length) {
      setGroupPaired(embedded);
      return;
    }
    if (!gid) return;
    simulationApi.getGroupAnalysis(gid)
      .then((res) => setGroupPaired(res.data.groupSummary?.pairedComparisons?.pairs || []))
      .catch(() => setGroupPaired([]));
  }, [detail]);

  const useAggregate = viewMode === 'aggregate';
  const view = resolveExperimentView(detail, replicateIndex);
  const { metrics, runLog, isAggregate, rawSummary } = view;
  const singleRunLog = useMemo(() => {
    if (!detail?.results?.length || useAggregate) return runLog;
    return detail.results[replicateIndex]?.runLog || runLog;
  }, [detail, replicateIndex, runLog, useAggregate]);

  const singleMetrics = useMemo(() => {
    if (!detail?.results?.length || useAggregate) return metrics;
    return detail.results[replicateIndex]?.metrics || metrics;
  }, [detail, replicateIndex, metrics, useAggregate]);

  const displayMetrics = useAggregate ? metrics : singleMetrics;
  const regional = displayMetrics?.regional;

  const regionalChart = regional
    ? Object.entries(regional).map(([region, v]) => ({
      region,
      fillRate: v.fillRate,
      stockoutRate: v.stockoutRate,
    }))
    : [];

  const regionalDelayChart = regional
    ? Object.entries(regional).map(([region, v]) => ({
      region,
      avgSyntheticAccessDelayDays: v.avgSyntheticAccessDelayDays ?? v.avgAccessTimeDays ?? 0,
    }))
    : [];

  const timeSeries = useMemo(() => {
    const events = detail?.scenario?.events || [];
    if (useAggregate && detail?.dailyAggregate?.length) {
      return detail.dailyAggregate.map((d) => ({
        day: d.day,
        stockoutRate: d.dailyStockoutRate?.mean,
        stockoutRateLow: d.dailyStockoutRate?.ci95Low,
        stockoutRateHigh: d.dailyStockoutRate?.ci95High,
        fillRate: d.dailyFillRate?.mean,
        phase: phaseForDay(d.day, events),
        label: t('results.meanAcrossReplicates', { n: detail.replicates }),
      }));
    }
    return (singleRunLog?.daily?.map((d) => ({
      day: d.day,
      stockout: d.pharmacyResults.reduce((s, r) => s + r.stockout, 0),
      fillRate: d.dailyFillRate ?? null,
      stockoutRate: d.dailyStockoutRate ?? null,
      phase: phaseForDay(d.day, events),
    })) || []);
  }, [useAggregate, detail, singleRunLog, t]);

  const groupId = detail?.experimentGroupId;
  const pool = groupId
    ? experiments.filter((e) => e.experimentGroupId === groupId)
    : experiments.filter((e) => e.scenarioHash && e.scenarioHash === detail?.scenarioHash);
  const compareData = (pool.length > 1 ? pool : []).map((e) => ({
    id: e.policyId,
    stockoutRate: e.summary?.stockoutRate?.mean ?? e.summary?.stockoutRate,
    totalCost: e.summary?.totalCost?.mean ?? e.summary?.totalCost,
    inequality: e.summary?.serviceInequalityIndex?.mean ?? e.summary?.serviceInequalityIndex,
  })).filter((x) => x.stockoutRate != null);

  const metricRows = displayMetrics ? [
    [t('results.totalCost'), formatMetric(displayMetrics.totalCost, 2), 'CNY'],
    [t('results.stockoutRate'), formatPercent(displayMetrics.stockoutRate), t('results.proportion')],
    [t('results.essentialStockout'), formatPercent(displayMetrics.essentialStockoutRate), t('results.proportion')],
    [t('results.fillRate'), formatPercent(displayMetrics.fillRate), t('results.proportion')],
    [t('results.avgAccess'), formatMetric(displayMetrics.avgSyntheticAccessDelayDays ?? displayMetrics.avgAccessTimeDays), t('results.days')],
    [t('results.serviceInequality'), formatMetric(displayMetrics.serviceInequalityIndex, 4), t('results.index')],
  ] : [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('results.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('results.intro')}</Typography>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField select label={t('results.experiment')} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 320, mb: 2, mr: 2 }}>
        {experiments.map((e) => (
          <MenuItem key={e.id} value={e.id}>{e.id} · {e.policyId}</MenuItem>
        ))}
      </TextField>

      {detail && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">{t('results.metaClassification')}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {detail.scenarioHash && <Chip size="small" label={`${t('results.scenarioHash')}: ${detail.scenarioHash.slice(0, 12)}…`} />}
            {detail.experimentGroupId && <Chip size="small" label={`${t('results.experimentGroup')}: ${detail.experimentGroupId}`} />}
            <Chip size="small" label={`${t('results.replicates')}: ${detail.replicates ?? 1}`} />
            <Chip size="small" label={`${t('results.engine')}: ${detail.engineVersion}`} />
            {detail.packageLockHash && <Chip size="small" label={`lock: ${detail.packageLockHash.slice(0, 12)}…`} />}
          </Box>
        </Paper>
      )}

      {detail?.results?.length > 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup exclusive value={viewMode} onChange={(_, v) => v && setViewMode(v)} size="small">
            <ToggleButton value="aggregate">{t('results.viewAggregate')}</ToggleButton>
            <ToggleButton value="single">{t('results.viewSingleReplicate')}</ToggleButton>
          </ToggleButtonGroup>
          {!useAggregate && (
            <TextField
              select
              size="small"
              label={t('results.replicateIndex')}
              value={replicateIndex}
              onChange={(e) => setReplicateIndex(Number(e.target.value))}
              sx={{ minWidth: 160 }}
            >
              {detail.results.map((r, i) => (
                <MenuItem key={i} value={i}>{t('results.replicateN', { n: i + 1, seed: r.seed })}</MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      )}

      {detail && displayMetrics && (
        <>
          {useAggregate && isAggregate && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('results.replicatesNote')}{' '}
              {formatMetric(rawSummary?.stockoutRate, 4)}
              {rawSummary?.stockoutRate?.ci95Low != null && (
                <> ± CI95 [{rawSummary.stockoutRate.ci95Low.toFixed(4)}, {rawSummary.stockoutRate.ci95High.toFixed(4)}]</>
              )}
            </Alert>
          )}

          <Paper sx={{ p: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('results.metric')}</TableCell>
                  <TableCell>{t('results.value')}{useAggregate && isAggregate ? ' (mean)' : ''}</TableCell>
                  <TableCell>{t('results.unit')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metricRows.map(([name, val, unit]) => (
                  <TableRow key={name}><TableCell>{name}</TableCell><TableCell>{val}</TableCell><TableCell>{unit}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {useAggregate && detail.regionalAggregate && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.regionalCiTable')}</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('results.region')}</TableCell>
                    <TableCell>{t('results.stockoutRate')} (mean [CI95])</TableCell>
                    <TableCell>{t('results.fillRate')} (mean [CI95])</TableCell>
                    <TableCell>{t('results.avgAccess')} (mean [CI95])</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(detail.regionalAggregate).map(([rt, st]) => (
                    <TableRow key={rt}>
                      <TableCell>{rt}</TableCell>
                      <TableCell>{ciRow(st.stockoutRate)}</TableCell>
                      <TableCell>{ciRow(st.fillRate)}</TableCell>
                      <TableCell>{ciRow(st.avgSyntheticAccessDelayDays)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {regionalChart.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, height: 300 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.regionalStockoutChart')}</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={regionalChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                  <Legend />
                  <Bar dataKey="fillRate" name={t('results.fillRate')} fill="#1976d2" />
                  <Bar dataKey="stockoutRate" name={t('results.stockoutRate')} fill="#ed6c02" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {regionalDelayChart.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, height: 280 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.regionalDelayChart')}</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={regionalDelayChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" />
                  <YAxis label={{ value: t('results.days'), angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="avgSyntheticAccessDelayDays" name={t('results.syntheticAccessDelay')} fill="#9c27b0" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {timeSeries.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, height: 320 }}>
              <Typography variant="subtitle2" gutterBottom>
                {useAggregate ? t('results.dailyAggregateChart') : t('results.dailyChart')}
              </Typography>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="stockoutRate" name={t('results.stockoutRate')} stroke="#d32f2f" dot={false} />
                  <Line type="monotone" dataKey="fillRate" name={t('results.fillRate')} stroke="#2e7d32" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {groupPaired.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.pairedCi')}</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('results.policyA')}</TableCell>
                    <TableCell>{t('results.policyB')}</TableCell>
                    <TableCell>{t('results.worstRegionDiff')}</TableCell>
                    <TableCell>{t('results.unmetDiff')}</TableCell>
                    <TableCell>{t('results.costDiff')}</TableCell>
                    <TableCell>{t('results.pairedN')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupPaired.map((p) => (
                    <TableRow key={`${p.policyA}-${p.policyB}`}>
                      <TableCell>{p.policyA}</TableCell>
                      <TableCell>{p.policyB}</TableCell>
                      <TableCell>{diffRow(p.metrics?.worstRegionEssentialFillRate)}</TableCell>
                      <TableCell>{diffRow(p.metrics?.cumulativeUnmetDemand)}</TableCell>
                      <TableCell>{diffRow(p.metrics?.totalCost)}</TableCell>
                      <TableCell>{p.pairedReplicates}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => simulationApi.downloadExperimentFile(selectedId, 'csv')}>{t('results.exportCsv')}</Button>
            <Button variant="outlined" onClick={() => simulationApi.downloadExperimentFile(selectedId, 'json')}>{t('results.exportJson')}</Button>
            <Button variant="outlined" onClick={() => simulationApi.downloadExperimentFile(selectedId, 'md')}>{t('results.summaryReport')}</Button>
          </Box>
        </>
      )}

      {compareData.length > 1 && (
        <Paper sx={{ p: 2, mb: 2, height: 280 }}>
          <Typography variant="subtitle2" gutterBottom>{t('results.policyCompare')} ({t('results.sameGroupOnly')})</Typography>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="stockoutRate" name={t('results.stockoutRate')} fill="#5c6bc0" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}
