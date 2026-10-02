/**
 * The AI pharmacy layer must not change frozen paper results: re-run a sample of main-matrix
 * cells and compare every column with paper/results/main/records.csv (tag v1.0.0-research).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../../scripts/paper/lib');

const ROOT = path.join(__dirname, '../..');
const CELLS = [
  { scenario: 'M5-compound', policy: 'equity-constrained-rolling-horizon' },
  { scenario: 'M5-compound', policy: 'cost-first' },
  { scenario: 'M1-normal', policy: 'fixed-allocation' },
];
const SEEDS = [100001, 100002, 100003];

function loadRecords() {
  const [header, ...lines] = fs.readFileSync(path.join(ROOT, 'paper/results/main/records.csv'), 'utf8').trim().split('\n');
  const cols = header.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

const format = (v) => (v == null ? '' : typeof v === 'number' ? String(Number.isInteger(v) ? v : Number(v.toPrecision(10))) : String(v));

describe('paper regression', () => {
  const frozen = loadRecords();
  const matrix = L.loadMatrix();
  for (const cell of CELLS) {
    it(`${cell.scenario} × ${cell.policy} reproduces frozen records`, () => {
      const sc = matrix.scenarios.find((s) => s.key === cell.scenario);
      for (const seed of SEEDS) {
        const expected = frozen.find((r) => r.scenario === cell.scenario && r.policy === cell.policy && Number(r.seed) === seed);
        assert.ok(expected, `frozen record missing for ${seed}`);
        const rec = L.runRecord({ scenario: sc.scenario, scenarioKey: sc.key, policyId: cell.policy, seed });
        for (const [k, v] of Object.entries(expected)) {
          assert.strictEqual(format(rec[k]), v, `${cell.scenario}/${cell.policy}/${seed}: ${k}`);
        }
      }
    });
  }
});
