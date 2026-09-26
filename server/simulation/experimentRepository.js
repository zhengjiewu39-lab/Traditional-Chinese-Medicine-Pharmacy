const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data/simulation-experiments');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function newExperimentId() {
  return `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function saveExperiment(record) {
  ensureDir();
  const id = record.id || newExperimentId();
  const file = path.join(DATA_DIR, `${id}.json`);
  const payload = {
    ...record,
    id,
    savedAt: new Date().toISOString(),
    dataClassification: 'synthetic-simulation',
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function listExperiments() {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      return {
        id: raw.id,
        scenarioId: raw.scenarioId,
        scenarioVersion: raw.scenarioVersion,
        policyId: raw.policyId,
        randomSeed: raw.randomSeed,
        replicates: raw.replicates,
        startedAt: raw.startedAt,
        finishedAt: raw.finishedAt,
        engineVersion: raw.engineVersion,
        gitCommitHash: raw.gitCommitHash,
        summary: raw.summary,
      };
    })
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

function getExperiment(id) {
  ensureDir();
  const file = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = {
  DATA_DIR,
  saveExperiment,
  listExperiments,
  getExperiment,
  newExperimentId,
};
