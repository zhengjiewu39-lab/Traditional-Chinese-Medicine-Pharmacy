/** Request schemas for the prescription workflow API. Unknown fields are rejected. */

const str = (max, extra = {}) => ({ type: 'string', maxLength: max, ...extra });
const strList = (maxItems, maxLen = 100) => ({ type: 'array', maxItems, items: str(maxLen) });
const TRI = { type: 'string', enum: ['yes', 'no', 'unknown'] };

const HERB = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: str(40, { minLength: 1 }),
    dosage: { type: ['number', 'null'], minimum: 0, maximum: 1000 },
    unit: { type: 'string', enum: ['g', 'ml', '丸', '片', '袋'] },
    processing: str(40),
    note: str(100),
  },
};

const PATIENT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patientRef: str(40),
    name: str(40),
    phone: str(20),
    ageYears: { type: 'number', minimum: 0, maximum: 120 },
    sex: { type: 'string', enum: ['male', 'female', 'unknown'] },
    weightKg: { type: 'number', minimum: 0.5, maximum: 300 },
    pregnancy: TRI,
    lactation: TRI,
    allergies: strList(30),
    allergySeverity: { type: 'string', enum: ['severe', 'mild', 'unknown'] },
    liverImpairment: { type: 'boolean' },
    renalImpairment: { type: 'boolean' },
    currentMedications: strList(30),
    identityVerified: { type: 'boolean' },
  },
};

const PRESCRIBER = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: str(40),
    name: str(40),
    institution: str(80),
    licenseVerified: { type: 'boolean' },
  },
};

const PRESCRIPTION = {
  type: 'object',
  additionalProperties: false,
  properties: {
    herbs: { type: 'array', maxItems: 60, items: HERB },
    doseCount: { type: 'integer', minimum: 1, maximum: 60 },
    frequency: str(60),
    usage: str(120),
    form: { type: 'string', enum: ['decoction', 'granule', 'pill', 'powder', 'other'] },
    decoctionNotes: str(300),
    issuedAt: { type: 'string', format: 'date' },
    diagnosisText: str(200),
    prescriberAttestations: strList(20, 80),
  },
};

const CREATE_CASE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: {
      type: 'object',
      additionalProperties: false,
      properties: {
        channel: { type: 'string', enum: ['counter', 'e_prescription', 'scan', 'imported'] },
        rawText: str(4000),
      },
    },
    patient: PATIENT,
    prescriber: PRESCRIBER,
    prescription: PRESCRIPTION,
    fromPrescriptionId: { type: 'integer', minimum: 1 },
  },
};

const UPDATE_CONTENT = {
  type: 'object',
  additionalProperties: false,
  required: ['reason'],
  properties: {
    patient: PATIENT,
    prescriber: PRESCRIBER,
    prescription: PRESCRIPTION,
    reason: str(300, { minLength: 1 }),
  },
};

const OVERRIDE_REASONS = ['false_positive', 'patient_context', 'evidence_outdated', 'rule_not_applicable', 'model_misinterpretation', 'other'];

const PHARMACIST_DECISION = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'analysisId'],
  properties: {
    action: {
      type: 'string',
      enum: ['approve', 'reject', 'request_information', 'return_to_prescriber', 'override_ai_alert', 'confirm_ai_alert', 'request_second_review'],
    },
    analysisId: str(80, { minLength: 1 }),
    alertCodes: strList(20, 80),
    overrideReason: { type: 'string', enum: OVERRIDE_REASONS },
    comment: str(1000),
    requestedInformation: strList(20, 120),
  },
};

const REQUEST_INFORMATION = {
  type: 'object',
  additionalProperties: false,
  required: ['requestedInformation'],
  properties: {
    requestedInformation: { type: 'array', minItems: 1, maxItems: 20, items: str(120, { minLength: 1 }) },
    comment: str(1000),
    analysisId: str(80),
  },
};

const PATIENT_CONFIRMATION = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'identityConfirmed'],
  properties: {
    decision: { type: 'string', enum: ['confirm', 'decline'] },
    identityConfirmed: { type: 'boolean' },
    allergiesConfirmed: { type: 'boolean' },
    allergyCorrections: strList(20),
    pregnancy: TRI,
    lactation: TRI,
    ageConfirmed: { type: 'boolean' },
    currentMedications: strList(30),
    fulfillment: { type: 'string', enum: ['pickup', 'delivery', 'decoction_pickup', 'decoction_delivery'] },
    contactConfirmed: { type: 'boolean' },
    substitutionConsent: { type: 'string', enum: ['accept', 'decline'] },
    educationAcknowledged: { type: 'boolean' },
    declineReason: str(300),
  },
};

const PATIENT_FEEDBACK = {
  type: 'object',
  additionalProperties: false,
  required: ['effectiveness', 'adverseReaction'],
  properties: {
    effectiveness: { type: 'integer', minimum: 1, maximum: 5 },
    adverseReaction: { type: 'boolean' },
    adverseDescription: str(500),
    comments: str(500),
  },
};

const DISPENSING_ACTION = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: { type: 'string', enum: ['start', 'submit_final_check', 'final_check_pass', 'final_check_fail', 'handover'] },
    note: str(500),
    weighedItems: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams'],
        properties: { name: str(40), grams: { type: 'number', minimum: 0, maximum: 5000 } },
      },
    },
  },
};

/** Fields a client must never send; their presence is itself an error. */
const CREATE_DRAFT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patient: PATIENT,
    diagnosisText: str(200),
    diagnosis: str(200),
    notes: str(500),
    prescriptionText: str(4000),
    prescription: PRESCRIPTION,
  },
};

const PATCH_DRAFT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patient: PATIENT,
    clinical: { type: 'object', additionalProperties: false, properties: { diagnosisText: str(200), notes: str(500) } },
    diagnosisText: str(200),
    diagnosis: str(200),
    prescriptionText: str(4000),
    prescription: PRESCRIPTION,
  },
};

const SUGGESTION_DISPOSITION = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['accepted', 'partially_accepted', 'rejected', 'ignored'] },
    reasonCode: {
      type: 'string',
      enum: [
        'clinically_appropriate', 'patient_specific', 'evidence_insufficient', 'wrong_context',
        'dose_adjusted_instead', 'already_addressed', 'disagrees_with_experience', 'other',
      ],
    },
    comment: str(500),
    partialFields: { type: 'array', maxItems: 20, items: str(80) },
  },
};

const FORBIDDEN_CLIENT_FIELDS = [
  'state', 'riskTier', 'approval', 'approved', 'approvedBy', 'role', 'actor', 'actorType', 'actorId',
  'analyses', 'decisions', 'hardStops', 'overrideHardStop', 'reviewer', 'reviewerId', 'pickupCode',
  'synthetic', 'dataMode',
];

function forbiddenFieldsIn(body) {
  if (!body || typeof body !== 'object') return [];
  return FORBIDDEN_CLIENT_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
}

module.exports = {
  CREATE_CASE,
  UPDATE_CONTENT,
  CREATE_DRAFT,
  PATCH_DRAFT,
  SUGGESTION_DISPOSITION,
  PHARMACIST_DECISION,
  REQUEST_INFORMATION,
  PATIENT_CONFIRMATION,
  PATIENT_FEEDBACK,
  DISPENSING_ACTION,
  OVERRIDE_REASONS,
  FORBIDDEN_CLIENT_FIELDS,
  forbiddenFieldsIn,
};
