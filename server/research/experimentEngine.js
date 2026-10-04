/**
 * Isolated research engine. Web and CLI share this file.
 * It never writes operational cases, approvals, inventory, or runtime keys.
 */
const { analyzeCase } = require('../ai/aiOrchestrator');
const { applyFactChange, attachFacts } = require('../workflow/clinicalFacts');
const clarification = require('../workflow/clarificationService');
const { hashObject } = require('../common/hash');
const extract = require('../workflow/factExtract');
const { getPrompt } = require('../ai/promptRegistry');
const { knowledgeBaseVersion } = require('../knowledge/sourceRegistry');
const {
  buildVisibleCase, hiddenBundle, assertNoHiddenLeak, answerFromScript,
} = require('./caseConstructor');
const { ENGINE_VERSION, resolveCapabilities } = require('./capabilityPolicy');
const { wrapProvider, isGatedError } = require('./modelCallGate');

const FIXED_QUESTIONNAIRE = [
  'patient.facts.allergies',
  'patient.facts.pregnancy',
  'patient.facts.currentMedications',
  'patient.facts.liverImpairment',
  'patient.facts.ageYears',
];

const GROUPS = {
  A: { rulesEnabled: true, retrievalEnabled: false, aiEnabled: false, clarificationMode: 'none' },
  B: { rulesEnabled: true, retrievalEnabled: true, aiEnabled: true, clarificationMode: 'none' },
  C: { rulesEnabled: true, retrievalEnabled: true, aiEnabled: true, clarificationMode: 'generic' },
  D: { rulesEnabled: true, retrievalEnabled: true, aiEnabled: true, clarificationMode: 'risk_adaptive' },
  RAG_off: { rulesEnabled: true, retrievalEnabled: false, aiEnabled: true, clarificationMode: 'none', ablation: true },
};

const GROUP_LABELS = {
  A: 'fixed questionnaire + rules',
  B: 'fixed questionnaire + rules + model + retrieval',
  C: 'same as B + generic clarification',
  D: 'same as B + risk-related active questions and stop',
  RAG_off: 'ablation: B with retrieval disabled',
};

function classifyTurn(scripted, applied) {
  if (!scripted) return { scriptResponded: false, noScript: true, factResolved: false, answeredUnknown: false, refused: false };
  const status = scripted.status || applied?.newStatus;
  return {
    scriptResponded: true,
    noScript: false,
    factResolved: ['reported', 'verified', 'none', 'denied'].includes(status) && scripted.value != null,
    answeredUnknown: status === 'unknown',
    refused: status === 'not_applicable' || scripted.kind === 'refused',
  };
}

function applyScriptedAnswers(visible, hidden, selected) {
  let patient = visible.patient;
  const turns = [];
  for (const q of selected || []) {
    const fieldPath = q.fieldPaths[0];
    const scripted = answerFromScript(hidden, fieldPath);
    if (!scripted) {
      turns.push({
        fieldPath, asked: true, leakedLabel: false, kind: 'no_script',
        scriptResponded: false, noScript: true, factResolved: false, answeredUnknown: false, refused: false,
        answerValue: null, answerStatus: null,
      });
      continue;
    }
    const applied = applyFactChange(patient, {
      changeId: `cmp-${fieldPath}`,
      kind: 'correct',
      fieldPath,
      newValue: scripted.value ?? null,
      newStatus: scripted.status || 'reported',
    }, { id: 'script', role: 'patient' });
    patient = applied.patient;
    turns.push({
      fieldPath,
      asked: true,
      leakedLabel: false,
      fromScript: true,
      kind: scripted.status,
      answerValue: scripted.value ?? null,
      answerStatus: scripted.status,
      ...classifyTurn(scripted),
    });
  }
  return { patient, turns };
}

function fixedQuestions(patient) {
  return FIXED_QUESTIONNAIRE
    .filter((fieldPath) => {
      const key = fieldPath.replace('patient.facts.', '');
      const st = patient?.facts?.[key]?.status || (patient?.[key] == null ? 'not_asked' : 'reported');
      return ['not_asked', 'unknown'].includes(st);
    })
    .map((fieldPath) => ({ fieldPaths: [fieldPath], questionId: `fixed-${fieldPath}`, questionText: fieldPath }));
}

function encounterNow(raw, pack) {
  const issued = raw.prescription?.issuedAt || raw.encounterAt || pack.evaluationNow;
  if (!issued) return new Date(pack.evaluationNow || Date.now());
  return new Date(`${String(issued).slice(0, 10)}T12:00:00Z`);
}

async function analyzeOnce(visible, patient, cfg, provider, opts, caps) {
  const input = { ...visible, patient };
  assertNoHiddenLeak(input);
  const nowIso = opts.now instanceof Date ? opts.now.toISOString() : (opts.now || null);
  const inputHash = hashObject({ caseId: visible.caseId, patient, rx: visible.prescription, now: nowIso });
  const wantModel = caps.callModel && opts.policyAllows?.() !== false && !opts.isCancelled?.() && !opts.signal?.aborted;
  const runRules = async () => analyzeCase(input, {
    provider: null,
    aiEnabled: false,
    rulesEnabled: cfg.rulesEnabled,
    retrievalEnabled: cfg.retrievalEnabled && caps.executedMode === 'mock',
    clarificationMode: cfg.clarificationMode,
    timeoutMs: opts.timeoutMs || 20000,
    aiMode: 'rules',
    searchExternal: false,
    now: opts.now,
    signal: opts.signal,
  });
  let out;
  let usedModel = false;
  let skipReason = null;
  try {
    if (!wantModel) {
      out = await runRules();
    } else {
      out = await analyzeCase(input, {
        provider,
        aiEnabled: true,
        rulesEnabled: cfg.rulesEnabled,
        retrievalEnabled: cfg.retrievalEnabled && (caps.searchExternal || caps.executedMode === 'mock'),
        clarificationMode: cfg.clarificationMode,
        timeoutMs: opts.timeoutMs || 20000,
        aiMode: caps.aiMode,
        searchExternal: caps.searchExternal && opts.policyAllows?.() !== false,
        now: opts.now,
        signal: opts.signal,
      });
      usedModel = Boolean(provider) && out.semanticTrackResult?.status !== 'disabled';
    }
  } catch (err) {
    if (!isGatedError(err)) throw err;
    skipReason = err.code;
    out = await runRules();
    usedModel = false;
  }
  if (opts.onCall) opts.onCall({ usage: out.providerMeta?.usage || null, usedModel });
  return {
    out,
    inputHash,
    outputHash: hashObject({
      risk: out.riskTier,
      recommendation: out.recommendation,
      alerts: (out.alerts || []).map((a) => a.code),
      hardStops: (out.hardStops || []).map((h) => h.code),
    }),
    usedModel,
    skipReason,
    finalModelSkipped: Boolean(wantModel && !usedModel),
  };
}

function confirmExtracted(candidates, hidden, visible) {
  const applied = [];
  let patient = visible.patient;
  for (const c of candidates || []) {
    const fieldPath = c.fieldPath || c.field || (c.key ? `patient.facts.${c.key}` : null);
    if (!fieldPath) {
      applied.push({ fieldPath: null, action: 'skipped_no_path', candidate: c.value ?? null });
      continue;
    }
    const scripted = answerFromScript(hidden, fieldPath);
    if (!scripted) {
      applied.push({ fieldPath, action: 'left_unknown', reason: 'no_script', candidate: c.value ?? null, independentlyVerified: false });
      continue;
    }
    const change = applyFactChange(patient, {
      changeId: `nl-${fieldPath}`,
      kind: 'correct',
      fieldPath,
      newValue: scripted.value ?? null,
      newStatus: scripted.status || 'reported',
    }, { id: 'script', role: 'patient' });
    patient = change.patient;
    applied.push({
      fieldPath,
      action: scripted.status === 'unknown' ? 'confirmed_unknown' : 'confirmed_from_script',
      candidate: c.value ?? null,
      scriptStatus: scripted.status,
      independentlyVerified: false,
      sourceSpan: c.span || c.sourceText || null,
    });
  }
  return { patient, confirmations: applied };
}

async function maybeExtract(visible, hidden, { inputMode, provider, caps, opts }) {
  if (inputMode !== 'end_to_end_nl') {
    return { used: false, mode: 'structured_only', note: 'Structured facts only. This run does not evaluate natural-language understanding.', confirmations: [] };
  }
  if (opts.isCancelled?.() || opts.signal?.aborted) {
    return { used: false, mode: 'end_to_end_nl', cancelled: true, candidates: [], confirmations: [], note: 'Cancelled before extract.' };
  }
  const text = visible.narrativeText || opts.narrativeText || '';
  if (!text) return { used: false, mode: 'end_to_end_nl', note: 'No narrative on this scene.', candidates: [], confirmations: [] };
  const seed = attachFacts({
    sex: visible.patient?.sex || visible.patient?.facts?.sex?.value || visible.patient?.facts?.sex,
    narrative: text,
  });
  const seedVisible = { ...visible, patient: seed };
  let out = { candidates: [], modelCalled: false };
  try {
    out = await extract.extractCandidateFacts({
      caseId: visible.caseId,
      patient: seed,
      source: { rawText: text },
    }, {
      provider: caps.callModel ? provider : null,
      aiEnabled: caps.callModel && opts.policyAllows?.() !== false,
      signal: opts.signal,
    });
  } catch (err) {
    if (!isGatedError(err)) throw err;
    return { used: false, mode: 'end_to_end_nl', cancelled: err.code === 'cancelled', skipReason: err.code, candidates: [], confirmations: [], patient: seed };
  }
  if (out.cancelled || ['cancelled', 'quota_paused', 'policy_paused'].includes(out.skipReason)) {
    return {
      used: false,
      mode: 'end_to_end_nl',
      cancelled: out.cancelled || out.skipReason === 'cancelled',
      skipReason: out.skipReason,
      candidates: [],
      confirmations: [],
      patient: seed,
    };
  }
  const confirmed = confirmExtracted((out.candidates || []).map((c) => ({
    fieldPath: c.fieldPath,
    value: c.candidateValue ?? c.value,
    span: c.sourceText || c.span || null,
  })), hidden, seedVisible);
  return {
    used: true,
    mode: 'nl_only_min_seed',
    candidates: out.candidates || [],
    extractStatus: out.status || null,
    confirmations: confirmed.confirmations,
    mismatches: (confirmed.confirmations || []).filter((c) => c.candidate != null && c.scriptStatus && String(c.candidate) !== String(c.scriptStatus === 'unknown' ? '' : c.candidate)),
    patient: confirmed.patient,
    seed: 'sex_only',
    note: 'NL-only seed is sex when present. Other facts come from sourced candidate confirmation or later scripted clarification. Missing candidates are not filled from hidden or structured answers.',
  };
}

async function interact(visible, hidden, cfg, provider, opts = {}) {
  const maxRounds = Number(opts.maxRounds || 3);
  const maxBurden = Number(opts.maxBurden || 6);
  const caps = opts.capabilities || resolveCapabilities({ requestedMode: opts.requestedMode || 'mock', groupCfg: cfg });
  const cancelled = () => Boolean(opts.isCancelled?.() || opts.signal?.aborted);
  const policyAllows = () => {
    if (typeof opts.policyAllows === 'function') return opts.policyAllows();
    return opts.aiMaster !== false;
  };
  const gated = wrapProvider(provider, {
    reserve: opts.reserveModelCall,
    policyAllows,
    isCancelled: cancelled,
    signal: opts.signal,
    onDispatched: opts.onCall,
  }) || (caps.callModel ? provider : null);
  let working = visible;
  if (opts.inputMode === 'end_to_end_nl') {
    working = { ...visible, patient: attachFacts({ sex: visible.patient?.sex || visible.patient?.facts?.sex?.value || visible.patient?.facts?.sex }) };
  }
  let patient = working.patient;
  const turns = [];
  const analyses = [];
  let last = null;
  let stopReason = null;
  let round = 0;
  let burdenUsed = 0;
  const asked = new Set();
  if (cancelled()) {
    return {
      patient, turns, last: null, stopReason: 'cancelled', rounds: 0, burdenUsed: 0,
      extractTurn: { used: false, cancelled: true, confirmations: [] }, analyses, capabilities: caps,
    };
  }
  const extractTurn = await maybeExtract({ ...working, narrativeText: visible.narrativeText || opts.narrativeText }, hidden, {
    inputMode: opts.inputMode,
    provider: gated,
    caps,
    opts: { ...opts, isCancelled: cancelled, policyAllows },
  });
  if (extractTurn.cancelled) {
    return {
      patient, turns, last: null, stopReason: 'cancelled', rounds: 0, burdenUsed: 0, extractTurn, analyses, capabilities: caps,
    };
  }
  if (extractTurn.patient) patient = extractTurn.patient;

  const runAnalyze = async (why) => {
    if (cancelled()) {
      stopReason = 'cancelled';
      return null;
    }
    const liveCaps = resolveCapabilities({
      requestedMode: caps.requestedMode,
      groupCfg: cfg,
      allowLive: opts.allowLive,
      runtimeEnabled: policyAllows(),
    });
    if (liveCaps.pause && caps.requestedMode === 'real' && cfg.aiEnabled) {
      stopReason = 'policy_paused_ai_disabled';
      const rulesCaps = resolveCapabilities({ requestedMode: 'rules', groupCfg: cfg });
      const analyzed = await analyzeOnce(working, patient, cfg, null, { ...opts, policyAllows: () => false }, rulesCaps);
      last = analyzed.out;
      analyses.push({ ...analyzed, why, finalModelSkipped: true });
      return analyzed;
    }
    const analyzed = await analyzeOnce(working, patient, cfg, gated, { ...opts, policyAllows, isCancelled: cancelled }, liveCaps);
    last = analyzed.out;
    analyses.push({ ...analyzed, why });
    if (analyzed.skipReason === 'quota_paused') stopReason = 'quota_paused';
    else if (analyzed.skipReason === 'policy_paused') stopReason = 'policy_paused_ai_disabled';
    else if (analyzed.skipReason === 'cancelled') stopReason = 'cancelled';
    return analyzed;
  };

  while (round < maxRounds && burdenUsed < maxBurden) {
    if (cancelled()) {
      stopReason = 'cancelled';
      break;
    }
    await runAnalyze(round === 0 ? 'initial' : `reanalyze_round_${round}`);
    if (stopReason === 'cancelled' || stopReason === 'policy_paused_ai_disabled' || stopReason === 'quota_paused') break;
    const remaining = maxBurden - burdenUsed;
    let selected = [];
    if (cfg.clarificationMode === 'none') {
      selected = fixedQuestions(patient).filter((q) => !asked.has(q.fieldPaths[0])).slice(0, remaining);
    } else {
      const plan = clarification.generateRiskQuestions({
        ...visible, patient, analyses: [{ output: last }], clarificationRound: round, clarificationBurden: burdenUsed,
      }, { mode: cfg.clarificationMode, maxBurden: remaining, maxRounds });
      selected = (plan.selected || []).filter((q) => !asked.has(q.fieldPaths[0]));
      stopReason = plan.stopReason || stopReason;
    }
    if (!selected.length) {
      stopReason = stopReason || 'no_remaining_questions';
      break;
    }
    const before = hashObject(patient);
    const applied = applyScriptedAnswers({ ...visible, patient }, hidden, selected);
    const answeredRound = round + 1;
    patient = applied.patient;
    const afterHash = hashObject(patient);
    turns.push(...applied.turns.map((t) => ({
      ...t,
      round: answeredRound,
      whyAsked: cfg.clarificationMode === 'none' ? 'fixed_questionnaire' : cfg.clarificationMode,
      questionText: selected.find((q) => q.fieldPaths[0] === t.fieldPath)?.questionText || t.fieldPath,
      factsHashBefore: before,
      factsHashAfter: afterHash,
    })));
    selected.forEach((q) => asked.add(q.fieldPaths[0]));
    burdenUsed += selected.length;
    round = answeredRound;
    if (afterHash !== before) {
      await runAnalyze('after_script_answers');
      if (stopReason === 'cancelled' || stopReason === 'policy_paused_ai_disabled' || stopReason === 'quota_paused') break;
      if (round >= maxRounds || burdenUsed >= maxBurden) {
        stopReason = stopReason || (burdenUsed >= maxBurden ? 'burden_cap' : 'round_cap');
        break;
      }
    }
  }
  if (!stopReason) stopReason = analyses.length ? 'complete' : 'no_analysis';
  if (!last) {
    const analyzed = await runAnalyze('fallback_final');
    last = analyzed?.out || null;
  }
  return {
    patient, turns, last, stopReason, rounds: round, burdenUsed, extractTurn, analyses, capabilities: caps,
  };
}

function visibleFrom(pack, raw, { now } = {}) {
  const visible = buildVisibleCase(pack, { ...raw, id: raw.id || raw.researchCaseId }, { now: now || encounterNow(raw, pack) });
  visible.narrativeText = raw.narrativeText || null;
  visible.baseId = raw.baseId || raw.id;
  visible.split = raw.split || null;
  visible.category = raw.category || null;
  visible.encounterAt = raw.encounterAt || raw.prescription?.issuedAt || pack.evaluationNow || null;
  assertNoHiddenLeak(visible);
  return visible;
}

function countTurns(turns) {
  return {
    asked: turns.length,
    scriptResponded: turns.filter((t) => t.scriptResponded).length,
    factResolved: turns.filter((t) => t.factResolved).length,
    answeredUnknown: turns.filter((t) => t.answeredUnknown).length,
    refused: turns.filter((t) => t.refused).length,
    noScript: turns.filter((t) => t.noScript).length,
  };
}

function rowFromRun({ groupId, visible, raw, run, started, cfg, pack }) {
  const out = run.last || {};
  const semantic = out.semanticTrackResult || {};
  const counts = countTurns(run.turns || []);
  const wantedModel = Boolean(cfg.aiEnabled && run.capabilities?.requestedMode && run.capabilities.requestedMode !== 'rules');
  const anyModel = (run.analyses || []).some((a) => a.usedModel);
  const finalModelSkipped = Boolean((run.analyses || []).some((a) => a.finalModelSkipped) || (wantedModel && !anyModel && run.stopReason !== 'cancelled'));
  let executionStatus = 'completed';
  if (run.stopReason === 'cancelled') executionStatus = 'cancelled';
  else if (run.stopReason === 'quota_paused') executionStatus = 'quota_paused';
  else if (run.stopReason === 'policy_paused_ai_disabled') executionStatus = 'policy_paused';
  else if (run.engineeringFailure) executionStatus = 'failed';
  else if (wantedModel && run.capabilities?.requestedMode === 'real' && !anyModel) {
    executionStatus = finalModelSkipped ? (run.stopReason === 'quota_paused' ? 'quota_paused' : 'policy_paused') : 'completed';
    if (executionStatus === 'completed' && finalModelSkipped) executionStatus = 'quota_paused';
  }
  return {
    engineVersion: ENGINE_VERSION,
    groupId,
    researchCaseId: visible.caseId,
    baseId: raw.baseId || visible.baseId,
    split: raw.split || null,
    executionStatus,
    ok: executionStatus === 'completed',
    latencyMs: Date.now() - started,
    semanticResult: semantic.output || semantic,
    filteredOutput: {
      riskTier: out.riskTier,
      recommendation: out.recommendation,
      alerts: (out.alerts || []).map((a) => a.code),
      hardStops: (out.hardStops || []).map((h) => h.code),
      pharmacistExplanation: out.pharmacistExplanation || null,
    },
    professionalReview: { reviewStatus: 'unreviewed', clinicalCorrectness: 'not_evaluated' },
    rawRisk: semantic.output?.suggestedRiskTier || semantic.suggestedRiskTier || null,
    filteredRisk: out.riskTier,
    pharmacistApprovedRisk: 'not_evaluated',
    ruleRisk: out.ruleTrackResult?.tier || null,
    semanticStatus: semantic.status || 'disabled',
    retrievalUsed: Boolean(out.experimentControl?.retrievalUsed),
    retrievalEnabled: Boolean(out.experimentControl?.retrievalEnabled),
    rulesEnabled: Boolean(out.experimentControl?.rulesEnabled),
    clarificationMode: cfg.clarificationMode,
    clarificationTurns: run.turns,
    analyses: (run.analyses || []).map((a) => ({
      why: a.why,
      inputHash: a.inputHash,
      outputHash: a.outputHash,
      usedModel: a.usedModel,
      finalModelSkipped: Boolean(a.finalModelSkipped),
      risk: a.out?.riskTier || null,
      ruleRisk: a.out?.ruleTrackResult?.tier || null,
    })),
    versions: {
      engineVersion: ENGINE_VERSION,
      promptVersion: out.promptVersion || (() => { try { return getPrompt('rx-screening').ref; } catch { return null; } })(),
      modelVersion: out.modelVersion || null,
      knowledgeBaseVersion: out.knowledgeBaseVersion || knowledgeBaseVersion() || null,
    },
    extractTurn: run.extractTurn || null,
    asked: counts.asked,
    answered: counts.factResolved,
    scriptResponded: counts.scriptResponded,
    factResolved: counts.factResolved,
    answeredUnknown: counts.answeredUnknown,
    refused: counts.refused,
    noScript: counts.noScript,
    rounds: run.rounds,
    burdenUsed: run.burdenUsed,
    stopReason: run.stopReason,
    whyStopped: run.stopReason,
    finalModelSkipped,
    requestedMode: run.capabilities?.requestedMode || null,
    executedMode: anyModel
      ? (run.capabilities?.executedMode || run.capabilities?.requestedMode)
      : (cfg.aiEnabled ? (executionStatus === 'completed' ? 'rules_fallback' : executionStatus) : 'rules'),
    modelDispatched: anyModel,
    finalFactsHash: hashObject(run.patient),
    inputHash: (run.analyses || []).slice(-1)[0]?.inputHash || null,
    outputHash: (run.analyses || []).slice(-1)[0]?.outputHash || null,
    encounterAt: visible.encounterAt,
    evaluationNow: pack.evaluationNow || null,
    staleAtEvaluationNow: Boolean(raw.staleAtEvaluationNow),
    retrieved: (out.retrievalTrackResult?.retrieved || []).map((e) => ({ sourceId: e.sourceId, title: e.title || null })),
    providerMeta: out.providerMeta ? { model: out.providerMeta.model, latencyMs: out.providerMeta.latencyMs, usage: out.providerMeta.usage || null } : null,
    tokenUsage: out.providerMeta?.usage || null,
    usageKnown: Boolean(out.providerMeta?.usage),
    usageCompleteness: out.providerMeta?.usage ? 'last_analysis_only' : 'unknown',
    modelFailure: ['timeout', 'error', 'schema_invalid', 'policy_violation'].includes(semantic.status),
    engineeringFailure: false,
    clinicalUnsafe: 'not_evaluated',
    clinicalAccuracy: 'not_evaluated',
    missRate: 'not_evaluated',
    clinicalEffect: 'not_evaluated',
  };
}

async function runOne({ pack, raw, groupId, provider, opts = {} }) {
  const cfg = GROUPS[groupId];
  if (!cfg) throw new Error(`unknown group ${groupId}`);
  if (!raw) {
    return {
      groupId, ok: false, engineeringFailure: true, executionStatus: 'failed',
      error: 'research case missing', clinicalAccuracy: 'not_evaluated',
      professionalReview: { reviewStatus: 'unreviewed', clinicalCorrectness: 'not_evaluated' },
    };
  }
  const now = opts.now || encounterNow(raw, pack);
  const visible = visibleFrom(pack, raw, { now });
  const hidden = hiddenBundle({ ...raw, narrativeText: raw.narrativeText });
  hidden.narrativeText = raw.narrativeText;
  assertNoHiddenLeak(visible);
  const leak = JSON.stringify(visible);
  if (leak.includes('hiddenPatientFacts') || leak.includes('patientAnswerScript')) {
    throw new Error('hidden evaluation fields leaked into visible case');
  }
  const caps = resolveCapabilities({
    requestedMode: opts.requestedMode || 'mock',
    groupCfg: cfg,
    allowLive: opts.allowLive,
    runtimeEnabled: typeof opts.policyAllows === 'function' ? opts.policyAllows() : opts.aiMaster !== false,
  });
  const started = Date.now();
  try {
    const run = await interact(visible, hidden, cfg, provider, {
      ...opts, narrativeText: raw.narrativeText, now, capabilities: caps,
    });
    return rowFromRun({ groupId, visible, raw, run, started, cfg, pack });
  } catch (err) {
    return {
      groupId,
      researchCaseId: raw.id || raw.researchCaseId,
      baseId: raw.baseId,
      ok: false,
      executionStatus: 'failed',
      error: err.message,
      latencyMs: Date.now() - started,
      engineeringFailure: true,
      clinicalAccuracy: 'not_evaluated',
      professionalReview: { reviewStatus: 'unreviewed', clinicalCorrectness: 'not_evaluated' },
    };
  }
}

function selectBases(pack, {
  split = 'test', offset = 0, limit = null, ids = null, selectUnit = 'base_case',
} = {}) {
  const scenes = pack.cases || [];
  const bases = pack.baseCases || [...new Map(scenes.map((c) => [c.baseId, { baseId: c.baseId, split: c.split }])).values()];
  if (selectUnit === 'scene') {
    let rows = scenes;
    if (ids?.length) {
      const want = new Set(ids);
      rows = scenes.filter((c) => want.has(c.id) || want.has(c.researchCaseId));
    } else if (split && split !== 'all') {
      rows = rows.filter((c) => (c.split || 'test') === split);
    }
    if (offset) rows = rows.slice(offset);
    if (limit != null) rows = rows.slice(0, limit);
    return rows;
  }
  let chosen = bases;
  if (ids?.length) {
    const want = new Set(ids);
    chosen = bases.filter((b) => want.has(b.baseId) || want.has(b.id));
  } else if (split && split !== 'all') {
    chosen = bases.filter((b) => (b.split || 'test') === split);
  }
  if (offset) chosen = chosen.slice(offset);
  if (limit != null) chosen = chosen.slice(0, limit);
  const idSet = new Set(chosen.map((b) => b.baseId || b.id));
  return scenes.filter((c) => idSet.has(c.baseId));
}

function selectCases(pack, opts = {}) {
  return selectBases(pack, opts);
}

function packFromSnapshot(snap) {
  return {
    version: snap.version,
    frozenAt: snap.generatedAt,
    evaluationNow: snap.evaluationNow || snap.generatedAt,
    expertReviewStatus: snap.expertReviewStatus || 'unreviewed',
    defaults: snap.defaults || {},
    cases: snap.cases,
    baseCases: snap.baseCases || [],
    datasetId: snap.datasetId,
    contentHash: snap.contentHash,
    encounterRule: snap.encounterRule || {
      id: 'issued-at-as-encounter@1',
      text: 'Analyze as of the frozen issuedAt date. The original issue date is kept. Stale-at-evaluation-now is a stratum, not a rewritten date.',
    },
  };
}

module.exports = {
  ENGINE_VERSION,
  FIXED_QUESTIONNAIRE,
  GROUPS,
  GROUP_LABELS,
  applyScriptedAnswers,
  runOne,
  selectCases,
  selectBases,
  packFromSnapshot,
  visibleFrom,
  interact,
  confirmExtracted,
};
