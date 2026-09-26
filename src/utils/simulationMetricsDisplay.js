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
export function resolveExperimentView(detail, replicateIndex = 0) {
  if (!detail) return { metrics: null, runLog: null, isAggregate: false };

  if (detail.metrics && typeof detail.metrics.stockoutRate === 'number') {
    return { metrics: detail.metrics, runLog: detail.runLog, isAggregate: false };
  }

  if (detail.results?.length) {
    const idx = Math.min(Math.max(0, replicateIndex), detail.results.length - 1);
    const rep = detail.results[idx];
    const aggregate = detail.summary && typeof detail.summary.stockoutRate === 'object';
    if (aggregate) {
      const flat = flattenAggregateSummary(detail.summary);
      if (rep?.metrics) {
        flat.regional = rep.metrics.regional;
        flat.equity = rep.metrics.equity;
        flat.resilience = rep.metrics.resilience;
        flat.essentialStockoutRate = flat.essentialStockoutRate ?? rep.metrics.essentialStockoutRate;
        flat.chronicStockoutRate = flat.chronicStockoutRate ?? rep.metrics.chronicStockoutRate;
        flat.serviceInequalityIndex = flat.serviceInequalityIndex ?? rep.metrics.serviceInequalityIndex;
      }
      return {
        metrics: flat,
        runLog: rep?.runLog || null,
        isAggregate: true,
        rawSummary: detail.summary,
        replicateCount: detail.results.length,
        dailyAggregate: detail.dailyAggregate,
        regionalAggregate: detail.regionalAggregate,
        groupSummary: detail.groupSummary,
      };
    }
    return { metrics: rep?.metrics, runLog: rep?.runLog, isAggregate: false, replicateCount: detail.results.length };
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
    essentialStockoutRate: metricValue(summary.essentialStockoutRate),
    chronicStockoutRate: metricValue(summary.chronicStockoutRate),
    avgAccessTimeDays: metricValue(summary.avgAccessTimeDays),
    inventoryTurnover: metricValue(summary.inventoryTurnover),
    avgDeliveryTimeDays: metricValue(summary.avgDeliveryTimeDays),
    serviceInequalityIndex: metricValue(summary.serviceInequalityIndex),
    regional: null,
    equity: null,
    resilience: null,
  };
}
