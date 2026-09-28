const { hashObject } = require('../common/hash');

const GENESIS_HASH = '0'.repeat(64);

const ACTOR_TYPES = ['ai', 'pharmacist', 'patient', 'admin', 'system', 'technician', 'researcher'];

/** Event types a patient may see about their own case. */
const PATIENT_VISIBLE_EVENTS = new Set([
  'case_received',
  'patient_confirmation_requested',
  'patient_confirmed',
  'patient_declined',
  'patient_feedback_submitted',
  'state_transition',
]);

function eventBody(e) {
  return {
    eventId: e.eventId,
    caseId: e.caseId,
    eventType: e.eventType,
    actorType: e.actorType,
    actorId: e.actorId,
    timestamp: e.timestamp,
    payloadHash: e.payloadHash,
    previousHash: e.previousHash,
    modelVersion: e.modelVersion ?? null,
    ruleSetVersion: e.ruleSetVersion ?? null,
    knowledgeBaseVersion: e.knowledgeBaseVersion ?? null,
  };
}

function computeEventHash(e) {
  return hashObject(eventBody(e));
}

/**
 * Recompute every link: payload hash, event hash and the previous-hash pointer.
 * Any edit, deletion or reordering of a historical record makes verification fail.
 */
function verifyChain(events) {
  let previous = GENESIS_HASH;
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (e.previousHash !== previous) return { valid: false, brokenAt: i, reason: 'previous_hash_mismatch', eventId: e.eventId };
    if (hashObject(e.payload ?? null) !== e.payloadHash) return { valid: false, brokenAt: i, reason: 'payload_hash_mismatch', eventId: e.eventId };
    if (computeEventHash(e) !== e.eventHash) return { valid: false, brokenAt: i, reason: 'event_hash_mismatch', eventId: e.eventId };
    previous = e.eventHash;
  }
  return { valid: true, length: events.length, headHash: previous };
}

module.exports = {
  GENESIS_HASH, ACTOR_TYPES, PATIENT_VISIBLE_EVENTS, computeEventHash, verifyChain, eventBody,
};
