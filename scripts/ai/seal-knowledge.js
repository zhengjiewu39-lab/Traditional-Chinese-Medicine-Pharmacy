#!/usr/bin/env node
/**
 * Recompute the sha256 seal of every knowledge entry. Run only after a (synthetic) committee
 * review has changed an entry; the server refuses entries whose seal does not match.
 */
const fs = require('fs');
const path = require('path');
const { SOURCES_DIR, computeEntryHash } = require('../../server/knowledge/sourceRegistry');

for (const file of fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(SOURCES_DIR, file);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  doc.entries = doc.entries.map((e) => {
    const { hash, ...rest } = e;
    return { ...rest, hash: computeEntryHash(rest) };
  });
  fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`sealed ${doc.entries.length} entries in ${file}`);
}
