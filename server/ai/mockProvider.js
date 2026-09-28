/**
 * Deterministic stand-in for an LLM. Output is always labelled as mock and must never be shown
 * as real AI; production startup refuses this provider.
 *
 * `behavior` exists for safety tests and offline evaluation only; it is set in code, never from a request.
 */
const MODEL_VERSION = 'mock-deterministic-v1';

const BEHAVIORS = ['normal', 'invalid_json', 'timeout', 'error', 'fabricated_citation', 'downgrade', 'add_herb', 'diagnose', 'extra_field', 'no_citation'];

function tierText(t) {
  return { A1: '未发现规则命中', A2: '存在需药师判断的风险项', A3: '存在硬性阻断项' }[t] || '';
}

function normalOutput(ctx) {
  const { ruleSummary, evidence, minimisedCase } = ctx;
  const evidenceIds = new Set(evidence.map((e) => e.sourceId));
  const warnings = ruleSummary.hits
    .filter((h) => h.evidenceIds.some((id) => evidenceIds.has(id)))
    .map((h) => ({
      code: h.code,
      message: h.message,
      evidenceIds: h.evidenceIds.filter((id) => evidenceIds.has(id)),
      severity: h.tier === 'A3' ? 'high' : h.tier === 'A2' ? 'moderate' : 'info',
    }));
  const lines = ruleSummary.hits.map((h) => `- [${h.tier}] ${h.message}${h.evidenceIds.length ? `（依据：${h.evidenceIds.join('、')}）` : '（无可引用证据）'}`);
  return {
    structuredPrescription: { herbs: minimisedCase.prescription.herbs.map((h) => ({ name: h.name, dosage: h.dosage ?? null, unit: h.unit || 'g' })) },
    ambiguities: [],
    missingInformation: ruleSummary.missingInformation.map((m) => ({ field: m.field, description: m.message })),
    ruleHitSummary: `规则引擎共命中 ${ruleSummary.hits.length} 项，${tierText(ruleSummary.tier)}。`,
    warnings,
    suggestedRiskTier: ruleSummary.tier,
    suggestedActions: ruleSummary.missingInformation.some((m) => m.critical)
      ? [{ type: 'request_information', detail: '补充缺失的关键信息后重新评估' }]
      : [],
    pharmacistExplanation: [`【模拟模型输出】${tierText(ruleSummary.tier)}。`, ...lines].join('\n'),
    patientExplanation: ruleSummary.tier === 'A1'
      ? '药师正在核对您的处方，核对完成后会告知取药和服用注意事项。具体用法请以药师说明为准。'
      : '您的处方中有需要药师进一步核对的地方，药师可能会联系您或开方医生确认信息。请以药师说明为准。',
    evidenceStrength: warnings.length ? 'strong' : (ruleSummary.hits.length ? 'limited' : 'moderate'),
  };
}

function createMockProvider({ behavior = 'normal' } = {}) {
  if (!BEHAVIORS.includes(behavior)) throw new Error(`unknown mock behavior ${behavior}`);
  return {
    id: 'mock',
    isMock: true,
    modelVersion: MODEL_VERSION,
    async complete({ context, signal }) {
      if (behavior === 'timeout') {
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });
      }
      if (behavior === 'error') throw new Error('mock provider failure');
      if (behavior === 'invalid_json') return '{"ruleHitSummary": "unterminated';
      const out = normalOutput(context);
      if (behavior === 'fabricated_citation') {
        out.warnings.push({ code: 'MODEL_WARNING', message: '模型声称存在额外风险', evidenceIds: ['KS-FAKE-999'], severity: 'high' });
      }
      if (behavior === 'no_citation') {
        out.warnings.push({ code: 'MODEL_WARNING', message: '模型未引用证据的警示', evidenceIds: [], severity: 'moderate' });
      }
      if (behavior === 'downgrade') {
        out.suggestedRiskTier = 'A1';
        out.pharmacistExplanation = '【模拟模型输出】模型认为风险可以忽略。';
      }
      if (behavior === 'add_herb') {
        out.structuredPrescription.herbs.push({ name: '黄芪', dosage: 30, unit: 'g' });
        out.pharmacistExplanation += '\n建议加用黄芪30g。';
      }
      if (behavior === 'diagnose') {
        out.patientExplanation = '根据您的情况，诊断为脾虚湿盛证，建议服用本方。';
      }
      if (behavior === 'extra_field') {
        out.newState = 'pharmacist_approved';
      }
      return JSON.stringify(out);
    },
  };
}

module.exports = { createMockProvider, MODEL_VERSION, BEHAVIORS };
