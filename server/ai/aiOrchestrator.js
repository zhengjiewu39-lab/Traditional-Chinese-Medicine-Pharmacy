/**
 * Three-track orchestration: deterministic rules → approved-evidence retrieval → constrained LLM.
 * Final tier = max(rule tier, min(model tier, A2)): the model can escalate to pharmacist review
 * but can neither lower a rule tier nor create a hard stop on its own.
 *
 * The orchestrator returns an analysis object. It has no access to workflow state, inventory or
 * dispensing records; the workflow service decides what to do with the result.
 */
const { runRuleTrack, TIER_ORDER, maxTier } = require('./ruleTrack');
const { retrieve } = require('../knowledge/evidenceRetriever');
const { knowledgeBaseVersion } = require('../knowledge/sourceRegistry');
const { buildScreeningMessages, getPrompt } = require('./promptRegistry');
const { SEMANTIC_OUTPUT_SCHEMA, UNIFIED_OUTPUT_SCHEMA, describeSemanticSchema } = require('./outputSchema');
const { check } = require('../common/schema');
const { screenInput, screenOutput } = require('./safetyPolicy');
const { detectDisagreements } = require('./disagreementDetector');
const { minimiseCaseForModel } = require('./redaction');
const { randomId } = require('../common/hash');
const { getAiMode, displaySource } = require('./aiMode');

const AI_LABEL = 'AI生成，需药师审核';

async function callWithTimeout(provider, args, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await provider.complete({ ...args, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runSemanticTrack({ provider, caseRecord, ruleTrack, retrieval, timeoutMs, inputScreen }) {
  const base = {
    provider: provider?.id || 'disabled',
    isMock: Boolean(provider?.isMock),
    modelVersion: provider?.modelVersion || 'none',
    latencyMs: 0,
    output: null,
    violations: [],
    rejectedWarnings: [],
  };
  if (!provider) return { ...base, status: 'disabled' };
  if (inputScreen.injectionSuspected) return { ...base, status: 'skipped_injection' };
  if (inputScreen.tooLong) return { ...base, status: 'skipped_input_too_long' };

  const ruleSummary = {
    tier: ruleTrack.tier,
    hits: retrieval.hits.map((h) => ({ code: h.code, tier: h.tier, message: h.message, herbs: h.herbs, evidenceIds: h.evidenceIds })),
    missingInformation: ruleTrack.missingInformation,
  };
  const minimisedCase = minimiseCaseForModel(caseRecord);
  const { messages } = buildScreeningMessages({
    minimisedCase, ruleSummary, evidence: retrieval.retrieved, schemaDescription: describeSemanticSchema(),
  });
  const started = process.hrtime.bigint();
  let raw;
  try {
    raw = await callWithTimeout(provider, { messages, context: { ruleSummary, evidence: retrieval.retrieved, minimisedCase }, jsonSchema: SEMANTIC_OUTPUT_SCHEMA }, timeoutMs);
  } catch (err) {
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    const status = err.code === 'circuit_open' ? 'circuit_open' : err.name === 'AbortError' ? 'timeout' : 'error';
    return { ...base, latencyMs, status, error: status, providerMeta: provider.lastMeta || null };
  }
  const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...base, latencyMs, status: 'schema_invalid', schemaErrors: [{ path: '$', code: 'json', message: 'not valid JSON' }] };
  }
  const { valid, errors } = check(SEMANTIC_OUTPUT_SCHEMA, parsed);
  if (!valid) return { ...base, latencyMs, status: 'schema_invalid', schemaErrors: errors.slice(0, 20) };
  const screened = screenOutput(parsed, {
    canonicalHerbs: caseRecord.prescription?.herbs || [],
    allowedEvidenceIds: new Set(retrieval.retrieved.map((e) => e.sourceId)),
  });
  return {
    ...base,
    latencyMs,
    status: screened.violations.length ? 'policy_violation' : 'ok',
    output: { ...parsed, warnings: screened.acceptedWarnings },
    violations: screened.violations,
    rejectedWarnings: screened.rejectedWarnings,
    providerMeta: provider.lastMeta || null,
    providerRequestId: provider.lastMeta?.requestId || null,
  };
}

function fallbackPharmacistExplanation(ruleTrack, retrieval, reasonText) {
  const lines = retrieval.hits.map((h) => `- [${h.tier}] ${h.message}${h.evidenceIds.length ? `（依据：${h.evidenceIds.join('、')}）` : '（无可引用证据）'}`);
  return [`规则引擎摘要（${reasonText}）：规则轨等级 ${ruleTrack.tier}，命中 ${retrieval.hits.length} 项。`, ...lines].join('\n');
}

const FALLBACK_PATIENT_TEXT = '药师正在核对您的处方信息，如需补充信息会与您联系。具体用法请以药师说明为准。';

/**
 * @param {object} caseRecord normalised case (patient, prescriber, prescription, source, caseId)
 * @param {{provider?: object|null, aiEnabled?: boolean, timeoutMs?: number, now?: Date}} options
 */
async function analyzeCase(caseRecord, {
  provider = null, aiEnabled = true, timeoutMs = 8000, now = new Date(), aiMode,
} = {}) {
  const mode = aiMode || getAiMode();
  const ruleTrack = runRuleTrack(caseRecord, { now });
  const herbNames = (caseRecord.prescription?.herbs || []).map((h) => h.name);
  const retrieval = retrieve({ ruleHits: ruleTrack.hits, herbNames });
  const inputScreen = screenInput(caseRecord);
  const modelWanted = aiEnabled && (mode === 'shadow' || mode === 'live') && provider;
  const activeProvider = modelWanted ? provider : null;
  const semantic = await runSemanticTrack({
    provider: activeProvider, caseRecord, ruleTrack, retrieval, timeoutMs, inputScreen,
  });
  if (!aiEnabled && provider) semantic.status = 'disabled_by_kill_switch';

  const showModel = mode === 'live' && semantic.status === 'ok' && (semantic.isMock ? process.env.NODE_ENV !== 'production' : true);

  const abstainReasons = [];
  const statusReason = {
    disabled: 'model_unavailable',
    disabled_by_kill_switch: 'ai_disabled_by_kill_switch',
    timeout: 'model_timeout',
    error: 'model_error',
    schema_invalid: 'schema_invalid',
    skipped_injection: 'prompt_injection_suspected',
    skipped_input_too_long: 'input_too_long',
  }[semantic.status];
  if (statusReason) abstainReasons.push(statusReason);
  if (inputScreen.injectionSuspected && !abstainReasons.includes('prompt_injection_suspected')) abstainReasons.push('prompt_injection_suspected');
  for (const v of semantic.violations) {
    const r = v.code === 'citation_not_found' ? 'citation_not_found' : v.code.startsWith('autonomous_') ? 'autonomous_clinical_output' : 'prescription_modification_attempt';
    if (!abstainReasons.includes(r)) abstainReasons.push(r);
  }
  if (ruleTrack.missingInformation.some((m) => m.critical)) abstainReasons.push('key_information_missing');
  if (retrieval.missingEvidenceFor.length) abstainReasons.push('no_evidence');

  const semanticOk = showModel;
  const disagreements = semanticOk ? detectDisagreements({ ruleTrack, semantic: semantic.output, canonicalHerbs: caseRecord.prescription?.herbs || [] }) : [];
  if (disagreements.some((d) => d.type === 'hard_rule_conflict')) abstainReasons.push('hard_rule_model_conflict');

  let riskTier = ruleTrack.tier;
  if (semanticOk) riskTier = maxTier(riskTier, TIER_ORDER[semantic.output.suggestedRiskTier] >= TIER_ORDER.A2 ? 'A2' : 'A1');
  if (inputScreen.injectionSuspected) riskTier = maxTier(riskTier, 'A2');
  if (abstainReasons.length) riskTier = maxTier(riskTier, 'A2');

  const hardStops = retrieval.hits.filter((h) => h.tier === 'A3').map((h) => ({
    code: h.code, message: h.message, ruleId: h.ruleId, evidenceIds: h.evidenceIds, resolution: h.resolution, attestationKey: h.attestationKey,
  }));
  const alerts = [
    ...retrieval.hits.filter((h) => h.tier !== 'A3').map((h) => ({
      code: h.code, message: h.message, ruleId: h.ruleId, tier: h.tier, evidenceIds: h.evidenceIds, source: 'rule', attested: Boolean(h.attested),
    })),
    ...(semanticOk ? semantic.output.warnings.filter((w) => !ruleTrack.hits.some((h) => h.code === w.code)).map((w) => ({
      code: w.code, message: w.message, ruleId: null, tier: 'A2', evidenceIds: w.evidenceIds, source: 'ai',
    })) : []),
  ];
  if (inputScreen.injectionSuspected) {
    alerts.push({ code: 'INJECTION_SUSPECTED', message: '处方或患者自由文本中疑似包含指令注入，已跳过语言模型，仅保留规则结果', ruleId: 'INJECTION_SUSPECTED', tier: 'A2', evidenceIds: [], source: 'rule' });
  }

  const missingInformation = [
    ...ruleTrack.missingInformation,
    ...(semanticOk ? semantic.output.missingInformation
      .filter((m) => !ruleTrack.missingInformation.some((r) => r.field === m.field))
      .map((m) => ({ field: m.field, message: m.description, critical: false, source: 'ai' })) : []),
  ];

  let recommendation = 'pass_to_pharmacist';
  if (hardStops.length) recommendation = 'hard_stop';
  else if (ruleTrack.missingInformation.some((m) => m.critical)) recommendation = 'clarification_required';
  else if (retrieval.hits.some((h) => h.verifyWithPrescriber)) recommendation = 'refer_to_prescriber';

  const nextVerificationSteps = retrieval.hits.filter((h) => h.counterfactual).map((h) => ({ code: h.code, tier: h.tier, text: h.counterfactual }));
  for (const m of ruleTrack.missingInformation.filter((x) => x.critical)) {
    nextVerificationSteps.push({ code: 'MISSING_INFORMATION', tier: 'A2', text: `补充「${m.message}」后可重新评估` });
  }
  if (abstainReasons.length) {
    nextVerificationSteps.push({ code: 'ABSTAIN', tier: riskTier, text: `AI未给出结论（${abstainReasons.join('、')}），需药师独立审核${hardStops.length ? '并处理阻断项' : ''}` });
  }

  const reasonText = semanticOk ? '' : { disabled: 'AI未启用，仅规则', disabled_by_kill_switch: 'AI总开关已关闭，仅规则', timeout: '模型超时，已回退规则', error: '模型不可用，已回退规则', schema_invalid: '模型输出不合规，已回退规则', skipped_injection: '疑似注入，已跳过模型', skipped_input_too_long: '输入过长，已跳过模型', policy_violation: '模型输出违反安全策略，已丢弃', circuit_open: '模型熔断，已回退规则' }[semantic.status];

  const prompt = getPrompt('rx-screening');
  const result = {
    analysisId: randomId('ana'),
    caseId: caseRecord.caseId,
    label: AI_LABEL,
    riskTier,
    recommendation,
    hardStops,
    alerts,
    missingInformation,
    nextVerificationSteps,
    counterfactuals: nextVerificationSteps,
    substitutionCandidates: [],
    ruleTrackResult: ruleTrack,
    retrievalTrackResult: {
      knowledgeBaseVersion: knowledgeBaseVersion(),
      retrieved: retrieval.retrieved.map(({ sourceId, title, version, authority, hash }) => ({ sourceId, title, version, authority, hash })),
      missingEvidenceFor: retrieval.missingEvidenceFor,
      evidenceStrength: retrieval.evidenceStrength,
    },
    semanticTrackResult: {
      status: semantic.status,
      provider: semantic.provider,
      isMock: semantic.isMock,
      modelVersion: semantic.modelVersion,
      latencyMs: Math.round(semantic.latencyMs * 100) / 100,
      violations: semantic.violations,
      rejectedWarnings: semantic.rejectedWarnings,
      schemaErrors: semantic.schemaErrors || [],
      ambiguities: semanticOk ? semantic.output.ambiguities : [],
      suggestedRiskTier: semanticOk ? semantic.output.suggestedRiskTier : null,
      suggestedActions: semanticOk ? semantic.output.suggestedActions || [] : [],
      ruleHitSummary: semanticOk ? semantic.output.ruleHitSummary : null,
      evidenceStrength: semanticOk ? semantic.output.evidenceStrength : null,
      providerRequestId: semantic.providerRequestId || null,
    },
    inputScreen,
    disagreements,
    abstain: abstainReasons.length > 0,
    abstainReasons,
    evidenceStrength: retrieval.evidenceStrength,
    pharmacistExplanation: semanticOk ? semantic.output.pharmacistExplanation : fallbackPharmacistExplanation(ruleTrack, retrieval, reasonText),
    patientExplanation: semanticOk ? semantic.output.patientExplanation : FALLBACK_PATIENT_TEXT,
    explanationSource: semanticOk ? (semantic.isMock ? 'mock_model' : 'live_model') : 'rules_template',
    displaySource: displaySource({
      semanticOk, isMock: semantic.isMock, degraded: ['timeout', 'error', 'circuit_open'].includes(semantic.status), mode,
    }),
    aiMode: mode,
    shadowResult: mode === 'shadow' && semantic.status === 'ok' ? {
      suggestedRiskTier: semantic.output.suggestedRiskTier,
      warningCodes: (semantic.output.warnings || []).map((w) => w.code),
      latencyMs: semantic.latencyMs,
      modelVersion: semantic.modelVersion,
      providerRequestId: semantic.providerRequestId || null,
    } : null,
    providerMeta: semantic.providerMeta || null,
    modelVersion: semantic.modelVersion,
    promptVersion: prompt.ref,
    ruleSetVersion: ruleTrack.version,
    knowledgeBaseVersion: knowledgeBaseVersion(),
    generatedAt: now.toISOString(),
  };
  const unified = check(UNIFIED_OUTPUT_SCHEMA, result);
  if (!unified.valid) throw new Error(`unified output failed schema: ${JSON.stringify(unified.errors.slice(0, 3))}`);
  return result;
}

module.exports = { analyzeCase, AI_LABEL };
