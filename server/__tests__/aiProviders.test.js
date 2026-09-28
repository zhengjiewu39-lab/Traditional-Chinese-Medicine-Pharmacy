const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const { createOpenAICompatibleProvider } = require('../ai/openAICompatibleProvider');
const { screenOutput } = require('../ai/safetyPolicy');

const FAKE_KEY = 'sk-test-DO-NOT-LOG-0123456789abcdef';

function stubFetch(response) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return { impl, calls };
}

describe('openai-compatible provider', () => {
  it('requires base URL and model', () => {
    assert.throws(() => createOpenAICompatibleProvider({ baseUrl: '', model: '' }), /AI_BASE_URL and AI_MODEL/);
  });

  it('posts deterministic JSON-mode requests and returns message content', async () => {
    const { impl, calls } = stubFetch({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) });
    const p = createOpenAICompatibleProvider({ baseUrl: 'https://llm.example.test/v1/', apiKey: FAKE_KEY, model: 'm-1', fetchImpl: impl });
    assert.strictEqual(p.isMock, false);
    assert.strictEqual(p.endpointHost, 'llm.example.test');
    const out = await p.complete({ messages: [{ role: 'user', content: 'x' }] });
    assert.strictEqual(out, '{"ok":true}');
    assert.strictEqual(calls[0].url, 'https://llm.example.test/v1/chat/completions');
    const body = JSON.parse(calls[0].init.body);
    assert.strictEqual(body.temperature, 0);
    assert.deepStrictEqual(body.response_format, { type: 'json_object' });
    assert.strictEqual(calls[0].init.headers.Authorization, `Bearer ${FAKE_KEY}`);
    assert.ok(!calls[0].init.body.includes(FAKE_KEY), 'key is only sent in the header');
  });

  it('never puts the API key into errors or the provider description', async () => {
    const { impl } = stubFetch({ ok: false, status: 401, json: async () => ({}) });
    const p = createOpenAICompatibleProvider({ baseUrl: 'https://llm.example.test/v1', apiKey: FAKE_KEY, model: 'm-1', fetchImpl: impl });
    await assert.rejects(p.complete({ messages: [] }), (err) => !err.message.includes(FAKE_KEY) && /HTTP 401/.test(err.message));
    assert.ok(!JSON.stringify(p).includes(FAKE_KEY));
  });

  it('does not send json_schema to DeepSeek and strips fenced JSON', async () => {
    const { impl, calls } = stubFetch({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }),
    });
    const p = createOpenAICompatibleProvider({
      baseUrl: 'https://api.deepseek.com/v1', apiKey: FAKE_KEY, model: 'deepseek-chat', fetchImpl: impl,
    });
    const out = await p.complete({
      messages: [{ role: 'user', content: 'x' }],
      jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    });
    assert.strictEqual(out, '{"ok":true}');
    const body = JSON.parse(calls[0].init.body);
    assert.deepStrictEqual(body.response_format, { type: 'json_object' });
  });

  it('retries without response_format when the host rejects it', async () => {
    const calls = [];
    const impl = async (url, init) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) {
        return { ok: false, status: 400, json: async () => ({ error: { message: 'invalid response_format' } }) };
      }
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
    };
    const p = createOpenAICompatibleProvider({
      baseUrl: 'https://api.deepseek.com/v1', apiKey: FAKE_KEY, model: 'deepseek-chat', fetchImpl: impl,
    });
    const out = await p.complete({ messages: [{ role: 'user', content: 'x' }] });
    assert.strictEqual(out, '{"ok":true}');
    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0].response_format);
    assert.ok(!calls[1].response_format);
  });

  it('strips a pasted /chat/completions suffix from the base URL', async () => {
    const { impl, calls } = stubFetch({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) });
    const p = createOpenAICompatibleProvider({
      baseUrl: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', fetchImpl: impl,
    });
    await p.complete({ messages: [] });
    assert.strictEqual(calls[0].url, 'https://api.deepseek.com/v1/chat/completions');
  });

  it('rejects responses without message content', async () => {
    const { impl } = stubFetch({ ok: true, json: async () => ({ choices: [] }) });
    const p = createOpenAICompatibleProvider({ baseUrl: 'https://llm.example.test/v1', model: 'm-1', fetchImpl: impl });
    await assert.rejects(p.complete({ messages: [] }), /no message content/);
  });
});

describe('output safety policy', () => {
  const ctx = (herbs) => ({ canonicalHerbs: herbs, allowedEvidenceIds: new Set() });

  it('accepts a duplicated herb echoed with either entered dose', () => {
    const herbs = [{ name: '甘草', dosage: 6 }, { name: '甘草', dosage: 3 }];
    const res = screenOutput({ structuredPrescription: { herbs: [{ name: '甘草', dosage: 6 }, { name: '甘草', dosage: 3 }] } }, ctx(herbs));
    assert.deepStrictEqual(res.violations, []);
  });

  it('still flags a changed dose and an added herb', () => {
    const herbs = [{ name: '甘草', dosage: 6 }, { name: '甘草', dosage: 3 }];
    const res = screenOutput({ structuredPrescription: { herbs: [{ name: '甘草', dosage: 9 }, { name: '附子', dosage: 3 }] } }, ctx(herbs));
    assert.deepStrictEqual(res.violations.map((v) => v.code).sort(), ['dose_changed', 'herb_added']);
  });
});

describe('offline AI evaluation', () => {
  it('runs the synthetic benchmark and passes every safety gate', () => {
    const run = spawnSync(process.execPath, [path.join(__dirname, '../../scripts/ai/evaluate.js'), '--no-write'], { encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /Not a clinical validation/);
    assert.match(run.stdout, /unsafe=0/);
    assert.doesNotMatch(run.stdout, /^FAIL /m);
  });
});
