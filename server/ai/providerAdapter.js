const { createMockProvider } = require('./mockProvider');
const { createOpenAICompatibleProvider } = require('./openAICompatibleProvider');
const { effectiveEnv } = require('./runtimeConfig');

const PROVIDERS = ['mock', 'openai-compatible', 'disabled'];

function configuredProviderId(env = process.env) {
  const e = effectiveEnv(env);
  if (e.AI_PROVIDER) return e.AI_PROVIDER;
  return 'disabled';
}

/** Refuse to start in production with the mock provider, so mock output can never pass as real AI. */
function assertProductionAIConfig(env = process.env) {
  const e = effectiveEnv(env);
  const id = configuredProviderId(e);
  if (!PROVIDERS.includes(id)) throw new Error(`Unknown AI_PROVIDER "${id}"`);
  if (e.NODE_ENV === 'production' && id === 'mock') {
    throw new Error('AI_PROVIDER=mock is not allowed when NODE_ENV=production');
  }
  if (id === 'openai-compatible' && (!e.AI_BASE_URL || !e.AI_MODEL)) {
    throw new Error('AI_PROVIDER=openai-compatible requires AI_BASE_URL and AI_MODEL');
  }
}

function createProvider(env = process.env) {
  const e = effectiveEnv(env);
  const id = configuredProviderId(e);
  if (id === 'disabled') return null;
  if (id === 'mock') {
    if (e.NODE_ENV === 'production') throw new Error('mock provider refused in production');
    return createMockProvider();
  }
  if (id === 'openai-compatible') {
    return createOpenAICompatibleProvider({
      baseUrl: e.AI_BASE_URL,
      apiKey: e.AI_API_KEY,
      model: e.AI_MODEL,
      dataResidency: e.AI_DATA_RESIDENCY,
    });
  }
  throw new Error(`Unknown AI_PROVIDER "${id}"`);
}

function describeProvider(env = process.env) {
  const e = effectiveEnv(env);
  const id = configuredProviderId(e);
  return {
    provider: id,
    isMock: id === 'mock',
    model: id === 'openai-compatible' ? e.AI_MODEL : id === 'mock' ? 'mock-deterministic-v1' : null,
    endpointHost: id === 'openai-compatible' && e.AI_BASE_URL ? new URL(e.AI_BASE_URL).host : null,
    apiKeyConfigured: Boolean(e.AI_API_KEY),
    timeoutMs: Number(e.AI_TIMEOUT_MS) || (id === 'openai-compatible' ? 45000 : 8000),
  };
}

module.exports = {
  PROVIDERS, configuredProviderId, assertProductionAIConfig, createProvider, describeProvider,
};
