/** Label maps store i18n keys. Render with t(STATE_LABELS[state]). */

export const AI_LABEL = 'ai.generated';
export const SYNTHETIC_LABEL = 'ai.synthetic';

export const STATE_LABELS = {
  received: 'ai.state.received',
  information_incomplete: 'ai.state.information_incomplete',
  ai_screening: 'ai.state.ai_screening',
  pharmacist_review_required: 'ai.state.pharmacist_review_required',
  pharmacist_approved: 'ai.state.pharmacist_approved',
  pharmacist_rejected: 'ai.state.pharmacist_rejected',
  returned_to_prescriber: 'ai.state.returned_to_prescriber',
  patient_confirmation_required: 'ai.state.patient_confirmation_required',
  patient_confirmed: 'ai.state.patient_confirmed',
  patient_declined: 'ai.state.patient_declined',
  dispensing: 'ai.state.dispensing',
  pharmacist_final_check: 'ai.state.pharmacist_final_check',
  ready_for_pickup: 'ai.state.ready_for_pickup',
  completed: 'ai.state.completed',
  center_record: 'ai.state.center_record',
};

export const STATE_COLORS = {
  information_incomplete: 'warning',
  pharmacist_review_required: 'info',
  pharmacist_approved: 'success',
  pharmacist_rejected: 'error',
  returned_to_prescriber: 'error',
  patient_confirmation_required: 'secondary',
  patient_declined: 'default',
  pharmacist_final_check: 'info',
  ready_for_pickup: 'success',
  completed: 'default',
};

export const TIER_LABELS = {
  A0: 'ai.tier.A0',
  A1: 'ai.tier.A1',
  A2: 'ai.tier.A2',
  A3: 'ai.tier.A3',
};

export const TIER_COLORS = { A0: 'default', A1: 'success', A2: 'warning', A3: 'error' };

export const RECOMMENDATION_LABELS = {
  pass_to_pharmacist: 'ai.recommendation.pass_to_pharmacist',
  clarification_required: 'ai.recommendation.clarification_required',
  hard_stop: 'ai.recommendation.hard_stop',
  refer_to_prescriber: 'ai.recommendation.refer_to_prescriber',
};

export const OVERRIDE_REASONS = [
  { value: 'false_positive', labelKey: 'ai.override.false_positive' },
  { value: 'patient_context', labelKey: 'ai.override.patient_context' },
  { value: 'evidence_outdated', labelKey: 'ai.override.evidence_outdated' },
  { value: 'rule_not_applicable', labelKey: 'ai.override.rule_not_applicable' },
  { value: 'model_misinterpretation', labelKey: 'ai.override.model_misinterpretation' },
  { value: 'other', labelKey: 'ai.override.other' },
];

export const ABSTAIN_REASON_LABELS = {
  model_unavailable: 'ai.abstain.model_unavailable',
  ai_disabled_by_kill_switch: 'ai.abstain.ai_disabled_by_kill_switch',
  model_timeout: 'ai.abstain.model_timeout',
  model_error: 'ai.abstain.model_error',
  schema_invalid: 'ai.abstain.schema_invalid',
  prompt_injection_suspected: 'ai.abstain.prompt_injection_suspected',
  input_too_long: 'ai.abstain.input_too_long',
  citation_not_found: 'ai.abstain.citation_not_found',
  autonomous_clinical_output: 'ai.abstain.autonomous_clinical_output',
  prescription_modification_attempt: 'ai.abstain.prescription_modification_attempt',
  key_information_missing: 'ai.abstain.key_information_missing',
  no_evidence: 'ai.abstain.no_evidence',
  hard_rule_model_conflict: 'ai.abstain.hard_rule_model_conflict',
};

export const SEMANTIC_STATUS_LABELS = {
  ok: 'ai.semantic.ok',
  disabled: 'ai.semantic.disabled',
  disabled_by_kill_switch: 'ai.semantic.disabled_by_kill_switch',
  timeout: 'ai.semantic.timeout',
  error: 'ai.semantic.error',
  schema_invalid: 'ai.semantic.schema_invalid',
  policy_violation: 'ai.semantic.policy_violation',
  skipped_injection: 'ai.semantic.skipped_injection',
  skipped_input_too_long: 'ai.semantic.skipped_input_too_long',
  circuit_open: 'ai.semantic.circuit_open',
};

export const DISPLAY_SOURCE_LABELS = {
  rules: 'ai.displaySource.rules',
  live_model: 'ai.displaySource.live_model',
  mock: 'ai.displaySource.mock',
  shadow_model: 'ai.displaySource.shadow_model',
  degraded_rules: 'ai.displaySource.degraded_rules',
};

export const DISPOSITION_REASONS = [
  { value: 'clinically_appropriate', labelKey: 'ai.disposition.clinically_appropriate' },
  { value: 'patient_specific', labelKey: 'ai.disposition.patient_specific' },
  { value: 'evidence_insufficient', labelKey: 'ai.disposition.evidence_insufficient' },
  { value: 'wrong_context', labelKey: 'ai.disposition.wrong_context' },
  { value: 'dose_adjusted_instead', labelKey: 'ai.disposition.dose_adjusted_instead' },
  { value: 'already_addressed', labelKey: 'ai.disposition.already_addressed' },
  { value: 'disagrees_with_experience', labelKey: 'ai.disposition.disagrees_with_experience' },
  { value: 'other', labelKey: 'ai.disposition.other' },
];
