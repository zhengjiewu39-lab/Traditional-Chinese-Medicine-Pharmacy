#!/usr/bin/env node
/**
 * Compare A rules / B LLM / C retrieval+LLM / D retrieval+clarification+LLM.
 * Without a live provider this process exits 2 and writes no scores.
 */
const fs = require('fs');
const path = require('path');
const { analyzeCase } = require('../../server/ai/aiOrchestrator');
const { createProvider } = require('../../server/ai/providerAdapter');
const { clinicalProjection, applyFactChange } = require('../../server/workflow/clinicalFacts');

const ROOT = path.resolve(__dirname, '../..');

function fail(msg) {
  console.error(`[ai:evaluate:compare] ${msg}`);
  process.exit(2);
}

const wantLive = process.env.AI_COMPARE_ALLOW_MOCK !== '1';
if (wantLive && ((process.env.AI_PROVIDER || '') !== 'openai-compatible' || !process.env.AI_BASE_URL || !process.env.AI_MODEL || !process.env.AI_API_KEY)) {
  fail('Live compare requires AI_PROVIDER=openai-compatible, AI_BASE_URL, AI_MODEL and AI_API_KEY. No placeholder scores were written.');
}

const casesPath = path.resolve(ROOT, 'benchmarks/ai-review/cases-v1.json');
if (!fs.existsSync(casesPath)) fail('cases-v1.json missing');
const pack = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const cases = (pack.cases || pack).slice(0, Number(process.env.AI_COMPARE_LIMIT || 8));

function stripRetrieval(caseRecord) {
  return { ...caseRecord, __compareGroup: 'B' };
}

async function runGroup(groupId, provider, aiEnabled) {
  const rows = [];
  for (const raw of cases) {
    const input = {
      caseId: raw.id || raw.caseId,
      patient: raw.patient,
      prescription: raw.prescription,
      source: { channel: 'imported' },
    };
    const started = Date.now();
    let out;
    try {
      if (groupId === 'A') {
        out = await analyzeCase(input, { provider: null, aiEnabled: false });
      } else if (groupId === 'B') {
        out = await analyzeCase(stripRetrieval(input), { provider, aiEnabled, timeoutMs: 20000 });
      } else if (groupId === 'C') {
        out = await analyzeCase(input, { provider, aiEnabled, timeoutMs: 20000 });
      } else {
        const missing = Object.entries(clinicalProjection(input.patient).facts || {})
          .filter(([, f]) => f && (f.status === 'unknown' || f.status === 'not_asked'))
          .slice(0, 2);
        let patient = input.patient;
        const turns = [];
        for (const [key] of missing) {
          const complete = raw.patient || {};
          const answer = complete[key] ?? complete.facts?.[key]?.value ?? null;
          if (answer == null) continue;
          const applied = applyFactChange(patient, {
            changeId: `cmp-${key}`, kind: 'correct', fieldPath: `patient.facts.${key}`,
            newValue: answer, newStatus: 'reported',
          }, { id: 'compare', role: 'patient' });
          patient = applied.patient;
          turns.push({ fieldPath: `patient.facts.${key}`, asked: true, answered: true, leakedLabel: false });
        }
        out = await analyzeCase({ ...input, patient }, { provider, aiEnabled, timeoutMs: 20000 });
        out.compareClarificationTurns = turns;
      }
      rows.push({
        groupId,
        caseId: input.caseId,
        ok: true,
        latencyMs: Date.now() - started,
        rawRisk: out.semanticTrackResult?.suggestedRiskTier || null,
        filteredRisk: out.riskTier,
        ruleRisk: out.ruleTrackResult?.tier || out.riskTier,
        semanticStatus: out.semanticTrackResult?.status || 'disabled',
        retrievalUsed: groupId !== 'B' && groupId !== 'A',
        clarificationTurns: out.compareClarificationTurns || [],
      });
    } catch (err) {
      rows.push({
        groupId, caseId: input.caseId, ok: false, error: err.message, latencyMs: Date.now() - started,
      });
    }
  }
  return rows;
}

async function main() {
  const provider = wantLive ? createProvider() : require('../../server/ai/mockProvider').createMockProvider();
  const outDir = path.resolve(ROOT, 'benchmarks/ai-review/results-live');
  fs.mkdirSync(outDir, { recursive: true });
  const protocol = {
    generatedAt: new Date().toISOString(),
    groups: { A: 'rules only', B: 'LLM without retrieval', C: 'retrieval + LLM', D: 'retrieval + structured clarification + LLM' },
    note: 'Protocol receipt. Clinical miss rate is not_evaluated without independent labels.',
  };
  const groups = {};
  for (const g of ['A', 'B', 'C', 'D']) {
    groups[g] = await runGroup(g, provider, g !== 'A');
  }
  const report = {
    generatedAt: new Date().toISOString(),
    inferenceMode: wantLive ? 'real' : 'mock',
    clinicalLabels: 'not_evaluated',
    protocol,
    groups,
    engineering: {
      cases: cases.length,
      failures: Object.values(groups).flat().filter((r) => !r.ok).length,
    },
  };
  if (wantLive) {
    fs.writeFileSync(path.join(outDir, 'compare-latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(outDir, 'compare-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, inferenceMode: report.inferenceMode, cases: cases.length, failures: report.engineering.failures }, null, 2));
}

main().catch((e) => fail(e.message));
