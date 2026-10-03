/** Schemas for the semantic (LLM) track and for the unified analysis output. */

const TIER = { type: 'string', enum: ['A0', 'A1', 'A2', 'A3'] };
const text = (max) => ({ type: 'string', maxLength: max });

const SEMANTIC_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ambiguities', 'missingInformation', 'ruleHitSummary', 'warnings', 'suggestedRiskTier', 'pharmacistExplanation', 'patientExplanation', 'evidenceStrength'],
  properties: {
    structuredPrescription: {
      type: 'object',
      additionalProperties: false,
      properties: {
        herbs: {
          type: 'array',
          maxItems: 60,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name'],
            properties: { name: text(40), dosage: { type: ['number', 'null'] }, unit: text(8) },
          },
        },
      },
    },
    ambiguities: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['description'], properties: { field: text(80), description: text(300) } } },
    missingInformation: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['field', 'description'], properties: { field: text(80), description: text(300) } } },
    ruleHitSummary: text(1500),
    warnings: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message', 'evidenceIds'],
        properties: {
          code: text(60),
          message: text(400),
          evidenceIds: { type: 'array', minItems: 1, maxItems: 8, items: text(40) },
          severity: { type: 'string', enum: ['info', 'moderate', 'high'] },
        },
      },
    },
    suggestedRiskTier: TIER,
    suggestedActions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: { type: { type: 'string', enum: ['request_information', 'refer_to_prescriber', 'second_review', 'none'] }, detail: text(300) },
      },
    },
    pharmacistExplanation: text(3000),
    patientExplanation: text(1500),
    evidenceStrength: { type: 'string', enum: ['strong', 'moderate', 'limited', 'none'] },
    deskNotes: {
      type: 'object',
      additionalProperties: false,
      properties: {
        screening: text(800),
        dispensing: text(800),
        admin: text(800),
      },
    },
  },
};

const REF = {
  type: 'object',
  required: ['code', 'message'],
  properties: { code: { type: 'string' }, message: { type: 'string' }, ruleId: { type: ['string', 'null'] }, evidenceIds: { type: 'array', items: { type: 'string' } } },
};

const UNIFIED_OUTPUT_SCHEMA = {
  type: 'object',
  required: [
    'caseId', 'riskTier', 'recommendation', 'hardStops', 'alerts', 'missingInformation', 'ruleTrackResult',
    'retrievalTrackResult', 'semanticTrackResult', 'disagreements', 'abstain', 'abstainReasons',
    'pharmacistExplanation', 'patientExplanation', 'modelVersion', 'promptVersion', 'ruleSetVersion', 'knowledgeBaseVersion',
  ],
  properties: {
    caseId: { type: 'string' },
    riskTier: TIER,
    recommendation: { type: 'string', enum: ['pass_to_pharmacist', 'clarification_required', 'hard_stop', 'refer_to_prescriber'] },
    hardStops: { type: 'array', items: { ...REF, required: ['code', 'message', 'ruleId', 'evidenceIds'] } },
    alerts: { type: 'array', items: REF },
    missingInformation: { type: 'array' },
    ruleTrackResult: { type: 'object' },
    retrievalTrackResult: { type: 'object' },
    semanticTrackResult: { type: 'object' },
    disagreements: { type: 'array' },
    abstain: { type: 'boolean' },
    abstainReasons: { type: 'array', items: { type: 'string' } },
    pharmacistExplanation: { type: 'string' },
    patientExplanation: { type: 'string' },
    modelVersion: { type: 'string' },
    promptVersion: { type: 'string' },
    ruleSetVersion: { type: 'string' },
    knowledgeBaseVersion: { type: 'string' },
  },
};

function describeSemanticSchema() {
  return JSON.stringify(SEMANTIC_OUTPUT_SCHEMA);
}

module.exports = { SEMANTIC_OUTPUT_SCHEMA, UNIFIED_OUTPUT_SCHEMA, describeSemanticSchema };
