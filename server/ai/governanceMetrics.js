const repo = require('../workflow/workflowRepository');
const audit = require('../audit/auditRepository');
const runtime = require('./aiRuntime');
const { listPrompts } = require('./promptRegistry');
const { ruleSetVersion } = require('./ruleTrack');
const { knowledgeBaseVersion } = require('../knowledge/sourceRegistry');
const { integrityReport } = require('../knowledge/knowledgeRepository');
const suggestionService = require('../workflow/suggestionService');

const rate = (num, den) => (den ? num / den : null);

function computeGovernanceMetrics() {
  const cases = repo.listCases();
  const analyses = cases.flatMap((c) => c.analyses.map((a) => a.output));
  const attempted = analyses.filter((a) => !['disabled', 'disabled_by_kill_switch', 'skipped_injection', 'skipped_input_too_long'].includes(a.semanticTrackResult.status));
  const ok = attempted.filter((a) => a.semanticTrackResult.status === 'ok');
  const statusCounts = {};
  for (const a of analyses) statusCounts[a.semanticTrackResult.status] = (statusCounts[a.semanticTrackResult.status] || 0) + 1;
  const decisions = cases.flatMap((c) => c.decisions);
  const overrides = decisions.filter((d) => d.action === 'override_ai_alert');
  const overrideReasons = {};
  for (const d of overrides) overrideReasons[d.overrideReason] = (overrideReasons[d.overrideReason] || 0) + 1;
  const flagged = analyses.flatMap((a) => [...a.hardStops, ...a.alerts]);
  const conflicts = ok.filter((a) => a.disagreements.some((d) => ['hard_rule_conflict', 'model_lower_than_rules'].includes(d.type)));
  const latencies = attempted.map((a) => a.semanticTrackResult.latencyMs).filter((x) => typeof x === 'number');
  const rt = runtime.describeRuntime();
  const chain = audit.verify();
  const suggestionMetrics = suggestionService.metrics();
  const samples = repo.learning().samples();
  const pharmacistAdded = cases.flatMap((c) => c.decisions.filter((d) => d.action === 'request_information' || (d.comment || '').includes('AI未提示')));
  const lowRiskSigned = cases.filter((c) => c.analyses.at(-1)?.output?.riskTier === 'A1' && c.approval?.valid);
  return {
    generatedAt: new Date().toISOString(),
    runtime: rt,
    label: rt.isMock ? '当前为模拟模型（mock），输出不是真实AI结果' : (rt.aiMode === 'shadow' ? '影子模式：真实模型结果已保存，不驱动临床界面' : null),
    citationCompletenessThreshold: 1,
    versions: {
      model: rt.model,
      provider: rt.provider,
      aiMode: rt.aiMode,
      dataMode: rt.dataMode,
      prompts: listPrompts(),
      ruleSetVersion: ruleSetVersion(),
      knowledgeBaseVersion: knowledgeBaseVersion(),
    },
    knowledgeIntegrity: integrityReport(),
    counts: {
      cases: cases.length,
      analyses: analyses.length,
      modelAttempts: attempted.length,
      decisions: decisions.length,
      highRiskCases: cases.filter((c) => c.analyses.at(-1)?.output.riskTier === 'A3').length,
      lowRiskSignedStillRequiringPharmacist: lowRiskSigned.length,
      lowRiskSamples: samples.length,
    },
    semanticStatusCounts: statusCounts,
    rates: {
      modelSuccessRate: rate(ok.length, attempted.length),
      schemaFailureRate: rate(attempted.filter((a) => a.semanticTrackResult.status === 'schema_invalid').length, attempted.length),
      abstainRate: rate(analyses.filter((a) => a.abstain).length, analyses.length),
      ruleModelConflictRate: rate(conflicts.length, ok.length),
      overrideRate: rate(overrides.length, decisions.length),
      citationCompleteness: rate(flagged.filter((f) => f.evidenceIds?.length).length, flagged.length),
      citationCompletenessMeetsProductionGate: (rate(flagged.filter((f) => f.evidenceIds?.length).length, flagged.length) || 0) >= 1,
      pharmacistAddedRisksNotInAi: pharmacistAdded.length,
    },
    suggestions: suggestionMetrics,
    overrideReasons,
    averageLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    auditChain: chain,
  };
}

module.exports = { computeGovernanceMetrics };
