/**
 * Cross-model check for ERRRA stage 1 on small instances.
 *
 * Problem (integer):  max_x  min_r  min(φ, SR_r(x))
 *   SR_r(x) = Σ_{l∈r} min(a_l + x_l, n_l) / Σ_{l∈r} n_l
 *   s.t.  Σ_{l∈w} x_l ≤ C_w  for each warehouse w,   0 ≤ x_l ≤ n_l − a_l,  x_l ∈ ℤ
 *
 * Solved exactly by enumeration and compared with waterFillStage1 (batch size 1, β = 0).
 */

const { waterFillStage1 } = require('../errra');
const { createRng } = require('../rng');

const REGIONS = ['urban', 'suburban', 'rural'];

function objective(lines, x, floor) {
  let worst = Infinity;
  for (const r of REGIONS) {
    const rl = lines.filter((l) => l.regionType === r);
    const need = rl.reduce((s, l) => s + l.need, 0);
    if (need <= 0) continue;
    const cov = rl.reduce((s, l) => s + Math.min(l.avail + x[lines.indexOf(l)], l.need), 0);
    worst = Math.min(worst, Math.min(floor, cov / need));
  }
  return worst === Infinity ? floor : worst;
}

function exhaustive(lines, caps, floor) {
  const ub = lines.map((l) => Math.max(0, l.need - l.avail));
  const x = lines.map(() => 0);
  const used = Object.fromEntries(Object.keys(caps).map((w) => [w, 0]));
  let best = -Infinity;
  let bestX = null;
  const rec = (i) => {
    if (i === lines.length) {
      const v = objective(lines, x, floor);
      if (v > best + 1e-12) { best = v; bestX = [...x]; }
      return;
    }
    const w = lines[i].warehouseId;
    const room = Math.min(ub[i], caps[w] - used[w]);
    for (let q = 0; q <= room; q += 1) {
      x[i] = q;
      used[w] += q;
      rec(i + 1);
      used[w] -= q;
    }
    x[i] = 0;
  };
  rec(0);
  return { value: best, x: bestX };
}

function randomInstance(rng, { warehouses = 1, linesPerRegion = [1, 2], maxNeed = 8, maxCap = 12 } = {}) {
  const whIds = Array.from({ length: warehouses }, (_, i) => `W${i + 1}`);
  const lines = [];
  let idx = 0;
  for (const r of REGIONS) {
    const n = rng.int(linesPerRegion[0], linesPerRegion[1]);
    for (let k = 0; k < n; k += 1) {
      const need = rng.int(2, maxNeed);
      lines.push({
        key: `L${idx}`,
        regionType: r,
        warehouseId: whIds[rng.int(0, warehouses - 1)],
        drugId: 'D1',
        v: 1,
        avail: rng.int(0, need - 1),
        need,
        pharmacyIndex: idx,
      });
      idx += 1;
    }
  }
  const caps = Object.fromEntries(whIds.map((w) => [w, rng.int(1, maxCap)]));
  return { lines, caps };
}

function heuristic(lines, caps, floor) {
  const capRemaining = { ...caps };
  const stockRemaining = Object.fromEntries(Object.keys(caps).map((w) => [w, { D1: 1e9 }]));
  const s1 = waterFillStage1(lines.map((l) => ({ ...l })), capRemaining, stockRemaining, {
    serviceFloor: floor,
    beta: 0,
    batchFraction: 0,
  });
  const x = lines.map((l) => s1.alloc.get(l.key) || 0);
  return { value: objective(lines, x, floor), x };
}

/** Runs n random instances and returns per-instance optimality gaps (exact − heuristic ≥ 0). */
function crossCheck({ n = 200, seed = 7, warehouses = 1, floor = 1, ...opts } = {}) {
  const rng = createRng(seed);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const inst = randomInstance(rng, { warehouses, ...opts });
    const ex = exhaustive(inst.lines, inst.caps, floor);
    const h = heuristic(inst.lines, inst.caps, floor);
    rows.push({ instance: i, exact: ex.value, heuristic: h.value, gap: Math.max(0, ex.value - h.value) });
  }
  const gaps = rows.map((r) => r.gap);
  return {
    n,
    warehouses,
    floor,
    exactMatches: gaps.filter((g) => g <= 1e-9).length,
    meanGap: gaps.reduce((a, b) => a + b, 0) / n,
    maxGap: Math.max(...gaps),
    rows,
  };
}

module.exports = { exhaustive, heuristic, randomInstance, crossCheck, objective };
