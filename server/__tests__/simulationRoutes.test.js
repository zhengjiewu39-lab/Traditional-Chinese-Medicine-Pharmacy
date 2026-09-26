const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const simulationRoutes = require('../routes/simulation');

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/simulation', simulationRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}/api/simulation`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

describe('simulation routes', () => {
  it('GET /meta returns engine and disclaimer', async () => {
    const res = await fetch(`${baseUrl}/meta`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.engineVersion);
    assert.match(body.disclaimer, /synthetic/i);
  });

  it('GET /policies returns four canonical baselines plus ERRRA', async () => {
    const res = await fetch(`${baseUrl}/policies`);
    const body = await res.json();
    const ids = body.policies.map((p) => p.id);
    for (const id of ['fixed-allocation', 'reorder-point', 'cost-first', 'equity-aware']) assert.ok(ids.includes(id));
    assert.ok(ids.includes('equity-constrained-rolling-horizon'));
    assert.strictEqual(ids.length, 5);
  });

  it('POST /scenario/validate clamps invalid days with 200', async () => {
    const res = await fetch(`${baseUrl}/scenario/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulationDays: 99999 }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.valid, true);
    assert.ok(body.scenario.simulationDays <= 365);
  });

  it('POST /run rejects missing policyId', async () => {
    const def = await (await fetch(`${baseUrl}/scenario/default`)).json();
    const res = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: def.scenario }),
    });
    assert.strictEqual(res.status, 400);
  });
});
