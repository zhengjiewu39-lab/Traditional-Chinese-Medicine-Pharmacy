/**
 * Operating data mode. Demo/synthetic-study data must never share storage with
 * pilot or production records.
 */
const MODES = ['demo', 'synthetic-study', 'pilot', 'production'];

function getDataMode(env = process.env) {
  const raw = env.DATA_MODE || (env.NODE_ENV === 'production' ? 'production' : 'demo');
  if (!MODES.includes(raw)) throw new Error(`Unknown DATA_MODE "${raw}"`);
  return raw;
}

function isSyntheticMode(env = process.env) {
  const m = getDataMode(env);
  return m === 'demo' || m === 'synthetic-study';
}

function allowsMockProvider(env = process.env) {
  return env.NODE_ENV !== 'production' && isSyntheticMode(env);
}

function clinicalKnowledgeRequired(env = process.env) {
  const m = getDataMode(env);
  return m === 'pilot' || m === 'production';
}

module.exports = {
  MODES, getDataMode, isSyntheticMode, allowsMockProvider, clinicalKnowledgeRequired,
};
