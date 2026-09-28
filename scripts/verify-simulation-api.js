#!/usr/bin/env node
/** Quick smoke test for simulation API (run while server is up). */
const base = process.env.API_BASE || 'http://localhost:3002/api';

async function main() {
  const health = await fetch(`${base.replace(/\/api$/, '')}/api/health`.replace('//api', '/api'));
  const healthJson = await health.json();
  if (!healthJson.features?.includes('supply-simulation-research')) {
    console.error('FAIL: Old server — restart with: npm run restart:server');
    process.exit(1);
  }
  if (healthJson.release !== '1.0.0-research') {
    console.warn(`WARN: release ${healthJson.release} (expected 1.0.0-research)`);
  }
  if ((healthJson.simulationRouteVersion ?? 1) < 2) {
    console.error('FAIL: Simulation API v1 only (missing presets/run-group). Run: npm run restart:server');
    process.exit(1);
  }

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await login.json();
  if (!token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };
  for (const path of [
    '/simulation/meta',
    '/simulation/scenario/default',
    '/simulation/scenario/presets',
    '/simulation/policies',
    '/simulation/experiments',
  ]) {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) {
      console.error(`FAIL ${path} HTTP ${res.status}`);
      process.exit(1);
    }
    console.log(`OK ${path}`);
  }
  console.log('All simulation endpoints OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
