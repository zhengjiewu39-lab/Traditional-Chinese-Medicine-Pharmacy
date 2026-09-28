const { createProvider, describeProvider } = require('./providerAdapter');
const repo = require('../workflow/workflowRepository');

let providerOverride;
let cachedProvider;

/** Tests and the offline evaluator inject providers here; HTTP requests cannot. */
function setProviderOverride(provider) {
  providerOverride = provider;
}

function clearProviderOverride() {
  providerOverride = undefined;
}

function getProvider() {
  if (providerOverride !== undefined) return providerOverride;
  if (cachedProvider === undefined) cachedProvider = createProvider();
  return cachedProvider;
}

function isAiEnabled() {
  return repo.settings().get().aiEnabled !== false;
}

function setAiEnabled(enabled) {
  repo.settings().set({ aiEnabled: Boolean(enabled) });
}

function timeoutMs() {
  return Number(process.env.AI_TIMEOUT_MS) || 8000;
}

function describeRuntime() {
  const p = getProvider();
  const d = describeProvider();
  return {
    ...d,
    provider: p ? p.id : 'disabled',
    isMock: Boolean(p?.isMock),
    model: p ? p.modelVersion : null,
    aiEnabled: isAiEnabled(),
    degradedMode: !p || !isAiEnabled(),
  };
}

module.exports = {
  setProviderOverride, clearProviderOverride, getProvider, isAiEnabled, setAiEnabled, timeoutMs, describeRuntime,
};
