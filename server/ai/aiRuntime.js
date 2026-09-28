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
  return describeProvider().timeoutMs || 8000;
}

function reloadProvider() {
  cachedProvider = undefined;
}

function describeRuntime() {
  const p = getProvider();
  const d = describeProvider();
  const { getAiMode } = require('./aiMode');
  const { getDataMode, isSyntheticMode } = require('../config/dataMode');
  return {
    ...d,
    provider: p ? p.id : 'disabled',
    isMock: Boolean(p?.isMock),
    model: p ? p.modelVersion : null,
    aiEnabled: isAiEnabled(),
    aiMode: getAiMode(),
    dataMode: getDataMode(),
    syntheticData: isSyntheticMode(),
    dataResidency: p?.dataResidency || null,
    degradedMode: !p || !isAiEnabled() || getAiMode() === 'rules',
    circuit: typeof p?.circuit === 'function' ? p.circuit() : null,
  };
}

module.exports = {
  setProviderOverride, clearProviderOverride, getProvider, isAiEnabled, setAiEnabled, timeoutMs, describeRuntime, reloadProvider,
};
