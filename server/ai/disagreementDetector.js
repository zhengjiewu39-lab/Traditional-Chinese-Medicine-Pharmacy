const { TIER_ORDER } = require('./ruleTrack');

/**
 * Compare the rule track with the semantic track. Disagreements are surfaced to the pharmacist;
 * they never lower the rule tier.
 */
function detectDisagreements({ ruleTrack, semantic, canonicalHerbs }) {
  const out = [];
  if (!semantic) return out;
  const ruleTier = ruleTrack.tier;
  const modelTier = semantic.suggestedRiskTier;
  if (TIER_ORDER[modelTier] < TIER_ORDER[ruleTier]) {
    out.push({
      type: ruleTier === 'A3' ? 'hard_rule_conflict' : 'model_lower_than_rules',
      detail: `模型建议 ${modelTier}，规则轨为 ${ruleTier}；以规则轨为准`,
      ruleTier,
      modelTier,
    });
  } else if (TIER_ORDER[modelTier] > TIER_ORDER[ruleTier]) {
    out.push({ type: 'model_higher_than_rules', detail: `模型建议 ${modelTier}，高于规则轨 ${ruleTier}，请药师关注`, ruleTier, modelTier });
  }
  const ruleCodes = new Set(ruleTrack.hits.map((h) => h.code));
  for (const w of semantic.warnings || []) {
    if (!ruleCodes.has(w.code)) out.push({ type: 'model_only_warning', detail: w.message, code: w.code });
  }
  const modelNames = new Set((semantic.structuredPrescription?.herbs || []).map((h) => h.name));
  if (modelNames.size) {
    const missingFromModel = canonicalHerbs.filter((h) => !modelNames.has(h.name)).map((h) => h.name);
    if (missingFromModel.length) out.push({ type: 'structure_mismatch', detail: `模型结构化结果缺少：${missingFromModel.join('、')}` });
  }
  const ruleMissing = new Set(ruleTrack.missingInformation.map((m) => m.field));
  for (const m of semantic.missingInformation || []) {
    if (!ruleMissing.has(m.field)) out.push({ type: 'model_flagged_missing', detail: m.description, field: m.field });
  }
  return out;
}

module.exports = { detectDisagreements };
