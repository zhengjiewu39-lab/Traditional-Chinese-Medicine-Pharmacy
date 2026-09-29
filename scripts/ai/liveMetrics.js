/**
 * Metrics for live-model evaluation reports.
 * ruleModelConflictRate counts rule–model disagreements, never a constant zero.
 */

const ratio = (n, d) => (d ? n / d : null);

const CONFLICT_TYPES = new Set(['hard_rule_conflict', 'model_lower_than_rules']);

function caseHasRuleModelConflict(row) {
  return (row.disagreements || []).some((d) => CONFLICT_TYPES.has(d.type));
}

function computeLiveMetrics(results) {
  const ok = results.filter((r) => r.semanticStatus === 'ok');
  const conflicts = ok.filter(caseHasRuleModelConflict);
  return {
    ruleModelConflictRate: ratio(conflicts.length, ok.length),
    conflictCount: conflicts.length,
    modelOkCount: ok.length,
  };
}

module.exports = { CONFLICT_TYPES, caseHasRuleModelConflict, computeLiveMetrics, ratio };
