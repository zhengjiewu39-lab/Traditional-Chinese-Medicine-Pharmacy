import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, MenuItem, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Alert,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { simulationApi } from '../../services/simulationApi';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  resolveExperimentView, formatMetric, formatPercent,
} from '../../utils/simulationMetricsDisplay';

export default function Results() {
  const { t } = useLanguage();
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    simulationApi.listExperiments()
      .then((res) => {
        const list = res.data.experiments || [];
        setExperiments(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => setError(t('results.loadFailed')));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    simulationApi.getExperiment(selectedId).then((res) => setDetail(res.data)).catch(() => setDetail(null));
  }, [selectedId]);

  const { metrics, runLog, isAggregate, rawSummary } = resolveExperimentView(detail);
  const regional = metrics?.regional;
  const regionalChart = regional
    ? Object.entries(regional).map(([region, v]) => ({
      region,
      fillRate: v.fillRate,
      stockoutRate: v.stockoutRate,
      avgAccessTimeDays: v.avgAccessTimeDays,
    }))
    : [];

  const timeSeries = runLog?.daily?.map((d) => ({
    day: d.day,
    inventory: d.totalInventory,
    stockout: d.pharmacyResults.reduce((s, r) => s + r.stockout, 0),
  })) || [];

  const compareData = experiments.slice(0, 8).map((e) => ({
    id: e.policyId,
    stockoutRate: e.summary?.stockoutRate?.mean ?? e.summary?.stockoutRate ?? null,
  })).filter((x) => x.stockoutRate != null);

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
                {[
                  [t('results.totalCost'), formatMetric(metrics.totalCost, 2), 'CNY'],
                  [t('results.stockoutRate'), formatPercent(metrics.stockoutRate), t('results.proportion')],
                  [t('results.fillRate'), formatPercent(metrics.fillRate), t('results.proportion')],
                  [t('results.avgAccess'), formatMetric(metrics.avgAccessTimeDays), t('results.days')],
                  [t('results.turnover'), formatMetric(metrics.inventoryTurnover, 3), t('results.ratio')],
                  [t('results.avgDelivery'), formatMetric(metrics.avgDeliveryTimeDays), t('results.days')],
                  [t('results.stockoutGap'), formatMetric(metrics.equity?.stockoutGap, 4), t('results.proportion')],
                  [t('results.waitGap'), formatMetric(metrics.equity?.waitGap), t('results.days')],
                  [t('results.gini'), formatMetric(metrics.equity?.giniCoverage, 4), '0–1'],
                ].map(([name, val, unit]) => (
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
                  <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottom' }} />
                  <YAxis label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="stockout" name="Stockout units" stroke="#d32f2f" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="outlined" href={simulationApi.exportCsvUrl(selectedId)} target="_blank" rel="noreferrer">{t('results.exportCsv')}</Button>
            <Button variant="outlined" href={simulationApi.exportJsonUrl(selectedId)} target="_blank" rel="noreferrer">{t('results.exportJson')}</Button>
            <Button variant="outlined" href={simulationApi.reportMdUrl(selectedId)} target="_blank" rel="noreferrer">{t('results.summaryReport')}</Button>
          </Box>
        </>
      )}

      {compareData.length > 1 && (
        <Paper sx={{ p: 2, height: 280 }}>
          <Typography variant="subtitle2" gutterBottom>{t('results.policyCompare')}</Typography>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stockoutRate" name="Stockout rate" fill="#5c6bc0" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}
