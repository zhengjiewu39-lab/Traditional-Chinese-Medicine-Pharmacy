#!/usr/bin/env node
/**
 * Main experiment: does risk-related active questioning help?
 * A  fixed questionnaire + rules
 * B  fixed questionnaire + rules + live LLM + retrieval
 * C  same as B + generic clarification
 * D  same as B + risk-related active questions and stop
 * RAG_off is a separate ablation, not group B.
 *
 * Without a live provider this process exits 2 and writes no live scores.
 */
const fs = require('fs');
const path = require('path');
const { analyzeCase } = require('../../server/ai/aiOrchestrator');
const { createProvider } = require('../../server/ai/providerAdapter');
const { applyFactChange } = require('../../server/workflow/clinicalFacts');
const clarification = require('../../server/workflow/clarificationService');
const {
  buildVisibleCase, hiddenBundle, assertNoHiddenLeak, answerFromScript,
} = require('../../server/research/caseConstructor');

const ROOT = path.resolve(__dirname, '../..');

function fail(msg) {
  console.error(`[ai:evaluate:compare] ${msg}`);
  process.exit(2);
}

const wantLive = process.env.AI_COMPARE_ALLOW_MOCK !== '1';
if (wantLive && ((process.env.AI_PROVIDER || '') !== 'openai-compatible' || !process.env.AI_BASE_URL || !process.env.AI_MODEL || !process.env.AI_API_KEY)) {
  fail('Live compare requires AI_PROVIDER=openai-compatible, AI_BASE_URL, AI_MODEL and AI_API_KEY. No placeholder scores were written.');
}

const packRel = process.env.AI_COMPARE_PACK || 'benchmarks/ai-review/cases-interactive-v1.json';
const casesPath = path.resolve(ROOT, packRel);
if (!fs.existsSync(casesPath)) fail(`${packRel} missing`);
const pack = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const smoke = process.env.AI_COMPARE_SMOKE === '1';
const all = pack.cases || pack;
const cases = smoke ? all.slice(0, Math.min(4, all.length)) : all.filter((c) => (c.split || 'test') === 'test');

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

const MAX_BURDEN = Number(process.env.AI_COMPARE_MAX_BURDEN || 6);
const MAX_ROUNDS = Number(process.env.AI_COMPARE_MAX_ROUNDS || 3);

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
    if (scripted.status === 'unknown' || scripted.status === 'denied') {
      const applied = applyFactChange(patient, {
        changeId: `cmp-${fieldPath}`, kind: 'correct', fieldPath, newValue: scripted.value ?? null, newStatus: scripted.status,
      }, { id: 'script', role: 'patient' });
      patient = applied.patient;
      turns.push({ fieldPath, asked: true, answered: true, kind: scripted.status, leakedLabel: false });
      continue;
    }
    const applied = applyFactChange(patient, {
      changeId: `cmp-${fieldPath}`, kind: 'correct', fieldPath, newValue: scripted.value, newStatus: scripted.status || 'reported',
    }, { id: 'script', role: 'patient' });
    patient = applied.patient;
    turns.push({ fieldPath, asked: true, answered: true, kind: 'reported', leakedLabel: false });
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

async function interact(visible, hidden, cfg, provider) {
  let patient = visible.patient;
  const turns = [];
  let last = null;
  let stopReason = null;
  let round = 0;
  const asked = new Set();
  while (round <= MAX_ROUNDS) {
    const input = { ...visible, patient };
    assertNoHiddenLeak(input);
    last = await analyzeCase(input, {
      provider: cfg.aiEnabled ? provider : null,
      aiEnabled: cfg.aiEnabled,
      rulesEnabled: cfg.rulesEnabled,
      retrievalEnabled: cfg.retrievalEnabled,
      clarificationMode: cfg.clarificationMode,
      timeoutMs: 20000,
      aiMode: cfg.aiEnabled ? 'live' : 'rules',
    });
    let selected = [];
    if (cfg.clarificationMode === 'none') {
      selected = fixedQuestions(patient).filter((q) => !asked.has(q.fieldPaths[0]));
    } else {
      const plan = clarification.generateRiskQuestions({
        ...visible, patient, analyses: [{ output: last }], clarificationRound: round,
      }, { mode: cfg.clarificationMode, maxBurden: MAX_BURDEN, maxRounds: MAX_ROUNDS });
      selected = (plan.selected || []).filter((q) => !asked.has(q.fieldPaths[0]));
      stopReason = plan.stopReason;
    }
    if (!selected.length || round === MAX_ROUNDS) {
      if (!selected.length) stopReason = stopReason || 'no_remaining_questions';
      else stopReason = 'round_cap';
      break;
    }
    const applied = applyScriptedAnswers({ ...visible, patient }, hidden, selected);
    const answeredRound = round + 1;
    patient = applied.patient;
    turns.push(...applied.turns.map((t) => ({ ...t, round: answeredRound })));
    selected.forEach((q) => asked.add(q.fieldPaths[0]));
    round = answeredRound;
    if (applied.turns.every((t) => t.kind === 'no_script' || t.kind === 'denied' || t.kind === 'unknown')) {
      stopReason = stopReason || 'script_stopped';
      break;
    }
  }
  return { patient, turns, last, stopReason, rounds: round };
}

async function runGroup(groupId, provider) {
  const cfg = GROUPS[groupId];
  const rows = [];
  for (const raw of cases) {
    const visible = buildVisibleCase(pack, raw);
    const hidden = hiddenBundle(raw);
    assertNoHiddenLeak(visible);
    const started = Date.now();
    try {
      const run = await interact(visible, hidden, cfg, provider);
      const out = run.last;
      rows.push({
        groupId,
        caseId: visible.caseId,
        ok: true,
        latencyMs: Date.now() - started,
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
        answered: run.turns.filter((t) => t.answered).length,
        asked: run.turns.length,
        rounds: run.rounds,
        stopReason: run.stopReason,
        inputHash: require('../../server/common/hash').hashObject({ caseId: visible.caseId, patient: run.patient, rx: visible.prescription }),
        outputHash: require('../../server/common/hash').hashObject({ risk: out.riskTier, alerts: (out.alerts || []).map((a) => a.code) }),
        retrieved: out.retrievalTrackResult?.retrieved || [],
        providerMeta: out.providerMeta || null,
        modelFailure: ['timeout', 'error', 'schema_invalid', 'policy_violation'].includes(out.semanticTrackResult?.status),
        engineeringFailure: false,
        clinicalUnsafe: 'not_evaluated',
      });
    } catch (err) {
      rows.push({
        groupId, caseId: raw.id || raw.caseId, ok: false, error: err.message, latencyMs: Date.now() - started,
        engineeringFailure: true,
      });
    }
  }
  return rows;
}

async function main() {
  const provider = wantLive ? createProvider() : require('../../server/ai/mockProvider').createMockProvider();
  const outDir = path.resolve(ROOT, wantLive ? 'benchmarks/ai-review/results-live' : 'benchmarks/ai-review/results-mock');
  fs.mkdirSync(outDir, { recursive: true });
  const protocol = {
    generatedAt: new Date().toISOString(),
    frozenCasePack: { path: packRel, version: pack.version, frozenAt: pack.frozenAt, expertReviewStatus: pack.expertReviewStatus || 'unreviewed' },
    groups: {
      A: 'fixed questionnaire + rules',
      B: 'fixed questionnaire + rules + live LLM + retrieval',
      C: 'same as B + generic clarification',
      D: 'same as B + risk-related active questions and stop',
      RAG_off: 'ablation: B with retrieval disabled in model context',
    },
    primaryComparison: 'D vs C',
    interactionBudget: { maxBurden: MAX_BURDEN, maxRounds: MAX_ROUNDS, note: 'Experimental parameter, not a clinical standard.' },
    smoke: smoke,
    note: 'Unsafe-suggestion rate needs independent professional labels. Clinical outcomes are not_evaluated. Stopping questions is not approval.',
  };
  const groups = {};
  const order = ['A', 'B', 'C', 'D', 'RAG_off'];
  for (const g of order) {
    groups[g] = await runGroup(g, provider);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    inferenceMode: wantLive ? 'real' : 'mock',
    clinicalLabels: 'not_evaluated',
    pharmacistTime: 'not_evaluated',
    clinicalEffect: 'not_estimated',
    protocol,
    groups,
    engineering: {
      cases: cases.length,
      failures: Object.values(groups).flat().filter((r) => !r.ok).length,
      modelFailures: Object.values(groups).flat().filter((r) => r.modelFailure).length,
    },
  };
  const file = smoke ? 'compare-smoke.json' : 'compare-latest.json';
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'compare-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true, inferenceMode: report.inferenceMode, cases: cases.length, smoke, failures: report.engineering.failures, outDir,
  }, null, 2));
}

main().catch((e) => fail(e.message));
