#!/usr/bin/env node
/**
 * CLI wrapper around the shared research experiment engine.
 * Default pack is the frozen 500-case snapshot. IT01–IT06 remain available
 * via AI_COMPARE_PACK=benchmarks/ai-review/cases-interactive-v1.json
 */
const fs = require('fs');
const path = require('path');
const { createProvider } = require('../../server/ai/providerAdapter');
const { effectiveEnv } = require('../../server/ai/runtimeConfig');
const { createMockProvider } = require('../../server/ai/mockProvider');
const snapshotService = require('../../server/research/snapshotService');
const engine = require('../../server/research/experimentEngine');

const ROOT = path.resolve(__dirname, '../..');

function fail(msg) {
  console.error(`[ai:evaluate:compare] ${msg}`);
  process.exit(2);
}

const env = effectiveEnv();
const wantLive = process.env.AI_COMPARE_ALLOW_MOCK !== '1';
if (wantLive && ((env.AI_PROVIDER || '') !== 'openai-compatible' || !env.AI_BASE_URL || !env.AI_MODEL || !env.AI_API_KEY)) {
  fail('Live compare requires an openai-compatible provider with AI_BASE_URL, AI_MODEL and AI_API_KEY. No placeholder scores were written.');
}

const archived = process.env.AI_COMPARE_PACK;
let pack;
let packRel;
if (archived) {
  packRel = archived;
  const casesPath = path.resolve(ROOT, packRel);
  if (!fs.existsSync(casesPath)) fail(`${packRel} missing`);
  pack = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
} else {
  const snap = snapshotService.ensureCurrent();
  pack = engine.packFromSnapshot(snap);
  packRel = `research-snapshot:${snap.datasetId}:${snap.contentHash.slice(0, 12)}`;
}

const smoke = process.env.AI_COMPARE_SMOKE === '1';
const selected = engine.selectCases(pack, {
  split: smoke ? 'all' : 'test',
  limit: smoke ? Math.min(4, (pack.cases || []).length) : null,
});

async function main() {
  const provider = wantLive ? createProvider() : createMockProvider();
  const outDir = path.resolve(ROOT, wantLive ? 'benchmarks/ai-review/results-live' : 'benchmarks/ai-review/results-mock');
  fs.mkdirSync(outDir, { recursive: true });
  const protocol = {
    generatedAt: new Date().toISOString(),
    frozenCasePack: {
      path: packRel,
      version: pack.version,
      contentHash: pack.contentHash || null,
      expertReviewStatus: pack.expertReviewStatus || 'unreviewed',
      defaultMainExperiment: !archived,
    },
    archivedInteractivePack: 'benchmarks/ai-review/cases-interactive-v1.json',
    groups: engine.GROUP_LABELS,
    primaryComparison: 'D vs C',
    interactionBudget: {
      maxBurden: Number(process.env.AI_COMPARE_MAX_BURDEN || 6),
      maxRounds: Number(process.env.AI_COMPARE_MAX_ROUNDS || 3),
      note: 'Experimental parameter, not a clinical standard.',
    },
    smoke,
    note: 'Clinical outcomes are not_evaluated. Stopping questions is not approval. 500 synthetic bases are not real patients.',
  };
  const groups = {};
  for (const g of ['A', 'B', 'C', 'D', 'RAG_off']) {
    const rows = [];
    for (const raw of selected) {
      rows.push(await engine.runOne({
        pack,
        raw,
        groupId: g,
        provider,
        opts: {
          maxBurden: protocol.interactionBudget.maxBurden,
          maxRounds: protocol.interactionBudget.maxRounds,
          inputMode: 'structured',
          aiMode: wantLive ? 'shadow' : 'rules',
        },
      }));
    }
    groups[g] = rows;
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
      cases: selected.length,
      failures: Object.values(groups).flat().filter((r) => !r.ok).length,
      modelFailures: Object.values(groups).flat().filter((r) => r.modelFailure).length,
    },
  };
  const file = smoke ? 'compare-smoke.json' : 'compare-latest.json';
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'compare-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true, inferenceMode: report.inferenceMode, cases: selected.length, smoke, failures: report.engineering.failures, outDir, pack: packRel,
  }, null, 2));
}

main().catch((e) => fail(e.message));
