#!/usr/bin/env node
/**
 * Legacy Demo only — synthetic prescription rule/ML ablation. Not for public-health simulation papers.
 */
const { execSync } = require('child_process');
const path = require('path');
console.warn('Legacy Demo only: synthetic prescription CDSS ablation — not for supply-resilience papers.');
execSync(
  `node "${path.join(__dirname, 'evaluate-review.js')}" --output "${path.join(__dirname, '../benchmarks/results/ablation-latest.json')}"`,
  { stdio: 'inherit', cwd: path.join(__dirname, '..') },
);
