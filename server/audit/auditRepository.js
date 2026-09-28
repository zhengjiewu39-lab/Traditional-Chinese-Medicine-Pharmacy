const fs = require('fs');
const path = require('path');
const { hashObject, randomId } = require('../common/hash');
const { aiDataDir, ensureDir } = require('../common/jsonFileStore');
const {
  GENESIS_HASH, ACTOR_TYPES, PATIENT_VISIBLE_EVENTS, computeEventHash, verifyChain,
} = require('./auditChain');
const { redactForLog } = require('../ai/redaction');

/**
 * Append-only audit log (one JSON event per line). There is no update or delete operation;
 * every record links to the previous record's hash.
 */
let cache = null;
let cachedFor = null;

const filePath = () => path.join(aiDataDir(), 'audit-chain.jsonl');

function loadAll() {
  const p = filePath();
  if (cache && cachedFor === p) return cache;
  ensureDir(path.dirname(p));
  cache = fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  cachedFor = p;
  return cache;
}

function append({
  caseId = null, eventType, actorType, actorId, payload = {}, modelVersion = null, ruleSetVersion = null, knowledgeBaseVersion = null,
}) {
  if (!ACTOR_TYPES.includes(actorType)) throw new Error(`invalid actorType ${actorType}`);
  if (!eventType) throw new Error('eventType required');
  const events = loadAll();
  const safePayload = redactForLog(payload);
  const event = {
    eventId: randomId('evt'),
    caseId,
    eventType,
    actorType,
    actorId: String(actorId ?? 'unknown'),
    timestamp: new Date().toISOString(),
    payload: safePayload,
    payloadHash: hashObject(safePayload),
    previousHash: events.length ? events[events.length - 1].eventHash : GENESIS_HASH,
    modelVersion,
    ruleSetVersion,
    knowledgeBaseVersion,
  };
  event.eventHash = computeEventHash(event);
  fs.appendFileSync(filePath(), `${JSON.stringify(event)}\n`);
  events.push(event);
  return event;
}

function forCase(caseId, { audience = 'staff' } = {}) {
  const list = loadAll().filter((e) => e.caseId === caseId);
  if (audience !== 'patient') return list;
  return list
    .filter((e) => PATIENT_VISIBLE_EVENTS.has(e.eventType))
    .map((e) => ({
      eventType: e.eventType,
      timestamp: e.timestamp,
      actorType: e.actorType === 'ai' ? 'system' : e.actorType,
      summary: e.payload?.patientSummary || e.payload?.to || null,
    }));
}

function verify() {
  return verifyChain(loadAll());
}

function all() {
  return loadAll();
}

function resetCache() {
  cache = null;
  cachedFor = null;
}

module.exports = {
  append, forCase, verify, all, resetCache, filePath,
};
