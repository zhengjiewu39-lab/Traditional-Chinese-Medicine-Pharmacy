function metricsToCsv(metrics, regional = true) {
  const lines = ['metric,value,unit'];
  lines.push(`totalCost,${metrics.totalCost},synthetic CNY`);
  lines.push(`stockoutRate,${metrics.stockoutRate},proportion`);
  lines.push(`fillRate,${metrics.fillRate},proportion`);
  lines.push(`avgAccessTimeDays,${metrics.avgAccessTimeDays},days`);
  lines.push(`inventoryTurnover,${metrics.inventoryTurnover},ratio`);
  lines.push(`avgDeliveryTimeDays,${metrics.avgDeliveryTimeDays},days`);
  if (regional && metrics.regional) {
    for (const [rt, r] of Object.entries(metrics.regional)) {
      lines.push(`${rt}_fillRate,${r.fillRate},proportion`);
      lines.push(`${rt}_stockoutRate,${r.stockoutRate},proportion`);
      lines.push(`${rt}_avgAccessTimeDays,${r.avgAccessTimeDays},days`);
    }
  }
  return lines.join('\n');
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

module.exports = { metricsToCsv, experimentSummaryMarkdown };
