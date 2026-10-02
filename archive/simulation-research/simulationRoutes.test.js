const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-exp-'));
process.env.SIMULATION_DATA_DIR = tmpDir;
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
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const post = (p, body) => fetch(`${baseUrl}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const tiny = { simulationDays: 12, pharmacyCount: 6, regionPharmacyCounts: { urban: 2, suburban: 2, rural: 2 }, events: [] };

async function waitFor(jobId, done = ['completed', 'failed', 'cancelled']) {
  for (let i = 0; i < 300; i += 1) {
    const job = await (await fetch(`${baseUrl}/jobs/${jobId}`)).json();
    if (done.includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('job did not finish');
}

describe('simulation routes', () => {
  it('GET /meta returns engine and disclaimer', async () => {
    const res = await fetch(`${baseUrl}/meta`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.engineVersion);
    assert.match(body.disclaimer, /synthetic/i);
  });

  it('GET /policies returns four canonical baselines plus ERRRA, and the ablations separately', async () => {
    const res = await fetch(`${baseUrl}/policies`);
    const body = await res.json();
    const ids = body.policies.map((p) => p.id);
    for (const id of ['fixed-allocation', 'reorder-point', 'cost-first', 'equity-aware']) assert.ok(ids.includes(id));
    assert.ok(ids.includes('equity-constrained-rolling-horizon'));
    assert.strictEqual(ids.length, 5);
    assert.ok(body.ablations.some((a) => a.id === 'errra-no-transfers'));
  });

  it('POST /scenario/validate reports out-of-range days as invalid (no clamping)', async () => {
    const res = await post('/scenario/validate', { simulationDays: 99999 });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.valid, false);
    assert.ok(body.errors.some((e) => e.path === 'simulationDays'));
  });

  it('POST /run rejects missing policyId, invalid replicates and unknown fields with 400', async () => {
    assert.strictEqual((await post('/run', { scenario: tiny })).status, 400);
    assert.strictEqual((await post('/run', { scenario: tiny, policyId: 'cost-first', replicates: 0 })).status, 400);
    assert.strictEqual((await post('/run', { scenario: tiny, policyId: 'cost-first', replicates: 2.5 })).status, 400);
    assert.strictEqual((await post('/run', { scenario: tiny, policyId: 'cost-first', replicates: 10000 })).status, 400);
    assert.strictEqual((await post('/run', { scenario: tiny, policyId: 'cost-first', extra: 1 })).status, 400);
    assert.strictEqual((await post('/run', { scenario: { simulationDays: -1 }, policyId: 'cost-first' })).status, 400);
  });

  it('POST /run-group rejects unknown or duplicate policyIds instead of skipping them', async () => {
    const unknown = await post('/run-group', { scenario: tiny, policyIds: ['cost-first', 'no-such-policy'], replicates: 2 });
    assert.strictEqual(unknown.status, 400);
    assert.ok((await unknown.json()).errors.some((e) => /no-such-policy/.test(e)));
    assert.strictEqual((await post('/run-group', { scenario: tiny, policyIds: ['cost-first', 'cost-only'], replicates: 2 })).status, 400);
    assert.strictEqual((await post('/run-group', { scenario: tiny, policyIds: [], replicates: 2 })).status, 400);
  });

  it('ids outside the whitelist are rejected with 400', async () => {
    assert.strictEqual((await fetch(`${baseUrl}/experiments/..%2F..%2Fpackage`)).status, 400);
    assert.strictEqual((await fetch(`${baseUrl}/experiments/exp_1_x`)).status, 400);
    assert.strictEqual((await fetch(`${baseUrl}/jobs/abc`)).status, 400);
    assert.strictEqual((await fetch(`${baseUrl}/experiments/exp_1700000000000_0123abcd`)).status, 404);
  });

  it('a group job runs in a worker thread, reports progress and stores paired bootstrap comparisons', async () => {
    const res = await post('/run-group', { scenario: tiny, policyIds: ['cost-first', 'ERRRA'], replicates: 3 });
    assert.strictEqual(res.status, 202);
    const { jobId } = await res.json();
    const job = await waitFor(jobId);
    assert.strictEqual(job.status, 'completed', job.error);
    assert.strictEqual(job.progress.completedRuns, 6);
    assert.strictEqual(job.experimentIds.length, 2);
    const exp = await (await fetch(`${baseUrl}/experiments/${job.experimentIds[0]}`)).json();
    assert.strictEqual(exp.replicates, 3);
    const pair = exp.groupSummary.pairedComparisons.pairs[0];
    assert.strictEqual(pair.pairedReplicates, 3);
    assert.ok(pair.metrics.worstRegionEssentialFillRate.bootstrapSeed != null);
    assert.ok('priceOfEquity' in exp.groupSummary.pairedComparisons);
  });

  it('a queued or running job can be cancelled', async () => {
    const long = { ...tiny, simulationDays: 365, pharmacyCount: 30, regionPharmacyCounts: { urban: 10, suburban: 10, rural: 10 } };
    const a = await (await post('/run-group', { scenario: long, policyIds: ['cost-first'], replicates: 50 })).json();
    const b = await (await post('/run-group', { scenario: long, policyIds: ['cost-first'], replicates: 50 })).json();
    const cb = await (await post(`/jobs/${b.jobId}/cancel`, {})).json();
    assert.strictEqual(cb.status, 'cancelled');
    await (await post(`/jobs/${a.jobId}/cancel`, {})).json();
    const ja = await waitFor(a.jobId);
    assert.strictEqual(ja.status, 'cancelled');
  });
});
