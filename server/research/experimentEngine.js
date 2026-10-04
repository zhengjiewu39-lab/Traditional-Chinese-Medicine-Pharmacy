/**
 * Isolated research engine. Web and CLI share this file.
 * It never writes operational cases, approvals, inventory, or runtime keys.
 */
const { analyzeCase } = require('../ai/aiOrchestrator');
const { applyFactChange } = require('../workflow/clinicalFacts');
const clarification = require('../workflow/clarificationService');
const { hashObject } = require('../common/hash');
const extract = require('../workflow/factExtract');
const {
  buildVisibleCase, hiddenBundle, assertNoHiddenLeak, answerFromScript,
} = require('./caseConstructor');

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

function applyScriptedAnswers(visible, hidden, selected) {
  let patient = visible.patient;
  const turns = [];
  for (const q of selected || []) {
    const fieldPath = q.fieldPaths[0];
    const scripted = answerFromScript(hidden, fieldPath);
    if (!scripted) {
      turns.push({ fieldPath, asked: true, answered: false, leakedLabel: false, kind: 'no_script' });
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
      answered: true,
      kind: scripted.status,
      leakedLabel: false,
      fromScript: true,
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
    .map((fieldPath) => ({ fieldPaths: [fieldPath], questionId: `fixed-${fieldPath}` }));
}

async function maybeExtract(visible, hidden, { inputMode, provider, aiEnabled }) {
  if (inputMode !== 'end_to_end_nl') {
    return { used: false, mode: 'structured_only', note: 'Structured facts only. This run does not evaluate natural-language understanding.' };
  }
  const text = visible.narrativeText || '';
  if (!text) return { used: false, mode: 'end_to_end_nl', note: 'No narrative on this scene.', candidates: [] };
  const out = await extract.extractCandidateFacts({
    caseId: visible.caseId,
    patient: { ...visible.patient, narrative: text },
    source: { rawText: text },
  }, { provider, aiEnabled });
  return {
    used: true,
    mode: 'end_to_end_nl',
    candidates: out.candidates || [],
    extractStatus: out.status || null,
    note: 'Candidates are confirmed or corrected only by the frozen script. Hidden answers are not sent to extract.',
  };
}

async function interact(visible, hidden, cfg, provider, opts = {}) {
  const maxRounds = Number(opts.maxRounds || 3);
  const maxBurden = Number(opts.maxBurden || 6);
  let patient = visible.patient;
  const turns = [];
  let last = null;
  let stopReason = null;
  let round = 0;
  let burdenUsed = 0;
  const asked = new Set();
  const extractTurn = await maybeExtract({ ...visible, narrativeText: visible.narrativeText || opts.narrativeText }, hidden, {
    inputMode: opts.inputMode,
    provider: cfg.aiEnabled ? provider : null,
    aiEnabled: cfg.aiEnabled && opts.aiMaster !== false,
  });
  while (round < maxRounds && burdenUsed < maxBurden) {
    if (opts.isCancelled?.()) {
      stopReason = 'cancelled';
      break;
    }
    if (opts.aiMaster === false && cfg.aiEnabled) {
      stopReason = 'policy_paused_ai_disabled';
      break;
    }
    const input = { ...visible, patient };
    assertNoHiddenLeak(input);
    last = await analyzeCase(input, {
      provider: cfg.aiEnabled ? provider : null,
      aiEnabled: cfg.aiEnabled && opts.aiMaster !== false,
      rulesEnabled: cfg.rulesEnabled,
      retrievalEnabled: cfg.retrievalEnabled,
      clarificationMode: cfg.clarificationMode,
      timeoutMs: opts.timeoutMs || 20000,
      aiMode: cfg.aiEnabled ? (opts.aiMode || 'shadow') : 'rules',
      searchExternal: cfg.retrievalEnabled && opts.aiMaster !== false,
    });
    const remaining = maxBurden - burdenUsed;
    let selected = [];
    if (cfg.clarificationMode === 'none') {
      selected = fixedQuestions(patient).filter((q) => !asked.has(q.fieldPaths[0])).slice(0, remaining);
    } else {
      const plan = clarification.generateRiskQuestions({
        ...visible, patient, analyses: [{ output: last }], clarificationRound: round, clarificationBurden: burdenUsed,
      }, { mode: cfg.clarificationMode, maxBurden: remaining, maxRounds });
      selected = (plan.selected || []).filter((q) => !asked.has(q.fieldPaths[0]));
      stopReason = plan.stopReason;
    }
    if (!selected.length) {
      stopReason = stopReason || 'no_remaining_questions';
      break;
    }
    const applied = applyScriptedAnswers({ ...visible, patient }, hidden, selected);
    const answeredRound = round + 1;
    patient = applied.patient;
    turns.push(...applied.turns.map((t) => ({
      ...t,
      round: answeredRound,
      whyAsked: cfg.clarificationMode === 'none' ? 'fixed_questionnaire' : cfg.clarificationMode,
    })));
    selected.forEach((q) => asked.add(q.fieldPaths[0]));
    burdenUsed += selected.length;
    round = answeredRound;
  }
  return { patient, turns, last, stopReason, rounds: round, burdenUsed, extractTurn };
}

function visibleFrom(pack, raw) {
  const visible = buildVisibleCase(pack, { ...raw, id: raw.id || raw.researchCaseId });
  visible.narrativeText = raw.narrativeText || null;
  visible.baseId = raw.baseId || raw.id;
  visible.split = raw.split || null;
  visible.category = raw.category || null;
  assertNoHiddenLeak(visible);
  return visible;
}

function rowFromRun({ groupId, visible, raw, run, started, cfg }) {
  const out = run.last || {};
  return {
    groupId,
    researchCaseId: visible.caseId,
    baseId: raw.baseId || visible.baseId,
    split: raw.split || null,
    ok: true,
    latencyMs: Date.now() - started,
    rawModelOutput: out.semanticTrackResult || null,
    filteredOutput: {
      riskTier: out.riskTier,
      recommendation: out.recommendation,
      alerts: (out.alerts || []).map((a) => a.code),
      hardStops: (out.hardStops || []).map((h) => h.code),
      pharmacistExplanation: out.pharmacistExplanation || null,
    },
    professionalReview: { reviewStatus: 'unreviewed', clinicalCorrectness: 'not_evaluated' },
    rawRisk: out.semanticTrackResult?.suggestedRiskTier || null,
    filteredRisk: out.riskTier,
    pharmacistApprovedRisk: 'not_evaluated',
    ruleRisk: out.ruleTrackResult?.tier || null,
    semanticStatus: out.semanticTrackResult?.status || 'disabled',
    retrievalUsed: Boolean(out.experimentControl?.retrievalUsed),
    retrievalEnabled: Boolean(out.experimentControl?.retrievalEnabled),
    rulesEnabled: Boolean(out.experimentControl?.rulesEnabled),
    clarificationMode: cfg.clarificationMode,
    clarificationTurns: run.turns,
    extractTurn: run.extractTurn || null,
    answered: run.turns.filter((t) => t.answered).length,
    asked: run.turns.length,
    rounds: run.rounds,
    burdenUsed: run.burdenUsed,
    stopReason: run.stopReason,
    whyStopped: run.stopReason,
    finalFactsHash: hashObject(run.patient),
    inputHash: hashObject({
      caseId: visible.caseId, patient: run.patient, rx: visible.prescription,
      promptVersion: out.promptVersion, modelVersion: out.modelVersion, knowledgeBaseVersion: out.knowledgeBaseVersion,
    }),
    outputHash: hashObject({
      risk: out.riskTier,
      recommendation: out.recommendation,
      alerts: (out.alerts || []).map((a) => a.code),
      hardStops: (out.hardStops || []).map((h) => h.code),
    }),
    retrieved: (out.retrievalTrackResult?.retrieved || []).map((e) => ({ sourceId: e.sourceId, title: e.title || null })),
    providerMeta: out.providerMeta ? { model: out.providerMeta.model, latencyMs: out.providerMeta.latencyMs, usage: out.providerMeta.usage || null } : null,
    tokenUsage: out.providerMeta?.usage || null,
    usageKnown: Boolean(out.providerMeta?.usage),
    modelFailure: ['timeout', 'error', 'schema_invalid', 'policy_violation'].includes(out.semanticTrackResult?.status),
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
  const visible = visibleFrom(pack, raw);
  const hidden = hiddenBundle({ ...raw, narrativeText: raw.narrativeText });
  hidden.narrativeText = raw.narrativeText;
  assertNoHiddenLeak(visible);
  const leak = JSON.stringify(visible);
  if (leak.includes('hiddenPatientFacts') || leak.includes('patientAnswerScript')) {
    throw new Error('hidden evaluation fields leaked into visible case');
  }
  const started = Date.now();
  try {
    const run = await interact(visible, hidden, cfg, provider, { ...opts, narrativeText: raw.narrativeText });
    return rowFromRun({ groupId, visible, raw, run, started, cfg });
  } catch (err) {
    return {
      groupId,
      researchCaseId: raw.id || raw.researchCaseId,
      baseId: raw.baseId,
      ok: false,
      error: err.message,
      latencyMs: Date.now() - started,
      engineeringFailure: true,
      clinicalAccuracy: 'not_evaluated',
      professionalReview: { reviewStatus: 'unreviewed', clinicalCorrectness: 'not_evaluated' },
    };
  }
}

function selectCases(pack, { split = 'test', offset = 0, limit = null, ids = null } = {}) {
  let rows = pack.cases || [];
  if (ids?.length) {
    const want = new Set(ids);
    rows = rows.filter((c) => want.has(c.id) || want.has(c.researchCaseId) || want.has(c.baseId));
  } else if (split && split !== 'all') {
    rows = rows.filter((c) => (c.split || 'test') === split);
  }
  if (offset) rows = rows.slice(offset);
  if (limit != null) rows = rows.slice(0, limit);
  return rows;
}

function packFromSnapshot(snap) {
  return {
    version: snap.version,
    frozenAt: snap.generatedAt,
    expertReviewStatus: snap.expertReviewStatus || 'unreviewed',
    defaults: snap.defaults || {},
    cases: snap.cases,
    datasetId: snap.datasetId,
    contentHash: snap.contentHash,
  };
}

module.exports = {
  FIXED_QUESTIONNAIRE,
  GROUPS,
  GROUP_LABELS,
  applyScriptedAnswers,
  runOne,
  selectCases,
  packFromSnapshot,
  visibleFrom,
};
