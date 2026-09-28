/**
 * OpenAI-compatible chat completions client (any endpoint exposing /chat/completions).
 * The API key is read from the environment, sent only in the Authorization header and never logged.
 */
function createOpenAICompatibleProvider({
  baseUrl = process.env.AI_BASE_URL,
  apiKey = process.env.AI_API_KEY,
  model = process.env.AI_MODEL,
  fetchImpl = fetch,
} = {}) {
  if (!baseUrl || !model) throw new Error('AI_BASE_URL and AI_MODEL are required for the openai-compatible provider');
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return {
    id: 'openai-compatible',
    isMock: false,
    modelVersion: model,
    endpointHost: new URL(endpoint).host,
    async complete({ messages, signal }) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`provider HTTP ${res.status}`);
      const body = await res.json();
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('provider returned no message content');
      return content;
    },
  };
}

module.exports = { createOpenAICompatibleProvider };
