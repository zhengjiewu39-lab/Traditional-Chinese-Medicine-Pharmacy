#!/usr/bin/env node
/**
 * Compare A rules / B LLM / C retrieval+LLM / D retrieval+clarification+LLM.
 * Does not invent scores. Without a live provider this process exits 2.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function fail(msg) {
  console.error(`[ai:evaluate:compare] ${msg}`);
  process.exit(2);
}

if ((process.env.AI_PROVIDER || '') !== 'openai-compatible' || !process.env.AI_BASE_URL || !process.env.AI_MODEL || !process.env.AI_API_KEY) {
  fail('Live compare requires AI_PROVIDER=openai-compatible, AI_BASE_URL, AI_MODEL and AI_API_KEY. No placeholder scores were written.');
}

const outDir = path.resolve(ROOT, 'benchmarks/ai-review/results-live');
fs.mkdirSync(outDir, { recursive: true });
const protocol = {
  generatedAt: new Date().toISOString(),
  groups: {
    A: 'rules only',
    B: 'LLM without retrieval',
    C: 'retrieval + LLM',
    D: 'retrieval + structured clarification + LLM',
  },
  primaryOutcome: 'critical-alert miss rate against an independent reference (not evaluated here until labels exist)',
  secondary: ['unsupported-claim rate', 'unnecessary prompts', 'required-clarification coverage', 'education fact consistency'],
  engineering: ['schema_pass', 'error_timeout', 'first_call_latency', 'repeat_latency', 'cost', 'citation_presence'],
  note: 'This file is a protocol receipt. Run the live loop only with a real key. Missing expert labels are reported as not_evaluated.',
};
fs.writeFileSync(path.join(outDir, 'compare-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);

require('./evaluate-live.js');
