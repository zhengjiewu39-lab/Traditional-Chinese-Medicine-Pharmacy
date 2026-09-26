function scalarMetric(v) {
  if (v == null) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.mean === 'number') return v.mean;
  return v;
}

function metricsToCsv(metrics, regional = true) {
  const lines = ['metric,value,unit'];
  const row = (name, v, unit) => lines.push(`${name},${scalarMetric(v)},${unit}`);
  row('totalCost', metrics.totalCost, 'synthetic CNY');
  row('stockoutRate', metrics.stockoutRate, 'proportion');
  row('fillRate', metrics.fillRate, 'proportion');
  row('essentialStockoutRate', metrics.essentialStockoutRate, 'proportion');
  row('chronicStockoutRate', metrics.chronicStockoutRate, 'proportion');
  row('orderFillRate', metrics.orderFillRate ?? metrics.fillRate, 'proportion');
  row('avgAccessTimeDays', metrics.avgAccessTimeDays, 'days');
  row('inventoryTurnover', metrics.inventoryTurnover, 'ratio');
  row('avgDeliveryTimeDays', metrics.avgDeliveryTimeDays, 'days');
  row('serviceInequalityIndex', metrics.serviceInequalityIndex, 'index');
  if (metrics.resilience) {
    row('resilience_daysToRecover', metrics.resilience.daysToRecover, 'days');
    row('resilience_disruptionPeakStockoutRate', metrics.resilience.disruptionPeakStockoutRate, 'proportion');
  }
  if (regional && metrics.regional) {
    for (const [rt, r] of Object.entries(metrics.regional)) {
      row(`${rt}_fillRate`, r.fillRate, 'proportion');
      row(`${rt}_stockoutRate`, r.stockoutRate, 'proportion');
      row(`${rt}_serviceCoverage`, r.serviceCoverage ?? r.fillRate, 'proportion');
      row(`${rt}_avgAccessTimeDays`, r.avgAccessTimeDays, 'days');
    }
  }
  if (metrics.equity) {
    row('equity_stockoutGap', metrics.equity.stockoutGap, 'proportion');
    row('equity_waitGap', metrics.equity.waitGap, 'days');
    row('equity_giniCoverage', metrics.equity.giniCoverage, '0-1');
  }
  return lines.join('\n');
}

/** Flatten saved experiment record for CSV / summary tables. */
function pickExportMetrics(exp) {
  if (!exp) return null;
  if (exp.metrics && typeof exp.metrics.stockoutRate === 'number') return exp.metrics;
  const firstMetrics = exp.results?.[0]?.metrics;
  if (exp.summary) {
    const pick = (k) => scalarMetric(exp.summary[k]);
    return {
      totalCost: pick('totalCost'),
      stockoutRate: pick('stockoutRate'),
      fillRate: pick('fillRate'),
      essentialStockoutRate: pick('essentialStockoutRate'),
      chronicStockoutRate: pick('chronicStockoutRate'),
      avgAccessTimeDays: pick('avgAccessTimeDays'),
      inventoryTurnover: pick('inventoryTurnover'),
      avgDeliveryTimeDays: pick('avgDeliveryTimeDays'),
      serviceInequalityIndex: pick('serviceInequalityIndex'),
      orderFillRate: pick('fillRate'),
      regional: firstMetrics?.regional,
      equity: firstMetrics?.equity,
      resilience: firstMetrics?.resilience,
    };
  }
  return exp.summary || null;
}

function experimentSummaryMarkdown(exp) {
  return [
    '# Simulation experiment summary (synthetic data)',
    '',
    `Experiment ID: ${exp.id}`,
    `Scenario: ${exp.scenarioId}`,
    `Policy: ${exp.policyId} (${exp.policyVersion || 'n/a'})`,
    `Engine: ${exp.engineVersion}`,
    `Random seed: ${exp.randomSeed}`,
    `Replicate seeds: ${(exp.replicateSeeds || [exp.randomSeed]).join(', ')}`,
    `Git commit: ${exp.gitCommitHash || 'unknown'}`,
    `Scenario schema: ${exp.scenarioVersion || 'n/a'}`,
    `Replicates: ${exp.replicates || 1}`,
    '',
    '## Disclaimer',
    'This report describes simulated outcomes only. Not for clinical or dispensing decisions.',
    '',
    '## Summary metrics',
    '```json',
    JSON.stringify(exp.summary, null, 2),
    '```',
  ].join('\n');
}

module.exports = { metricsToCsv, experimentSummaryMarkdown, pickExportMetrics, scalarMetric };
