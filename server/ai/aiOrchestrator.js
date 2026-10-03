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
const { searchGaps, mergeRetrieval } = require('../knowledge/gapSearch');
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
    allowedEvidenceIds: new Set(
      retrieval.retrieved
        .filter((e) => e.clinicalUse !== false && e.sourceType !== 'pubmed_draft')
        .map((e) => e.sourceId),
    ),
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

const DECOCT_HINTS = {
  附子: '先煎', 乌头: '先煎', 麻黄: '后下或另包核对', 薄荷: '后下', 砂仁: '后下',
  钩藤: '后下', 大黄: '后下或另包', 车前子: '包煎', 旋覆花: '包煎',
};

function attachDeskMeta(notes, source) {
  return {
    screening: notes.screening,
    dispensing: notes.dispensing,
    admin: notes.admin,
    source,
    reviewStatus: source === 'live_model' ? 'unreviewed_model' : 'deterministic_fallback',
    cannotExecute: true,
  };
}

function fallbackDeskNotes(caseRecord, ruleTrack, retrieval) {
  const herbs = caseRecord.prescription?.herbs || [];
  const doses = Number(caseRecord.prescription?.doseCount) || null;
  const lines = herbs.map((h) => {
    const unit = h.unit || 'g';
    const tip = DECOCT_HINTS[h.name] || '煎煮方法待核实';
    const total = doses && h.dosage != null ? `${Number(h.dosage) * doses}${unit}/${doses}剂` : `${h.dosage ?? '?'}${unit}/剂`;
    return `${h.name} ${h.dosage ?? '?'}${unit}（合计 ${total}，${tip}）`;
  });
  const unknown = (ruleTrack.unknownHerbs || []).join('、');
  return attachDeskMeta({
    screening: lines.length ? `逐味：${lines.join('；')}。规则轨 ${ruleTrack.tier}。非正式药典，不能批准。` : '处方无药味，需医师补全。',
    dispensing: lines.length
      ? `调剂员按已审定处方称量，不得改味改量。${lines.join('；')}。缺味或称量超差不得放行，交药师复核。`
      : '无药味可配。',
    admin: unknown
      ? `规则库未覆盖：${unknown}。可终审后检索题录，不能当药典，也不能开关模型或升 live。`
      : (retrieval.externalSearch?.used ? '有库外检索草稿待终审，不是药典，不能解除证据不足，也不能批准发药。' : '无新的管理待办。补货与知识条目须管理员确认后才生效。'),
  }, 'rules_fallback');
}

function allowedCapabilities({ aiEnabled, mode, provider, searchExternal }) {
  const master = aiEnabled !== false;
  const model = master && (mode === 'shadow' || mode === 'live') && Boolean(provider);
  const autoSearch = master && model && searchExternal !== false && Boolean(provider) && !provider.isMock;
  return { master, model, autoSearch };
}

/**
 * @param {object} caseRecord normalised case (patient, prescriber, prescription, source, caseId)
 * @param {{provider?: object|null, aiEnabled?: boolean, timeoutMs?: number, now?: Date}} options
 */
function emptyRetrieval(ruleHits = []) {
  return {
    hits: ruleHits.map((h) => ({ ...h, evidenceIds: [] })),
    retrieved: [],
    missingEvidenceFor: [],
    evidenceStrength: 'none',
    retrievalCoverage: 'off',
    evidenceQuality: 'not_assessed',
    note: 'retrievalEnabled=false; evidence was not attached to the model context.',
  };
}

async function analyzeCase(caseRecord, {
  provider = null, aiEnabled = true, timeoutMs = 8000, now = new Date(), aiMode,
  rulesEnabled = true, retrievalEnabled = true, clarificationMode = 'none',
  searchExternal, fetchImpl, searchHerbImpl,
} = {}) {
  const mode = aiMode || getAiMode();
  const ruleTrack = runRuleTrack(caseRecord, { now });
  const herbNames = (caseRecord.prescription?.herbs || []).map((h) => h.name);
  let retrieval = retrievalEnabled
    ? retrieve({ ruleHits: ruleTrack.hits, herbNames })
    : emptyRetrieval(ruleTrack.hits);
  const inputScreen = screenInput(caseRecord);
  const caps = allowedCapabilities({ aiEnabled, mode, provider, searchExternal });
  const wantSearch = caps.autoSearch && retrievalEnabled
    && (retrieval.missingEvidenceFor.length || (ruleTrack.unknownHerbs || []).length)
    && !inputScreen.injectionSuspected && !inputScreen.tooLong;
  if (wantSearch) {
    const found = await searchGaps({
      unknownHerbs: ruleTrack.unknownHerbs,
      herbNames,
      fetchImpl,
      searchHerbImpl,
    });
    retrieval = mergeRetrieval(retrieval, found);
  }
  const modelWanted = caps.model;
  const activeProvider = modelWanted ? provider : null;
  const semanticRetrieval = retrievalEnabled ? retrieval : emptyRetrieval([]);
  const semantic = await runSemanticTrack({
    provider: activeProvider,
    caseRecord,
    ruleTrack: rulesEnabled ? ruleTrack : { ...ruleTrack, hits: [], missingInformation: [], tier: 'A0' },
    retrieval: semanticRetrieval,
    timeoutMs,
    inputScreen,
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

  let riskTier = rulesEnabled ? ruleTrack.tier : 'A0';
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
  if (retrieval.externalSearch?.used) {
    alerts.push({
      code: 'EXTERNAL_SEARCH_DRAFT',
      message: '规则库未覆盖的药味已检索到 PubMed 题录（非正式药典）。模型可对照判断这样用药是否常见，但不能批准或发药。',
      ruleId: null,
      tier: 'A2',
      evidenceIds: (retrieval.researchDrafts || []).map((e) => e.sourceId),
      source: 'search',
    });
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

  const reasonText = semanticOk ? '' : ({
    disabled: 'AI未启用，仅规则',
    disabled_by_kill_switch: 'AI总开关已关闭，仅规则',
    timeout: '模型超时，已回退规则',
    error: '模型不可用，已回退规则',
    schema_invalid: '模型输出不合规，已回退规则',
    skipped_injection: '疑似注入，已跳过模型',
    skipped_input_too_long: '输入过长，已跳过模型',
    policy_violation: '模型输出违反安全策略，已丢弃',
    circuit_open: '模型熔断，已回退规则',
    ok: mode === 'shadow' ? '影子对照，以下为规则轨' : '规则轨',
  }[semantic.status] || semantic.status || '规则轨');

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
      retrieved: retrieval.retrieved.map(({ sourceId, title, version, authority, hash, sourceType, clinicalUse, sourceUrl }) => ({
        sourceId, title, version, authority, hash, sourceType: sourceType || null, clinicalUse: clinicalUse === true, sourceUrl: sourceUrl || null,
      })),
      researchDrafts: (retrieval.researchDrafts || []).map(({ sourceId, title, version, authority, hash, sourceType, clinicalUse, sourceUrl, reviewStatus }) => ({
        sourceId, title, version, authority, hash, sourceType: sourceType || 'pubmed_draft', clinicalUse: false, sourceUrl: sourceUrl || null, reviewStatus: reviewStatus || 'draft',
      })),
      missingEvidenceFor: retrieval.missingEvidenceFor,
      evidenceStrength: retrieval.evidenceStrength,
      externalSearch: retrieval.externalSearch || null,
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
      rejectedDeskNotes: semantic.status === 'policy_violation' ? (semantic.output?.deskNotes || null) : null,
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
    deskNotes: semanticOk && semantic.output?.deskNotes
      ? attachDeskMeta(semantic.output.deskNotes, 'live_model')
      : fallbackDeskNotes(caseRecord, ruleTrack, retrieval),
    shadowResult: mode === 'shadow' && semantic.status === 'ok' ? {
      suggestedRiskTier: semantic.output.suggestedRiskTier,
      warningCodes: (semantic.output.warnings || []).map((w) => w.code),
      pharmacistExplanation: semantic.output.pharmacistExplanation,
      patientExplanation: semantic.output.patientExplanation,
      evidenceStrength: semantic.output.evidenceStrength,
      deskNotes: semantic.output.deskNotes || null,
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
  result.experimentControl = {
    rulesEnabled: Boolean(rulesEnabled),
    retrievalEnabled: Boolean(retrievalEnabled),
    clarificationMode,
    retrievalUsed: Boolean(retrievalEnabled && (semanticRetrieval.retrieved || []).length > 0),
  };
  const unified = check(UNIFIED_OUTPUT_SCHEMA, result);
  if (!unified.valid) throw new Error(`unified output failed schema: ${JSON.stringify(unified.errors.slice(0, 3))}`);
  return result;
}

module.exports = { analyzeCase, AI_LABEL, allowedCapabilities, fallbackDeskNotes };
