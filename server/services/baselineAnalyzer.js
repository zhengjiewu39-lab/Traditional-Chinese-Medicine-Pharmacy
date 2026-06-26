/** Baseline: naive pass-through (always approves) — lower bound for evaluation */

function analyzePrescription(input) {
  const text = input.prescription || '';
  const hasContent = text.trim().length > 0 || (input.herbs?.length > 0);
  return {
    score: hasContent ? 100 : 0,
    status: hasContent ? '已通过' : '需修改',
    label: hasContent ? 'approved' : 'needs_revision',
    warnings: hasContent ? [] : [{ level: 'error', message: 'empty prescription' }],
    suggestions: [],
    herbs: input.herbs || [],
    summary: hasContent ? 'Baseline: no checks applied' : 'Empty prescription',
    engine: 'baseline-naive',
  };
}

module.exports = { analyzePrescription };
