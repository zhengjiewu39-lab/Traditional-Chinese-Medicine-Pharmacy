#!/usr/bin/env node
/**
 * CLI wrapper around the shared research experiment engine.
 * Default pack is the frozen 500-case snapshot. IT01–IT06 remain available
 * via AI_COMPARE_PACK=benchmarks/ai-review/cases-interactive-v1.json
 */
const fs = require('fs');
const path = require('path');
const runtime = require('../../server/ai/aiRuntime');
const snapshotService = require('../../server/research/snapshotService');
const engine = require('../../server/research/experimentEngine');
const jobs = require('../../server/research/experimentJobs');
const { resolveCapabilities, providerForKind } = require('../../server/research/capabilityPolicy');

const ROOT = path.resolve(__dirname, '../..');

function fail(msg) {
  console.error(`[ai:evaluate:compare] ${msg}`);
  process.exit(2);
}

const wantLive = process.env.AI_COMPARE_ALLOW_MOCK !== '1';
const requestedMode = wantLive ? 'real' : 'mock';
const cap = jobs.limits();
if (wantLive) {
  if (!cap.allowLive) fail('Live compare is blocked: administrator allowLive is false.');
  if (!runtime.isAiEnabled()) fail('Live compare is blocked: global AI switch is off.');
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
const split = process.env.AI_COMPARE_SPLIT || (smoke ? 'all' : 'test');
const limit = smoke
  ? Math.min(4, (pack.baseCases || pack.cases || []).length)
  : (process.env.AI_COMPARE_LIMIT ? Number(process.env.AI_COMPARE_LIMIT) : null);
const selected = engine.selectCases(pack, {
  split,
  limit,
  selectUnit: 'base_case',
});

async function main() {
  const outDir = path.resolve(ROOT, wantLive ? 'benchmarks/ai-review/results-live' : 'benchmarks/ai-review/results-mock');
  fs.mkdirSync(outDir, { recursive: true });
  const protocol = {
    generatedAt: new Date().toISOString(),
    engineVersion: engine.ENGINE_VERSION,
    requestedMode,
    frozenCasePack: {
      path: packRel,
      version: pack.version,
      contentHash: pack.contentHash || null,
      evaluationNow: pack.evaluationNow || null,
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
    selection: {
      selectUnit: 'base_case',
      split,
      baseCases: new Set(selected.map((c) => c.baseId)).size,
      scenes: selected.length,
    },
    smoke,
    note: 'Clinical outcomes are not_evaluated. Stopping questions is not approval. 500 synthetic bases are not real patients. Mock is not a live model.',
  };
  const groups = {};
  for (const g of ['A', 'B', 'C', 'D', 'RAG_off']) {
    const caps = resolveCapabilities({
      requestedMode,
      groupCfg: engine.GROUPS[g],
      allowLive: cap.allowLive,
      runtimeEnabled: runtime.isAiEnabled(),
    });
    let provider = null;
    try {
      provider = providerForKind(caps.providerKind);
    } catch (err) {
      if (requestedMode === 'real') fail(err.message);
    }
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
          requestedMode,
          allowLive: cap.allowLive,
          capabilities: caps,
          policyAllows: () => runtime.isAiEnabled() && (requestedMode !== 'real' || cap.allowLive),
        },
      }));
    }
    groups[g] = rows;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    inferenceMode: requestedMode,
    engineVersion: engine.ENGINE_VERSION,
    clinicalLabels: 'not_evaluated',
    pharmacistTime: 'not_evaluated',
    clinicalEffect: 'not_estimated',
    protocol,
    groups,
    engineering: {
      baseCases: protocol.selection.baseCases,
      scenes: selected.length,
      failures: Object.values(groups).flat().filter((r) => r.engineeringFailure).length,
      modelFailures: Object.values(groups).flat().filter((r) => r.modelFailure).length,
      policyPaused: Object.values(groups).flat().filter((r) => r.executionStatus === 'policy_paused').length,
    },
  };
  const file = smoke ? 'compare-smoke.json' : 'compare-latest.json';
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'compare-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    inferenceMode: report.inferenceMode,
    engineVersion: report.engineVersion,
    baseCases: report.engineering.baseCases,
    scenes: selected.length,
    smoke,
    failures: report.engineering.failures,
    outDir,
    pack: packRel,
  }, null, 2));
}

main().catch((e) => fail(e.message));
