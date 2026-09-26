import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, MenuItem, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Alert,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { simulationApi } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  resolveExperimentView, formatMetric, formatPercent,
} from '../../utils/simulationMetricsDisplay';

function phaseForDay(day, events = []) {
  if (!events.length) return 'pre';
  const start = Math.min(...events.map((e) => e.startDay ?? 0));
  const end = Math.max(...events.map((e) => e.endDay ?? e.startDay ?? 0));
  if (day < start) return 'pre';
  if (day <= end) return 'during';
  return 'recovery';
}

export default function Results() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

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
  }, [selectedId]);

  const { metrics, runLog, isAggregate, rawSummary } = resolveExperimentView(detail);
  const regional = metrics?.regional;
  const events = detail?.scenario?.events || [];

  const regionalChart = regional
    ? Object.entries(regional).map(([region, v]) => ({
      region,
      fillRate: v.fillRate,
      stockoutRate: v.stockoutRate,
      avgAccessTimeDays: v.avgAccessTimeDays,
    }))
    : [];

  const timeSeries = useMemo(() => (
    runLog?.daily?.map((d) => ({
      day: d.day,
      inventory: d.totalInventory,
      stockout: d.pharmacyResults.reduce((s, r) => s + r.stockout, 0),
      fillRate: d.dailyFillRate ?? null,
      stockoutRate: d.dailyStockoutRate ?? null,
      phase: phaseForDay(d.day, events),
    })) || []
  ), [runLog, events]);

  const resilienceSeries = useMemo(() => {
    const phases = ['pre', 'during', 'recovery'];
    return phases.map((phase) => {
      const rows = timeSeries.filter((d) => d.phase === phase);
      const avg = rows.length
        ? rows.reduce((s, d) => s + (d.stockoutRate || 0), 0) / rows.length
        : 0;
      return { phase, avgStockoutRate: avg };
    });
  }, [timeSeries]);

  const compareData = experiments.slice(0, 12).map((e) => {
    const stockout = e.summary?.stockoutRate?.mean ?? e.summary?.stockoutRate;
    const cost = e.summary?.totalCost?.mean ?? e.summary?.totalCost;
    const ineq = e.summary?.serviceInequalityIndex?.mean ?? e.summary?.serviceInequalityIndex;
    return {
      id: e.policyId,
      experimentId: e.id,
      stockoutRate: stockout,
      totalCost: cost,
      inequality: ineq,
    };
  }).filter((x) => x.stockoutRate != null);

  const metricRows = metrics ? [
    [t('results.totalCost'), formatMetric(metrics.totalCost, 2), 'CNY'],
    [t('results.stockoutRate'), formatPercent(metrics.stockoutRate), t('results.proportion')],
    [t('results.essentialStockout'), formatPercent(metrics.essentialStockoutRate), t('results.proportion')],
    [t('results.chronicStockout'), formatPercent(metrics.chronicStockoutRate), t('results.proportion')],
    [t('results.fillRate'), formatPercent(metrics.fillRate), t('results.proportion')],
    [t('results.avgAccess'), formatMetric(metrics.avgAccessTimeDays), t('results.days')],
    [t('results.avgDelivery'), formatMetric(metrics.avgDeliveryTimeDays), t('results.days')],
    [t('results.turnover'), formatMetric(metrics.inventoryTurnover, 3), t('results.ratio')],
    [t('results.serviceInequality'), formatMetric(metrics.serviceInequalityIndex, 4), t('results.index')],
    [t('results.stockoutGap'), formatMetric(metrics.equity?.stockoutGap, 4), t('results.proportion')],
    [t('results.waitGap'), formatMetric(metrics.equity?.waitGap), t('results.days')],
    [t('results.gini'), formatMetric(metrics.equity?.giniCoverage, 4), '0–1'],
    [t('results.recoveryDays'), formatMetric(metrics.resilience?.daysToRecover, 0), t('results.days')],
  ] : [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('results.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('results.intro')}</Typography>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField select label={t('results.experiment')} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 320, mb: 2 }}>
        {experiments.map((e) => (
          <MenuItem key={e.id} value={e.id}>{e.id} · {e.policyId}</MenuItem>
        ))}
      </TextField>

      {detail && metrics && (
        <>
          {isAggregate && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('results.replicatesNote')}{' '}
              {formatMetric(rawSummary?.stockoutRate, 4)}
              {rawSummary?.stockoutRate?.ci95Low != null && (
                <>
                  {' '}± CI95 [{rawSummary.stockoutRate.ci95Low.toFixed(4)}, {rawSummary.stockoutRate.ci95High.toFixed(4)}]
                  {' · '}
                  σ={rawSummary.stockoutRate.std?.toFixed(4)}
                </>
              )}
            </Alert>
          )}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('results.metric')}</TableCell>
                  <TableCell>{t('results.value')}{isAggregate ? ' (mean)' : ''}</TableCell>
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

          {regionalChart.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, height: 320 }}>
            <Typography variant="subtitle2" gutterBottom>{t('results.regionalChart')}</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={regionalChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis unit="proportion" domain={[0, 1]} />
                <Tooltip formatter={(v) => Number(v).toFixed(3)} />
                <Legend />
                <Bar dataKey="fillRate" name={t('results.fillRate')} fill="#1976d2" />
                <Bar dataKey="stockoutRate" name={t('results.stockoutRate')} fill="#ed6c02" />
                <Bar dataKey="avgAccessTimeDays" name={t('results.avgAccess')} fill="#9c27b0" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
          )}

          {timeSeries.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, height: 320 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.dailyChart')}</Typography>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 1]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="stockout" name={t('results.stockoutUnits')} stroke="#d32f2f" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="fillRate" name={t('results.fillRate')} stroke="#2e7d32" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {resilienceSeries.some((x) => x.avgStockoutRate > 0) && (
            <Paper sx={{ p: 2, mb: 2, height: 280 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.resilienceChart')}</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={resilienceSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phase" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                  <Bar dataKey="avgStockoutRate" name={t('results.stockoutRate')} fill="#5c6bc0" />
                </BarChart>
              </ResponsiveContainer>
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
        <>
          <Paper sx={{ p: 2, mb: 2, height: 280 }}>
            <Typography variant="subtitle2" gutterBottom>{t('results.policyCompare')}</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="stockoutRate" name={t('results.stockoutRate')} fill="#5c6bc0" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
          {compareData.every((x) => x.totalCost != null && x.inequality != null) && (
            <Paper sx={{ p: 2, height: 300 }}>
              <Typography variant="subtitle2" gutterBottom>{t('results.costEquityTradeoff')}</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="totalCost" name={t('results.totalCost')} />
                  <YAxis dataKey="inequality" name={t('results.serviceInequality')} />
                  <ZAxis dataKey="stockoutRate" range={[80, 400]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={compareData} fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
