const { REGION_TYPES } = require('./scenarioSchema');

/** Deterministic largest-remainder integer split of `total` across positive weights. */
function allocateIntegers(total, weights) {
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (!(wSum > 0) || !weights.length) return weights.map(() => 0);
  const exact = weights.map((w) => (w / wSum) * total);
  const floors = exact.map((x) => Math.floor(x));
  let assigned = floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - floors[i] })).sort((a, b) => b.r - a.r);
  for (let k = 0; assigned < total && k < order.length; k += 1) {
    floors[order[k].i] += 1;
    assigned += 1;
  }
  for (let k = 0; assigned > total && k < order.length; k += 1) {
    const idx = order[order.length - 1 - k].i;
    if (floors[idx] > 0) {
      floors[idx] -= 1;
      assigned -= 1;
    }
  }
  return floors;
}

/**
 * Assign pharmacy populations: ±5% relative jitter per pharmacy within each region,
 * then normalize so the regional sum equals scenario.regions[rt].population exactly.
 */
function assignPharmacyPopulations(pharmacies, scenario, networkRng) {
  const byRegion = {};
  for (const ph of pharmacies) {
    if (!byRegion[ph.regionType]) byRegion[ph.regionType] = [];
    byRegion[ph.regionType].push(ph);
  }
  for (const rt of REGION_TYPES) {
    const list = byRegion[rt] || [];
    if (!list.length) continue;
    const total = scenario.regions[rt].population;
    const weights = list.map(() => 0.95 + networkRng.next() * 0.1);
    const ints = allocateIntegers(total, weights);
    list.forEach((ph, i) => { ph.population = ints[i]; });
  }
}

module.exports = { allocateIntegers, assignPharmacyPopulations };
