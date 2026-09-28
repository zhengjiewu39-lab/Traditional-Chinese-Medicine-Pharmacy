/** Validation of simulation API request fields. Invalid input is rejected (HTTP 400), never clamped or skipped. */

const { resolvePolicyId } = require('./policyEngine');

const MAX_REPLICATES = 500;
const MAX_POLICIES_PER_GROUP = 20;
const EXPERIMENT_ID_RE = /^exp_\d{13}_[0-9a-f]{8}$/;
const GROUP_ID_RE = /^grp_\d{13}_[0-9a-f]{8}$/;
const JOB_ID_RE = /^(exp|grp)_\d{13}_[0-9a-f]{8}$/;

function parseReplicates(value, { defaultValue = 1, max = MAX_REPLICATES } = {}) {
  if (value === undefined) return { value: defaultValue };
  if (!Number.isInteger(value) || value < 1 || value > max) {
    return { error: `replicates must be an integer in [1, ${max}]` };
  }
  return { value };
}

function parsePolicyId(value) {
  if (typeof value !== 'string' || !value) return { error: 'policyId is required and must be a string' };
  const canonical = resolvePolicyId(value);
  if (!canonical) return { error: `Unknown policyId: ${value}` };
  return { value: canonical };
}

function parsePolicyIds(value) {
  if (!Array.isArray(value) || !value.length) return { errors: ['policyIds must be a non-empty array'] };
  if (value.length > MAX_POLICIES_PER_GROUP) return { errors: [`at most ${MAX_POLICIES_PER_GROUP} policyIds`] };
  const errors = [];
  const seen = new Map();
  const out = [];
  for (const id of value) {
    const r = parsePolicyId(id);
    if (r.error) { errors.push(r.error); continue; }
    if (seen.has(r.value)) { errors.push(`Duplicate policyId: ${id} (same policy as ${seen.get(r.value)})`); continue; }
    seen.set(r.value, id);
    out.push(r.value);
  }
  return errors.length ? { errors } : { value: out };
}

function rejectUnknownKeys(body, allowed) {
  if (body == null) return [];
  if (typeof body !== 'object' || Array.isArray(body)) return ['request body must be a JSON object'];
  return Object.keys(body).filter((k) => !allowed.includes(k)).map((k) => `Unknown field: ${k}`);
}

const isExperimentId = (id) => typeof id === 'string' && EXPERIMENT_ID_RE.test(id);
const isGroupId = (id) => typeof id === 'string' && GROUP_ID_RE.test(id);
const isJobId = (id) => typeof id === 'string' && JOB_ID_RE.test(id);

module.exports = {
  MAX_REPLICATES,
  MAX_POLICIES_PER_GROUP,
  EXPERIMENT_ID_RE,
  GROUP_ID_RE,
  JOB_ID_RE,
  parseReplicates,
  parsePolicyId,
  parsePolicyIds,
  rejectUnknownKeys,
  isExperimentId,
  isGroupId,
  isJobId,
};
