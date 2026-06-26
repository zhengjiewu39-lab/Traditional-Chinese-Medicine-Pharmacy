const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '../config/tcm-rules.json');

let cached = null;
let cachedPath = null;
let cachedMtime = 0;

function loadRules(configPath = process.env.TCM_RULES_PATH || DEFAULT_PATH) {
  const stat = fs.statSync(configPath);
  if (cached && cachedPath === configPath && stat.mtimeMs === cachedMtime) {
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cached = {
    herbRules: raw.herbRules || {},
    eighteenIncompatible: raw.eighteenIncompatible || [],
    nineteenFear: raw.nineteenFear || [],
    thresholds: raw.thresholds || {},
    scoring: raw.scoring || {},
    meta: raw.meta || {},
    version: raw.version,
  };
  cachedPath = configPath;
  cachedMtime = stat.mtimeMs;
  return cached;
}

function reloadRules(configPath) {
  cached = null;
  return loadRules(configPath);
}

module.exports = { loadRules, reloadRules, DEFAULT_PATH };
