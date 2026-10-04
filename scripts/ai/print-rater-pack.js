#!/usr/bin/env node
/**
 * Print visible facts for an independent rater.
 * Does not write labels. Hidden scripts stay hidden unless --include-hidden is set
 * by the rater after they finished the visible-only pass.
 */
const fs = require('fs');
const path = require('path');

const archived = process.env.AI_RATER_PACK || 'benchmarks/ai-review/cases-interactive-v1.json';
const packPath = path.resolve(__dirname, '../../', archived);
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
console.log('Default rater cards are the archived IT pack unless you pass a snapshot JSON path.');
const includeHidden = process.argv.includes('--include-hidden');

console.log(`Pack ${pack.benchmarkId} ${pack.version}`);
console.log(`expertReviewStatus=${pack.expertReviewStatus}`);
console.log('Fill benchmarks/ai-review/expert-label-worksheet.md. Do not invent labels here.');
console.log('');

for (const c of pack.cases || []) {
  const herbs = (c.prescription?.herbs || []).map((h) => `${h.name}${h.dosage ?? ''}${h.unit || 'g'}`).join('、');
  console.log(`## ${c.id} (${c.split})`);
  console.log(`visible: ${c.description}`);
  console.log(`observed: ${JSON.stringify(c.initialObservedFacts || {})}`);
  console.log(`prescription: ${herbs}`);
  if (includeHidden) {
    console.log(`hidden: ${JSON.stringify(c.hiddenPatientFacts || {})}`);
    console.log(`script: ${JSON.stringify(c.patientAnswerScript || {})}`);
  }
  console.log(`worksheet: unsafeIfApprovedWithoutCheck / recommendedLane / citationSupport still blank`);
  console.log('');
}
