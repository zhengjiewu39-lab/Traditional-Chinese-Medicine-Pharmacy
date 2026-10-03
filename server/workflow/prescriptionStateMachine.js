/**
 * Prescription workflow state machine. Every transition names the actor roles that may perform it;
 * the AI and the patient never reach pharmacist-only states.
 *
 * Actor roles: 'system' (intake automation), 'ai' (screening orchestrator), 'pharmacist',
 * 'technician', 'admin', 'patient'.
 */

const STATES = [
  'received',
  'information_incomplete',
  'ai_screening',
  'pharmacist_review_required',
  'pharmacist_approved',
  'pharmacist_rejected',
  'returned_to_prescriber',
  'patient_confirmation_required',
  'patient_confirmed',
  'patient_declined',
  'dispensing',
  'pharmacist_final_check',
  'ready_for_pickup',
  'completed',
];

const PHARMACIST_ONLY_TARGETS = new Set(['pharmacist_approved', 'pharmacist_rejected']);

/** from → to → allowed actor roles */
const TRANSITIONS = {
  received: {
    ai_screening: ['system', 'pharmacist', 'technician', 'admin', 'prescriber'],
    information_incomplete: ['system', 'ai', 'pharmacist', 'technician'],
  },
  information_incomplete: {
    ai_screening: ['system', 'pharmacist', 'technician'],
    pharmacist_review_required: ['pharmacist', 'ai', 'system'],
    returned_to_prescriber: ['pharmacist'],
  },
  ai_screening: {
    pharmacist_review_required: ['ai', 'system'],
    information_incomplete: ['ai', 'system'],
  },
  pharmacist_review_required: {
    pharmacist_approved: ['pharmacist'],
    pharmacist_rejected: ['pharmacist'],
    returned_to_prescriber: ['pharmacist'],
    information_incomplete: ['pharmacist'],
    ai_screening: ['system'],
  },
  pharmacist_approved: {
    patient_confirmation_required: ['pharmacist', 'technician', 'system', 'patient'],
    ai_screening: ['system'],
  },
  pharmacist_rejected: {
    returned_to_prescriber: ['pharmacist'],
  },
  returned_to_prescriber: {
    received: ['system', 'pharmacist', 'technician', 'prescriber'],
  },
  patient_confirmation_required: {
    patient_confirmed: ['patient'],
    patient_declined: ['patient'],
    ai_screening: ['system'],
  },
  patient_confirmed: {
    dispensing: ['pharmacist', 'technician'],
    ai_screening: ['system'],
  },
  patient_declined: {},
  dispensing: {
    pharmacist_final_check: ['pharmacist', 'technician'],
    ai_screening: ['system'],
  },
  pharmacist_final_check: {
    ready_for_pickup: ['pharmacist'],
    dispensing: ['pharmacist'],
    ai_screening: ['system'],
  },
  ready_for_pickup: {
    completed: ['pharmacist', 'technician'],
    ai_screening: ['system'],
  },
  completed: {},
};

/** States after which a content change voids the pharmacist approval. */
const POST_APPROVAL_STATES = new Set([
  'pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed',
  'dispensing', 'pharmacist_final_check', 'ready_for_pickup',
]);

const CONTENT_LOCKED_STATES = new Set(['completed', 'patient_declined']);

class TransitionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Pure check of one transition. Guards that need case data (A3, approval validity, patient decline)
 * are evaluated here from the case snapshot, not from anything the client sends.
 */
function checkTransition(caseRecord, to, actorRole) {
  const from = caseRecord.state;
  if (!STATES.includes(to)) throw new TransitionError('unknown_state', `Unknown state ${to}`);
  const allowed = TRANSITIONS[from]?.[to];
  if (!allowed) throw new TransitionError('invalid_transition', `Transition ${from} → ${to} is not allowed`);
  if (!allowed.includes(actorRole)) {
    throw new TransitionError('actor_not_allowed', `Actor ${actorRole} may not perform ${from} → ${to}`);
  }
  if (PHARMACIST_ONLY_TARGETS.has(to) && actorRole !== 'pharmacist') {
    throw new TransitionError('pharmacist_only', `${to} requires a pharmacist credential; admin role is not sufficient`);
  }
  const latest = caseRecord.analyses?.[caseRecord.analyses.length - 1];
  if (to === 'pharmacist_approved') {
    if (!latest) throw new TransitionError('no_analysis', 'No screening result for the current content');
    if (latest.contentHash !== caseRecord.contentHash) throw new TransitionError('stale_analysis', 'Screening result is for different content');
    if (latest.output.riskTier === 'A3') {
      throw new TransitionError('a3_hard_stop', 'A3 hard stop: return to prescriber or reject; approval is blocked');
    }
  }
  if (to === 'dispensing') {
    if (caseRecord.patientDeclined) throw new TransitionError('patient_declined', 'Patient declined the service');
    if (!caseRecord.approval?.valid || caseRecord.approval.contentHash !== caseRecord.contentHash) {
      throw new TransitionError('approval_invalid', 'No valid pharmacist approval for the current content');
    }
    if (latest?.output?.riskTier === 'A3') throw new TransitionError('a3_hard_stop', 'A3 cases cannot enter dispensing');
  }
  return { from, to };
}

module.exports = {
  STATES,
  TRANSITIONS,
  POST_APPROVAL_STATES,
  CONTENT_LOCKED_STATES,
  PHARMACIST_ONLY_TARGETS,
  TransitionError,
  checkTransition,
};
