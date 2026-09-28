/**
 * OpenAI-compatible chat completions client.
 * API key is sent only in Authorization and is never logged.
 * DeepSeek / Ollama do not support OpenAI json_schema structured output; they get json_object
 * and a fallback with no response_format if the host rejects it.
 */
const { createCircuitBreaker } = require('./circuitBreaker');
const { SEMANTIC_OUTPUT_SCHEMA } = require('./outputSchema');

const breaker = createCircuitBreaker();

function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '');
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

function supportsJsonSchema(baseUrl) {
  return /(^|\.)openai\.com$/i.test(hostOf(baseUrl));
}

function isReasoner(model) {
  return /reasoner/i.test(String(model || ''));
}

function sanitize(text) {
  return String(text || '').replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
}

function coerceJsonContent(content) {
  const t = String(content).trim();
  const tryParse = (s) => { JSON.parse(s); return s; };
  try { return tryParse(t); } catch { /* not raw JSON */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return tryParse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return tryParse(t.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return t;
}

async function readBody(res) {
  if (typeof res.text === 'function') {
    const raw = await res.text();
    try { return { raw, json: JSON.parse(raw) }; } catch { return { raw, json: null }; }
  }
  if (typeof res.json === 'function') {
    const json = await res.json();
    return { raw: JSON.stringify(json), json };
  }
  return { raw: '', json: null };
}

function httpError(status, providerMessage) {
  const hint = {
    401: 'API Key 无效或已过期',
    403: 'API Key 没有调用该模型的权限',
    404: '接口地址或模型名不正确',
    422: '请求格式不被该提供方接受',
    429: '额度不足或请求过于频繁',
  }[status] || (status === 400 ? '请求格式不被该提供方接受' : `提供方返回 HTTP ${status}`);
  const extra = providerMessage ? `：${sanitize(providerMessage).slice(0, 180)}` : '';
  const err = new Error(`provider HTTP ${status}（${hint}${extra}）`);
  err.status = status;
  err.httpStatus = status;
  return err;
}

function createOpenAICompatibleProvider({
  baseUrl = process.env.AI_BASE_URL,
  apiKey = process.env.AI_API_KEY,
  model = process.env.AI_MODEL,
  dataResidency = process.env.AI_DATA_RESIDENCY || 'external',
  fetchImpl = fetch,
} = {}) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized || !model) throw new Error('AI_BASE_URL and AI_MODEL are required for the openai-compatible provider');
  const endpoint = `${normalized}/chat/completions`;
  const purpose = process.env.AI_MODEL_PURPOSE || 'rx-screening';
  breaker.reset();

  return {
    id: 'openai-compatible',
    isMock: false,
    modelVersion: model,
    endpointHost: new URL(endpoint).host,
    dataResidency,
    purpose,
    lastMeta: null,
    async complete({ messages, signal, jsonSchema }) {
      const started = Date.now();
      const useSchema = Boolean(jsonSchema) && supportsJsonSchema(normalized) && !isReasoner(model);
      const payload = {
        model,
        messages,
        ...(isReasoner(model) ? {} : { temperature: 0 }),
        ...(isReasoner(model) ? {} : {
          response_format: useSchema
            ? { type: 'json_schema', json_schema: { name: 'rx_screening', strict: true, schema: jsonSchema } }
            : { type: 'json_object' },
        }),
      };

      const post = async (body) => fetchImpl(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const run = async () => {
        let res = await post(payload);
        if (!res.ok && res.status === 400 && payload.response_format) {
          const first = await readBody(res);
          const retryBody = { ...payload };
          delete retryBody.response_format;
          res = await post(retryBody);
          if (res.ok) {
            /* first 400 was response_format; continue with the retry */
          } else {
            const second = await readBody(res);
            const msg = second.json?.error?.message || first.json?.error?.message || second.raw || first.raw;
            this.lastMeta = { httpStatus: res.status, latencyMs: Date.now() - started, errorType: 'http' };
            throw httpError(res.status, msg);
          }
        }
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const body = await readBody(res);
          const msg = body.json?.error?.message || body.json?.message || body.raw;
          this.lastMeta = { httpStatus: res.status, latencyMs, errorType: 'http' };
          throw httpError(res.status, msg);
        }
        const body = await readBody(res);
        const content = body.json?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('provider returned no message content');
        const coerced = coerceJsonContent(content);
        this.lastMeta = {
          requestId: body.json?.id || null,
          model: body.json?.model || model,
          usage: body.json?.usage ? {
            promptTokens: body.json.usage.prompt_tokens,
            completionTokens: body.json.usage.completion_tokens,
            totalTokens: body.json.usage.total_tokens,
          } : null,
          latencyMs,
          httpStatus: 200,
        };
        return coerced;
      };
      try {
        return await breaker.exec(run);
      } catch (err) {
        if (err.code === 'circuit_open') {
          this.lastMeta = { errorType: 'circuit_open', latencyMs: Date.now() - started };
        }
        throw err;
      }
    },
    circuit: () => breaker.snapshot(),
    schema: SEMANTIC_OUTPUT_SCHEMA,
  };
}

module.exports = { createOpenAICompatibleProvider, normalizeBaseUrl, coerceJsonContent };
