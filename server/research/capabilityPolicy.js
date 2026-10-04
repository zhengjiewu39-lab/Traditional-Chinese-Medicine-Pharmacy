/**
 * One capability matrix for web and CLI.
 * rules never calls a model. mock is offline. real needs a live switch and an approved overlay.
 */
const runtime = require('../ai/aiRuntime');
const { createMockProvider } = require('../ai/mockProvider');
const { createProvider } = require('../ai/providerAdapter');
const { effectiveEnv } = require('../ai/runtimeConfig');

const ENGINE_VERSION = 'research-engine@2.0.0';

function uniqueSorted(groups) {
  return [...new Set(groups || [])].filter(Boolean).sort();
}

function resolveCapabilities({
  requestedMode = 'mock',
  groupCfg = {},
  allowLive = false,
  runtimeEnabled = runtime.isAiEnabled(),
} = {}) {
  const mode = requestedMode === 'real' ? 'real' : (requestedMode === 'rules' ? 'rules' : 'mock');
  if (mode === 'rules' || !groupCfg.aiEnabled) {
    return {
      requestedMode: mode,
      executedMode: 'rules',
      callModel: false,
      providerKind: 'none',
      aiMode: 'rules',
      searchExternal: false,
      pause: false,
    };
  }
  if (mode === 'mock') {
    return {
      requestedMode: 'mock',
      executedMode: 'mock',
      callModel: true,
      providerKind: 'mock',
      aiMode: 'shadow',
      searchExternal: false,
      pause: false,
    };
  }
  if (!runtimeEnabled || !allowLive) {
    return {
      requestedMode: 'real',
      executedMode: 'policy_paused',
      callModel: false,
      providerKind: 'none',
      aiMode: 'rules',
      searchExternal: false,
      pause: true,
      pauseReason: !runtimeEnabled
        ? 'Global AI switch is off. No new model or automatic external search is scheduled.'
        : 'Live research calls are not allowed.',
    };
  }
  return {
    requestedMode: 'real',
    executedMode: 'real',
    callModel: true,
    providerKind: 'real',
    aiMode: 'shadow',
    searchExternal: Boolean(groupCfg.retrievalEnabled),
    pause: false,
  };
}

function providerForKind(kind) {
  if (kind === 'mock') return createMockProvider();
  if (kind !== 'real') return null;
  const env = effectiveEnv();
  if ((env.AI_PROVIDER || '') !== 'openai-compatible' || !env.AI_BASE_URL || !env.AI_MODEL || !env.AI_API_KEY) {
    const err = new Error('No administrator-approved real model overlay is configured');
    err.code = 'provider_not_approved';
    throw err;
  }
  return createProvider();
}

function overlayMeta() {
  const env = effectiveEnv();
  let baseUrlHost = null;
  try {
    baseUrlHost = env.AI_BASE_URL ? new URL(env.AI_BASE_URL).host : null;
  } catch {
    baseUrlHost = null;
  }
  return {
    provider: env.AI_PROVIDER || null,
    model: env.AI_MODEL || null,
    baseUrlHost,
  };
}

module.exports = {
  ENGINE_VERSION,
  uniqueSorted,
  resolveCapabilities,
  providerForKind,
  overlayMeta,
};
