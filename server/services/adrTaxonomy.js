/**
 * ADR (Adverse Drug/Herb Reaction) taxonomy for CDSS paper-aligned outputs.
 */

const fs = require('fs');
const path = require('path');

const TAXONOMY_PATH = path.join(__dirname, '../config/adr-taxonomy.json');

const FEATURE_TO_CATEGORY = {
  has_18fan: 'ADR-C1',
  has_19wei: 'ADR-C1',
  has_incompatible_pair: 'ADR-C1',
  has_dosage_high: 'ADR-C2',
  has_dosage_low: 'ADR-C2',
  licorice_ratio_high: 'ADR-C2',
  herb_count_norm: 'ADR-C2',
  elderly_patient: 'ADR-C4',
  pediatric_patient: 'ADR-C4',
  warm_cold_mix: 'ADR-C3',
};

function loadTaxonomy() {
  return JSON.parse(fs.readFileSync(process.env.TCM_ADR_TAXONOMY_PATH || TAXONOMY_PATH, 'utf8'));
}

function mapAlertToCategory(alert) {
  const taxonomy = loadTaxonomy();
  const type = alert.type || '';
  if (type === '禁忌') return taxonomy.categories.find((c) => c.id === 'ADR-C3');
  if (type === 'population') return taxonomy.categories.find((c) => c.id === 'ADR-C4');
  const cat = taxonomy.categories.find((c) => (c.ruleTypes || []).includes(type));
  return cat || taxonomy.categories.find((c) => c.id === 'ADR-C2');
}

function classifyRuleAlerts(alerts = []) {
  const taxonomy = loadTaxonomy();
  const byCategory = {};
  taxonomy.categories.forEach((c) => { byCategory[c.id] = { ...c, alerts: [] }; });

  alerts.forEach((alert) => {
    const cat = mapAlertToCategory(alert);
    if (cat && byCategory[cat.id]) {
      byCategory[cat.id].alerts.push({ ...alert, evidenceLevel: cat.evidenceLevel });
    }
  });

  return Object.values(byCategory).filter((c) => c.alerts.length > 0);
}

function classifyMlFeatures(featureAttributions = [], allFeatures = {}) {
  const taxonomy = loadTaxonomy();
  const cat = taxonomy.categories.find((c) => c.id === 'ADR-C5');
  const items = (featureAttributions || [])
    .filter((f) => f.weight > 0)
    .map((f) => ({
      feature: f.feature,
      label: f.label,
      weight: f.weight,
      categoryId: FEATURE_TO_CATEGORY[f.feature] || 'ADR-C5',
      value: allFeatures[f.feature],
    }));

  return items.length ? [{ ...cat, mlContributions: items }] : [];
}

function computeAdrRiskScore(ruleCategories, mlCategories, jointStatus) {
  let score = 0;
  ruleCategories.forEach((c) => {
    c.alerts.forEach((a) => { score += a.level === 'error' ? 0.35 : 0.15; });
  });
  mlCategories.forEach((c) => {
    (c.mlContributions || []).forEach((m) => { score += Math.min(0.2, Math.abs(m.weight) * 0.08); });
  });
  if (jointStatus === '需修改') score = Math.max(score, 0.75);
  else if (jointStatus === '建议复核') score = Math.max(score, 0.45);
  return Math.min(1, +score.toFixed(3));
}

function riskLevelFromScore(score) {
  const taxonomy = loadTaxonomy();
  if (score >= 0.55) return { level: 'high', labelZh: taxonomy.riskLevels.high.labelZh };
  if (score >= 0.25) return { level: 'moderate', labelZh: taxonomy.riskLevels.moderate.labelZh };
  return { level: 'low', labelZh: taxonomy.riskLevels.low.labelZh };
}

function buildAdrPreventionReport({ ruleAlerts, mlTrack, joint }) {
  const ruleCategories = classifyRuleAlerts(ruleAlerts);
  const mlCategories = classifyMlFeatures(
    mlTrack?.featureAttributions,
    mlTrack?.allFeatures
  );
  const adrRiskScore = computeAdrRiskScore(ruleCategories, mlCategories, joint?.status);
  const riskLevel = riskLevelFromScore(adrRiskScore);

  const preventionActions = [];
  if (ruleCategories.some((c) => c.id === 'ADR-C1')) {
    preventionActions.push('移除或替换配伍禁忌药对，遵循十八反/十九畏原则');
  }
  if (ruleCategories.some((c) => c.id === 'ADR-C2')) {
    preventionActions.push('调整超量药味剂量至药典建议范围');
  }
  if (ruleCategories.some((c) => c.id === 'ADR-C3')) {
    preventionActions.push('复核病证与药性是否匹配，必要时减药或换方');
  }
  if (ruleCategories.some((c) => c.id === 'ADR-C4') || mlCategories.length) {
    preventionActions.push('针对特殊人群加强监护与用药交代');
  }
  if (!preventionActions.length) {
    preventionActions.push('当前未发现显著不良反应预防信号，可按常规流程发药');
  }

  return {
    framework: 'Expert-Rules + Interpretable-ML Fusion',
    purpose: 'herb_adverse_reaction_prevention',
    adrRiskScore,
    riskLevel,
    categories: [...ruleCategories, ...mlCategories],
    preventionActions,
    clinicalDisclaimer: '本系统为研究原型，不能替代执业药师/医师的最终临床决策。',
  };
}

module.exports = {
  loadTaxonomy,
  classifyRuleAlerts,
  classifyMlFeatures,
  buildAdrPreventionReport,
  FEATURE_TO_CATEGORY,
};
