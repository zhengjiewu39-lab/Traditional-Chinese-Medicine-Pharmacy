/**
 * Local overlay for a live OpenAI-compatible provider.
 * Stored under the data-mode directory (gitignored). Never logs the API key.
 */
const fs = require('fs');
const path = require('path');
const { aiDataDir } = require('../common/dataDir');
const { ServiceError } = require('../workflow/errors');
const { normalizeBaseUrl } = require('./openAICompatibleProvider');

const FILE = () => path.join(aiDataDir(), 'runtime-provider.json');

const PRESETS = {
  openai: { AI_BASE_URL: 'https://api.openai.com/v1', AI_MODEL: 'gpt-4o-mini', label: 'OpenAI' },
  deepseek: { AI_BASE_URL: 'https://api.deepseek.com/v1', AI_MODEL: 'deepseek-chat', label: 'DeepSeek' },
  ollama: { AI_BASE_URL: 'http://127.0.0.1:11434/v1', AI_MODEL: 'llama3.1', label: '本地 Ollama' },
};

function loadRuntimeProvider() {
  try {
    const p = FILE();
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  } catch {
    return null;
  }
}

function saveRuntimeProvider(body) {
  const preset = PRESETS[body.preset] || {};
  if (body.aiMode === 'live') {
    throw new ServiceError(409, 'live_requires_promotion', 'Connecting a provider starts in shadow. Promote to live only after a shadow evaluation report, pharmacist approval, and governance sign-off.');
  }
  const next = {
    AI_PROVIDER: 'openai-compatible',
    AI_MODE: 'shadow',
    AI_TIMEOUT_MS: String(body.timeoutMs || 45000),
    AI_BASE_URL: normalizeBaseUrl(body.baseUrl || preset.AI_BASE_URL || ''),
    AI_MODEL: String(body.model || preset.AI_MODEL || ''),
    AI_DATA_RESIDENCY: body.dataResidency === 'on-prem' ? 'on-prem' : 'external',
    updatedAt: new Date().toISOString(),
  };
  const existing = loadRuntimeProvider() || {};
  const key = body.apiKey != null && String(body.apiKey).trim() !== '' ? String(body.apiKey).trim() : existing.AI_API_KEY;
  if (key) next.AI_API_KEY = key;
  if (!next.AI_BASE_URL || !next.AI_MODEL) {
    throw new ServiceError(400, 'provider_config_required', 'baseUrl and model are required');
  }
  const dir = aiDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE(), `${JSON.stringify(next, null, 2)}\n`);
  return publicView(next);
}

function promoteRuntimeToLive() {
  const existing = loadRuntimeProvider();
  if (!existing) throw new ServiceError(409, 'provider_not_configured', 'Configure a provider before promoting to live');
  existing.AI_MODE = 'live';
  existing.promotedAt = new Date().toISOString();
  fs.writeFileSync(FILE(), `${JSON.stringify(existing, null, 2)}\n`);
  return publicView(existing);
}

function clearRuntimeProvider() {
  const p = FILE();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function publicView(cfg = loadRuntimeProvider()) {
  if (!cfg) return { configured: false, presets: Object.entries(PRESETS).map(([id, v]) => ({ id, ...v, AI_API_KEY: undefined })) };
  return {
    configured: true,
    provider: cfg.AI_PROVIDER,
    model: cfg.AI_MODEL,
    baseUrl: cfg.AI_BASE_URL,
    endpointHost: (() => { try { return new URL(cfg.AI_BASE_URL).host; } catch { return null; } })(),
    apiKeyConfigured: Boolean(cfg.AI_API_KEY),
    aiMode: cfg.AI_MODE || 'shadow',
    dataResidency: cfg.AI_DATA_RESIDENCY || null,
    timeoutMs: Number(cfg.AI_TIMEOUT_MS) || 30000,
    updatedAt: cfg.updatedAt || null,
    presets: Object.entries(PRESETS).map(([id, v]) => ({ id, label: v.label, AI_BASE_URL: v.AI_BASE_URL, AI_MODEL: v.AI_MODEL })),
  };
}

function effectiveEnv(env = process.env) {
  const overlay = loadRuntimeProvider();
  if (!overlay) return env;
  return { ...env, ...overlay };
}

module.exports = {
  PRESETS, loadRuntimeProvider, saveRuntimeProvider, promoteRuntimeToLive, clearRuntimeProvider, publicView, effectiveEnv,
};
