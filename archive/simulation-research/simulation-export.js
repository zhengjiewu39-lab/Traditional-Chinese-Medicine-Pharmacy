#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { listExperiments, getExperiment, DATA_DIR } = require('../server/simulation/experimentRepository');
const { metricsToCsv } = require('../server/simulation/exportService');

const outDir = path.join(__dirname, '../data/simulation-exports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const list = listExperiments();
if (!list.length) {
  console.error('No experiments in', DATA_DIR);
  process.exit(1);
}
const exp = getExperiment(list[0].id);
const jsonPath = path.join(outDir, `${exp.id}.json`);
const csvPath = path.join(outDir, `${exp.id}.csv`);
fs.writeFileSync(jsonPath, JSON.stringify(exp, null, 2));
const summary = exp.summary || exp.metrics;
fs.writeFileSync(csvPath, metricsToCsv(summary));
console.log('Exported', jsonPath, csvPath);
