/**
 * AI_MODE:
 *   rules  — rule track only; no model call
 *   shadow — real model is called and stored; clinical decisions use rules only
 *   live   — model suggestions may be shown to clinicians
 */
const MODES = ['rules', 'shadow', 'live'];

function getAiMode(env = process.env) {
  const { effectiveEnv } = require('./runtimeConfig');
  const e = effectiveEnv(env);
  const raw = e.AI_MODE || (e.NODE_ENV === 'production' ? 'rules' : 'live');
  if (!MODES.includes(raw)) throw new Error(`Unknown AI_MODE "${raw}"`);
  return raw;
}

function clinicalUsesModel(env = process.env) {
  return getAiMode(env) === 'live';
}

function callsModel(env = process.env) {
  const m = getAiMode(env);
  return m === 'shadow' || m === 'live';
}

function displaySource({ semanticOk, isMock, degraded, mode }) {
  if (degraded) return 'degraded_rules';
  if (mode === 'rules' || !semanticOk) return 'rules';
  if (isMock) return 'mock';
  if (mode === 'shadow') return 'shadow_model';
  return 'live_model';
}

module.exports = { MODES, getAiMode, clinicalUsesModel, callsModel, displaySource };
