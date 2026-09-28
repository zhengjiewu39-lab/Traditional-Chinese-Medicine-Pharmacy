const { createMockProvider } = require('./mockProvider');
const { createOpenAICompatibleProvider } = require('./openAICompatibleProvider');

const PROVIDERS = ['mock', 'openai-compatible', 'disabled'];

function configuredProviderId(env = process.env) {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  return env.NODE_ENV === 'production' ? 'disabled' : 'mock';
}

/** Refuse to start in production with the mock provider, so mock output can never pass as real AI. */
function assertProductionAIConfig(env = process.env) {
  const id = configuredProviderId(env);
  if (!PROVIDERS.includes(id)) throw new Error(`Unknown AI_PROVIDER "${id}"`);
  if (env.NODE_ENV === 'production' && id === 'mock') {
    throw new Error('AI_PROVIDER=mock is not allowed when NODE_ENV=production');
  }
  if (id === 'openai-compatible' && (!env.AI_BASE_URL || !env.AI_MODEL)) {
    throw new Error('AI_PROVIDER=openai-compatible requires AI_BASE_URL and AI_MODEL');
  }
}

function createProvider(env = process.env) {
  const id = configuredProviderId(env);
  if (id === 'disabled') return null;
  if (id === 'mock') {
    if (env.NODE_ENV === 'production') throw new Error('mock provider refused in production');
    return createMockProvider();
  }
  if (id === 'openai-compatible') return createOpenAICompatibleProvider({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL });
  throw new Error(`Unknown AI_PROVIDER "${id}"`);
}

function describeProvider(env = process.env) {
  const id = configuredProviderId(env);
  return {
    provider: id,
    isMock: id === 'mock',
    model: id === 'openai-compatible' ? env.AI_MODEL : id === 'mock' ? 'mock-deterministic-v1' : null,
    endpointHost: id === 'openai-compatible' && env.AI_BASE_URL ? new URL(env.AI_BASE_URL).host : null,
    apiKeyConfigured: Boolean(env.AI_API_KEY),
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 8000,
  };
}

module.exports = {
  PROVIDERS, configuredProviderId, assertProductionAIConfig, createProvider, describeProvider,
};
