/** Coerce replicate summary stats or raw numbers for UI display. */
export function metricValue(v) {
  if (v == null) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && typeof v.mean === 'number') return v.mean;
  return null;
}

export function formatMetric(v, digits = 2) {
  const n = metricValue(v);
  if (n == null) return '—';
  return n.toFixed(digits);
}

export function formatPercent(v, digits = 2) {
  const n = metricValue(v);
  if (n == null) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/**
 * Pick metrics object for tables/charts from a saved experiment record.
 */
export function resolveExperimentView(detail) {
  if (!detail) return { metrics: null, runLog: null, isAggregate: false };

  if (detail.metrics && typeof detail.metrics.stockoutRate === 'number') {
    return { metrics: detail.metrics, runLog: detail.runLog, isAggregate: false };
  }

  if (detail.results?.length) {
    const first = detail.results[0];
    const aggregate = detail.summary && typeof detail.summary.stockoutRate === 'object';
    if (aggregate) {
      const flat = flattenAggregateSummary(detail.summary);
      if (first?.metrics) {
        flat.regional = first.metrics.regional;
        flat.equity = first.metrics.equity;
      }
      return {
        metrics: flat,
        runLog: first?.runLog || null,
        isAggregate: true,
        rawSummary: detail.summary,
      };
    }
    return { metrics: first?.metrics, runLog: first?.runLog, isAggregate: false };
  }

  if (detail.summary && typeof detail.summary.stockoutRate === 'object') {
    return {
      metrics: flattenAggregateSummary(detail.summary),
      runLog: null,
      isAggregate: true,
      rawSummary: detail.summary,
    };
  }

  return { metrics: detail.summary || null, runLog: detail.runLog, isAggregate: false };
}

function flattenAggregateSummary(summary) {
  return {
    totalCost: metricValue(summary.totalCost),
    stockoutRate: metricValue(summary.stockoutRate),
    fillRate: metricValue(summary.fillRate),
    avgAccessTimeDays: metricValue(summary.avgAccessTimeDays),
    inventoryTurnover: metricValue(summary.inventoryTurnover),
    avgDeliveryTimeDays: metricValue(summary.avgDeliveryTimeDays),
    regional: null,
    equity: null,
  };
}
