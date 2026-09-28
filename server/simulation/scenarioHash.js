/**
 * Canonical JSON and SHA-256 scenario hash.
 *
 * canonicalJson(v):
 *   null → "null"; boolean → "true"/"false"; string → JSON string escaping;
 *   number → finite only; -0 is written as 0; integers and decimals use the shortest round-trip form;
 *   array → elements in their original order; object → keys sorted by UTF-16 code units at every level.
 *   undefined, functions, symbols, bigint, NaN, ±Infinity and non-plain objects (Date, Map, class
 *   instances …) are rejected with a TypeError; cycles are rejected too.
 * Object properties whose value is undefined are rejected rather than dropped, so a hash can never
 * silently ignore a field.
 */

const crypto = require('crypto');

function canonicalJson(value, path = '$', seen = new Set()) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number at ${path}`);
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (t === 'undefined') throw new TypeError(`canonicalJson: undefined at ${path}`);
  if (t === 'function' || t === 'symbol' || t === 'bigint') throw new TypeError(`canonicalJson: ${t} at ${path}`);
  if (seen.has(value)) throw new TypeError(`canonicalJson: cycle at ${path}`);
  seen.add(value);
  let out;
  if (Array.isArray(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i += 1) {
      if (!(i in value)) throw new TypeError(`canonicalJson: sparse array hole at ${path}[${i}]`);
      parts.push(canonicalJson(value[i], `${path}[${i}]`, seen));
    }
    out = `[${parts.join(',')}]`;
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(`canonicalJson: non-plain object at ${path}`);
    }
    const keys = Object.keys(value).sort();
    out = `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k], `${path}.${k}`, seen)}`).join(',')}}`;
  }
  seen.delete(value);
  return out;
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function hashScenario(scenario) {
  return sha256Hex(canonicalJson(scenario));
}

module.exports = { canonicalJson, hashScenario, sha256Hex };
