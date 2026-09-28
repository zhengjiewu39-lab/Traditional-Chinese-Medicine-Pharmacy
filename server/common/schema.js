/**
 * Validator for a JSON Schema subset: type (incl. arrays of types), enum, const, required,
 * properties, additionalProperties:false, items, minItems, maxItems, minLength, maxLength,
 * minimum, maximum, pattern, format 'date' | 'date-time' | 'sha256'.
 * Returns every error with a JSON path; never coerces values.
 */

const FORMATS = {
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)),
  'date-time': (v) => !Number.isNaN(Date.parse(v)) && /T/.test(v),
  sha256: (v) => /^[0-9a-f]{64}$/.test(v),
};

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function validate(schema, value, path = '$', errors = []) {
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push({ path, code: 'type', message: `expected ${types.join('|')}, got ${typeOf(value)}` });
      return errors;
    }
  }
  if (schema.const !== undefined && value !== schema.const) errors.push({ path, code: 'const', message: `must equal ${schema.const}` });
  if (schema.enum && !schema.enum.includes(value)) errors.push({ path, code: 'enum', message: `must be one of ${schema.enum.join(', ')}` });
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push({ path, code: 'minLength', message: `shorter than ${schema.minLength}` });
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push({ path, code: 'maxLength', message: `longer than ${schema.maxLength}` });
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push({ path, code: 'pattern', message: `does not match ${schema.pattern}` });
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format](value)) errors.push({ path, code: 'format', message: `not a valid ${schema.format}` });
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push({ path, code: 'minimum', message: `below ${schema.minimum}` });
    if (schema.maximum != null && value > schema.maximum) errors.push({ path, code: 'maximum', message: `above ${schema.maximum}` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push({ path, code: 'minItems', message: `fewer than ${schema.minItems} items` });
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push({ path, code: 'maxItems', message: `more than ${schema.maxItems} items` });
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required || []) {
      if (value[k] === undefined) errors.push({ path: `${path}.${k}`, code: 'required', message: 'is required' });
    }
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(props[k], v, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push({ path: `${path}.${k}`, code: 'additional', message: 'is not allowed' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validate(schema.additionalProperties, v, `${path}.${k}`, errors);
      }
    }
  }
  return errors;
}

function check(schema, value) {
  const errors = validate(schema, value);
  return { valid: errors.length === 0, errors };
}

module.exports = { validate, check };
