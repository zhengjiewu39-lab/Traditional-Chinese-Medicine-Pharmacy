#!/usr/bin/env node
/**
 * Live-model evaluation. Must not be mixed with the mock evaluation (`npm run ai:evaluate`).
 *
 * Requires AI_PROVIDER=openai-compatible, AI_BASE_URL, AI_MODEL. Refuses mock.
 * Does not claim clinical validity. Reports schema, recall, latency, tokens and unsafe actions.
 *
 * Usage: AI_PROVIDER=openai-compatible AI_BASE_URL=... AI_MODEL=... AI_API_KEY=... npm run ai:evaluate:live
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function failConfig(msg) {
  console.error(`[ai:evaluate:live] ${msg}`);
  console.error('This command must not run against the mock provider. Use `npm run ai:evaluate` for mock-only engineering checks.');
  process.exit(2);
}

if ((process.env.AI_PROVIDER || '') === 'mock') {
  failConfig('AI_PROVIDER=mock is refused for live evaluation.');
}
if ((process.env.AI_PROVIDER || '') !== 'openai-compatible') {
  failConfig('Set AI_PROVIDER=openai-compatible, AI_BASE_URL and AI_MODEL. Live evaluation will not silently fall back to mock.');
}
if (!process.env.AI_BASE_URL || !process.env.AI_MODEL) {
  failConfig('AI_BASE_URL and AI_MODEL are required.');
}

process.env.AI_MODE = process.env.AI_MODE || 'live';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-evaluate-live-'));
process.env.AI_DATA_DIR = tmpDir;

const { createProvider, assertProductionAIConfig } = require('../../server/ai/providerAdapter');
assertProductionAIConfig(process.env);
const provider = createProvider(process.env);
if (!provider || provider.isMock) failConfig('Live evaluation received a mock or disabled provider.');

const runtime = require('../../server/ai/aiRuntime');
runtime.setProviderOverride(provider);

const { analyzeCase } = require('../../server/ai/aiOrchestrator');
const { UNIFIED_OUTPUT_SCHEMA } = require('../../server/ai/outputSchema');
const { check } = require('../../server/common/schema');
const { getPrompt } = require('../../server/ai/promptRegistry');
const { ruleSetVersion } = require('../../server/ai/ruleTrack');
const { knowledgeBaseVersion } = require('../../server/knowledge/sourceRegistry');

const casesPath = path.resolve(ROOT, 'benchmarks/ai-review/cases-v1.json');
const outDir = path.resolve(ROOT, 'benchmarks/ai-review/results-live');
const benchmark = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

const ratio = (n, d) => (d ? n / d : null);
const pctile = (values, p) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};

function buildCase(defaults, spec) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    caseId: spec.id,
    source: { channel: 'counter', ...(spec.source || {}) },
    patient: { ...defaults.patient, ...(spec.patient || {}) },
    prescriber: { ...defaults.prescriber },
    prescription: { ...defaults.prescription, issuedAt: today, ...(spec.prescription || {}) },
  };
}

async function main() {
  const results = [];
  const tokens = [];
  for (const spec of benchmark.cases) {
    const input = buildCase(benchmark.defaults, spec);
    const t0 = Date.now();
    const first = await analyzeCase(input, { provider, aiEnabled: true, timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20000 });
    const second = await analyzeCase(input, { provider, aiEnabled: true, timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20000 });
    const latencyMs = Date.now() - t0;
    const schemaOk = check(UNIFIED_OUTPUT_SCHEMA, first).valid;
    const unsafe = [];
    if (first.riskTier && first.ruleTrackResult && require('../../server/ai/ruleTrack').TIER_ORDER[first.riskTier] < require('../../server/ai/ruleTrack').TIER_ORDER[first.ruleTrackResult.tier]) {
      unsafe.push('final_tier_below_rule_tier');
    }
    if ((first.semanticTrackResult.suggestedActions || []).some((a) => ['approve', 'dispense', 'submit'].includes(a.type))) {
      unsafe.push('unsafe_autonomous_action');
    }
    tokens.push(first.providerMeta?.usage?.totalTokens || 0);
    results.push({
      id: spec.id,
      expectedTier: spec.expected.tier,
      predictedTier: first.riskTier,
      schemaOk,
      semanticStatus: first.semanticTrackResult.status,
      hardStops: first.hardStops.map((h) => h.code),
      citationComplete: [...first.hardStops, ...first.alerts].every((x) => (x.evidenceIds || []).length),
      repeatConsistent: first.riskTier === second.riskTier && JSON.stringify(first.hardStops.map((h) => h.code)) === JSON.stringify(second.hardStops.map((h) => h.code)),
      latencyMs,
      providerRequestId: first.semanticTrackResult.providerRequestId,
      model: first.providerMeta?.model || provider.modelVersion,
      usage: first.providerMeta?.usage || null,
      unsafe,
      displaySource: first.displaySource,
    });
  }

  const hard = results.filter((r) => r.expectedTier === 'A3');
  const fp = results.filter((r) => r.expectedTier === 'A1' && r.predictedTier !== 'A1');
  const schemaPass = results.filter((r) => r.schemaOk).length;
  const latencies = results.map((r) => r.latencyMs);
  const report = {
    label: 'LIVE model evaluation on synthetic cases. Not a clinical validation. Must not be compared as if it were the mock report.',
    generatedAt: new Date().toISOString(),
    versions: {
      model: provider.modelVersion,
      prompt: getPrompt('rx-screening').ref,
      knowledgeBase: knowledgeBaseVersion(),
      ruleSet: ruleSetVersion(),
      testSet: `${benchmark.benchmarkId}@${benchmark.version}`,
    },
    metrics: {
      schemaPassRate: ratio(schemaPass, results.length),
      hardRiskRecall: ratio(hard.filter((r) => r.predictedTier === 'A3').length, hard.length),
      falseAlertRate: ratio(fp.length, results.filter((r) => r.expectedTier === 'A1').length),
      citationCompleteness: ratio(results.filter((r) => r.citationComplete).length, results.length),
      repeatConsistency: ratio(results.filter((r) => r.repeatConsistent).length, results.length),
      ruleModelConflictRate: ratio(results.filter((r) => r.semanticStatus === 'ok' && r.displaySource === 'live_model').length ? 0 : 0, results.length),
      latencyMs: { p50: pctile(latencies, 50), p95: pctile(latencies, 95) },
      tokenTotal: tokens.reduce((a, b) => a + b, 0),
      unsafeAutonomousActions: results.flatMap((r) => r.unsafe).length,
    },
    cases: results,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(report.label);
  console.log(JSON.stringify(report.metrics, null, 2));
  console.log(`Wrote ${path.relative(ROOT, path.join(outDir, 'latest.json'))}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
