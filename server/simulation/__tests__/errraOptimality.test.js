const { describe, it } = require('node:test');
const assert = require('node:assert');
const { crossCheck, exhaustive } = require('../validation/exhaustiveStage1');

describe('ERRRA stage 1 vs exhaustive search (small integer instances)', () => {
  it('hand-checked instance: 3 regions, capacity 4', () => {
    const lines = [
      { key: 'L0', regionType: 'urban', warehouseId: 'W1', avail: 3, need: 4 },
      { key: 'L1', regionType: 'suburban', warehouseId: 'W1', avail: 1, need: 4 },
      { key: 'L2', regionType: 'rural', warehouseId: 'W1', avail: 0, need: 4 },
    ];
    // Best: raise rural and suburban to 2/4 each → min SR = 0.5 (urban already 0.75).
    const ex = exhaustive(lines, { W1: 3 }, 1);
    assert.strictEqual(ex.value, 0.5);
  });

  for (const floor of [1, 0.8]) {
    it(`single shared resource, unit steps, floor ${floor}: heuristic is exactly optimal on 300 random instances`, () => {
      const r = crossCheck({ n: 300, seed: 11, warehouses: 1, floor });
      assert.strictEqual(r.exactMatches, r.n, `max gap ${r.maxGap}`);
    });
  }

  it('two warehouse capacities: heuristic is near-optimal (mean gap ≤ 0.03, never above the exact optimum)', () => {
    const r = crossCheck({ n: 300, seed: 12, warehouses: 2, floor: 1 });
    assert.ok(r.rows.every((row) => row.heuristic <= row.exact + 1e-9));
    assert.ok(r.meanGap <= 0.03, `mean gap ${r.meanGap}`);
    assert.ok(r.exactMatches / r.n >= 0.8, `exact ${r.exactMatches}/${r.n}`);
  });
});
