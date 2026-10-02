/**
 * Seeded pseudo-random number generator (Mulberry32).
 * All simulation randomness must flow through this module.
 */

function hashSeed(seed) {
  const s = String(seed ?? 0);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function createRng(seed = 42) {
  let state = hashSeed(seed);
  return {
    seed: hashSeed(seed),
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return Math.floor(this.next() * (hi - lo + 1)) + lo;
    },
    pick(arr) {
      if (!arr?.length) return undefined;
      return arr[Math.floor(this.next() * arr.length)];
    },
    normal(mean = 0, std = 1) {
      const u1 = this.next() || 1e-10;
      const u2 = this.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    },
  };
}

module.exports = { createRng, hashSeed };
