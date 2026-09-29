/**
 * Reproducible stratified sampling. Same seed + same eligible set → same picks.
 */
const { sha256 } = require('../common/hash');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(value) {
  const hex = sha256(String(value)).slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Stratify by `keyFn`, take ceil(stratum.length * rate) from each (at least 1 if stratum nonempty and rate>0).
 */
function stratifiedSample(items, { rate = 0.1, seed, keyFn }) {
  const rng = mulberry32(seedFrom(seed));
  const groups = new Map();
  for (const item of items) {
    const k = keyFn(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  const picked = [];
  for (const [, group] of [...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))) {
    const n = group.length && rate > 0 ? Math.max(1, Math.ceil(group.length * rate)) : 0;
    picked.push(...shuffle(group, rng).slice(0, n));
  }
  return picked;
}

module.exports = { mulberry32, seedFrom, shuffle, stratifiedSample };
