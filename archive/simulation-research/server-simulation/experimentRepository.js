const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.SIMULATION_DATA_DIR || path.join(__dirname, '../../data/simulation-experiments');
const EXPERIMENT_FILE_ID_RE = /^exp_\d{13}_[0-9a-f]{8}$/;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function newExperimentId() {
  return `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function newExperimentGroupId() {
  return `grp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function saveExperiment(record) {
  ensureDir();
  const id = record.id || newExperimentId();
  if (!EXPERIMENT_FILE_ID_RE.test(id)) throw new Error(`Invalid experiment id: ${id}`);
  const file = path.join(DATA_DIR, `${id}.json`);
  if (fs.existsSync(file)) {
    throw new Error(`Experiment ${id} already exists; immutable archive`);
  }
  const payload = {
    ...record,
    id,
    savedAt: new Date().toISOString(),
    dataClassification: 'synthetic-simulation',
  };
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, file);
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
        experimentGroupId: raw.experimentGroupId,
        scenarioId: raw.scenarioId,
        scenarioHash: raw.scenarioHash,
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

/** Returns null for ids outside the whitelist, so a request can never address a path outside DATA_DIR. */
function getExperiment(id) {
  if (typeof id !== 'string' || !EXPERIMENT_FILE_ID_RE.test(id)) return null;
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
  newExperimentGroupId,
};
