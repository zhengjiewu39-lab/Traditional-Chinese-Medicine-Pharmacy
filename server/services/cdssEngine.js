/**
 * CDSS for Herb Adverse Reaction Prevention (HAR-CDSS)
 * Track 1: Expert rule engine (deterministic alerts)
 * Track 2: Interpretable ML (linear attribution + risk probability)
 * Joint: Fusion decision for clinical decision support
 */

const ruleEngine = require('./prescriptionAnalyzer');
const mlEngine = require('./mlPrescriptionClassifier');
const { buildAdrPreventionReport, loadTaxonomy } = require('./adrTaxonomy');

const SYSTEM_META = {
  name: 'HAR-CDSS',
  fullName: 'Herb Adverse Reaction Clinical Decision Support System',
  version: '1.0.0',
  paperTitle: '融合专家知识规则与可解释机器学习的草药不良反应预防：一个临床决策支持系统原型的设计与评估',
};

const FEATURE_LABELS = {
  herb_count_norm: '药味数偏多',
  has_dosage_high: '超剂量',
  has_dosage_low: '剂量偏低',
  has_18fan: '十八反',
  has_19wei: '十九畏',
  has_incompatible_pair: '配伍禁忌',
  licorice_ratio_high: '甘草比例偏高',
  elderly_patient: '老年患者',
  pediatric_patient: '儿童患者',
  warm_cold_mix: '寒热并用',
};

const STATUS_RANK = { '已通过': 0, '建议复核': 1, '需修改': 2 };

function pickHigherStatus(a, b) {
  return (STATUS_RANK[a] || 0) >= (STATUS_RANK[b] || 0) ? a : b;
}

function buildRuleTrack(ruleResult, input) {
  const alerts = (ruleResult.warnings || []).map((w) => ({
    level: w.level,
    type: w.type,
    message: w.message,
    source: 'rule-engine-v3',
    deterministic: true,
    evidenceLevel: 'deterministic',
  }));

  const populationAlerts = [];
  if (input?.patientAge >= 65) {
    populationAlerts.push({
      level: 'warning', type: 'population', message: '老年患者：建议酌减剂量并监测肝肾功能',
      source: 'rule-engine-v3', deterministic: true, evidenceLevel: 'rule-based',
    });
  }
  if (input?.patientAge <= 12) {
    populationAlerts.push({
      level: 'warning', type: 'population', message: '儿童患者：需按体重折算剂量',
      source: 'rule-engine-v3', deterministic: true, evidenceLevel: 'rule-based',
    });
  }

  const allAlerts = [...alerts, ...populationAlerts];

  return {
    trackId: 'expert-rules',
    trackName: '专家知识规则引擎',
    engine: ruleResult.engine || 'TCM-ReviewEngine v3',
    rulesVersion: ruleResult.rulesVersion,
    score: ruleResult.score,
    status: ruleResult.status,
    label: ruleResult.label,
    alerts: allAlerts,
    deterministicAlerts: allAlerts.filter((a) =>
      ['十八反', '十九畏', '剂量', '配伍', '禁忌', '比例', 'population'].includes(a.type)
    ),
    suggestions: ruleResult.suggestions || [],
    summary: ruleResult.summary,
    outputType: 'deterministic_alerts',
  };
}

function buildMlTrack(mlResult) {
  const contributions = (mlResult.explainability?.topContributions || []).map((c) => ({
    feature: c.feature,
    label: FEATURE_LABELS[c.feature] || c.feature,
    weight: c.contribution,
    direction: c.contribution > 0 ? 'risk_up' : 'risk_down',
  }));

  return {
    trackId: 'interpretable-ml',
    trackName: '可解释机器学习',
    engine: mlResult.engine || 'ml-interpretable-v1',
    score: mlResult.score,
    status: mlResult.status,
    label: mlResult.label,
    probabilities: mlResult.probabilities || {},
    adrRevisionProbability: mlResult.probabilities?.needs_revision ?? 0,
    adrReviewProbability: mlResult.probabilities?.review ?? 0,
    featureAttributions: contributions,
    allFeatures: mlResult.explainability?.allFeatures || {},
    summary: mlResult.summary,
    outputType: 'risk_probability_with_attribution',
    explainabilityMethod: 'linear-logistic-attribution',
  };
}

function jointDecision(ruleTrack, mlTrack) {
  const ruleHasError = ruleTrack.alerts.some((a) => a.level === 'error');
  const ruleHas18or19 = ruleTrack.deterministicAlerts.some((a) =>
    a.type === '十八反' || a.type === '十九畏'
  );

  let status = pickHigherStatus(ruleTrack.status, mlTrack.status);
  if (ruleHas18or19 || (ruleHasError && mlTrack.adrRevisionProbability >= 0.4)) {
    status = '需修改';
  } else if (ruleHasError || mlTrack.adrRevisionProbability >= 0.55) {
    status = '需修改';
  } else if (ruleTrack.status === '建议复核' || mlTrack.adrReviewProbability >= 0.5) {
    status = '建议复核';
  }

  const label = ruleEngine.mapStatusToLabel(status);
  const score = Math.round(ruleTrack.score * 0.55 + mlTrack.score * 0.45);

  const mergedAlerts = [
    ...ruleTrack.deterministicAlerts,
    ...mlTrack.featureAttributions
      .filter((f) => f.weight > 0.5)
      .map((f) => ({
        level: f.weight > 1.5 ? 'error' : 'warning',
        type: 'ml-attribution',
        message: `ML 归因：${f.label}（权重 ${f.weight}）`,
        source: 'ml-interpretable-v1',
        deterministic: false,
        evidenceLevel: 'probabilistic',
      })),
  ];

  let summary = '不良反应预防评估：';
  if (status === '已通过') {
    summary += '规则与 ML 均未检出显著 ADR 风险信号。';
  } else if (status === '建议复核') {
    summary += '存在中等 ADR 风险，建议药师复核后决策。';
  } else {
    summary += '检出高 ADR 风险（配伍禁忌/超量/ML 高概率），建议修改处方。';
  }

  return {
    status,
    label,
    score: Math.max(0, Math.min(100, score)),
    summary,
    alerts: mergedAlerts,
    fusionPolicy: {
      method: 'rule-hard-override + ml-probability-blend',
      ruleWeight: 0.55,
      mlWeight: 0.45,
      hardOverride: ['十八反', '十九畏', 'critical_overdose'],
    },
  };
}

function analyzePrescription(input, options = {}) {
  const ruleResult = ruleEngine.analyzePrescription(input, options);
  const mlResult = mlEngine.analyzePrescription(input, options);

  const ruleTrack = buildRuleTrack(ruleResult, input);
  const mlTrack = buildMlTrack(mlResult);
  const joint = jointDecision(ruleTrack, mlTrack);
  const adrPrevention = buildAdrPreventionReport({
    ruleAlerts: ruleTrack.alerts,
    mlTrack,
    joint,
  });

  return {
    system: SYSTEM_META,
    engine: 'cdss-dual-track-v1',
    analyzedAt: new Date().toISOString(),
    herbs: ruleResult.herbs,
    tracks: {
      ruleEngine: ruleTrack,
      ml: mlTrack,
    },
    joint,
    adrPrevention,
    taxonomy: loadTaxonomy(),
    score: joint.score,
    status: joint.status,
    label: joint.label,
    warnings: joint.alerts,
    suggestions: [...ruleTrack.suggestions, ...adrPrevention.preventionActions],
    summary: joint.summary,
    featureLabels: FEATURE_LABELS,
  };
}

module.exports = {
  analyzePrescription,
  buildRuleTrack,
  buildMlTrack,
  jointDecision,
  FEATURE_LABELS,
  SYSTEM_META,
};
