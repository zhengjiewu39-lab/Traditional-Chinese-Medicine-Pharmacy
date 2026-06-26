/** TCM Review Engine v3 — configurable rules from JSON */

const { loadRules } = require('./ruleLoader');

function parseHerbs(text) {
  if (!text) return [];
  const items = [];
  const parts = text.split(/[，,、；;\n]+/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(.+?)(\d+(?:\.\d+)?)\s*(g|克|ml|毫升|丸|片|袋|盒)?$/i);
    if (m) {
      items.push({ name: m[1].trim(), dosage: parseFloat(m[2]), unit: (m[3] || 'g').replace('克', 'g') });
    } else {
      const nameOnly = part.replace(/\d+.*/, '').trim();
      if (nameOnly) items.push({ name: nameOnly, dosage: null, unit: 'g' });
    }
  }
  return items;
}

function findHerbRule(name, herbRules) {
  const key = Object.keys(herbRules).find(k => name.includes(k));
  return key ? { key, rule: herbRules[key] } : null;
}

function checkPair(herbs, pairs, type) {
  const warnings = [];
  const names = herbs.map(h => h.name);
  for (const [a, b] of pairs) {
    if (names.some(n => n.includes(a)) && names.some(n => n.includes(b))) {
      warnings.push({ level: 'error', type, message: `${type}：${a} 与 ${b} 不宜同用` });
    }
  }
  return warnings;
}

function mapStatusToLabel(status) {
  if (status === '需修改') return 'needs_revision';
  if (status === '建议复核') return 'review';
  return 'approved';
}

function analyzePrescription(input, options = {}) {
  const rules = options.rules || loadRules(options.rulesPath);
  const { herbRules, eighteenIncompatible, nineteenFear, thresholds, scoring } = rules;
  const { prescription, patientAge, patientGender, diagnosis, herbs: herbList } = input;

  const herbs = herbList || parseHerbs(prescription);
  const warnings = [];
  const suggestions = [];
  let score = 100;

  if (herbs.length === 0) {
    return emptyResult('未能解析处方内容');
  }

  if (herbs.length > (thresholds.maxHerbCount || 20)) {
    warnings.push({ level: 'warning', type: '剂量', message: `药味数 ${herbs.length} 味，建议控制在 ${thresholds.maxHerbCount || 20} 味以内` });
    score -= scoring.herbCountPenalty || 5;
  }

  let totalDosage = 0;
  for (const herb of herbs) {
    const found = findHerbRule(herb.name, herbRules);
    if (!found) continue;
    const rule = found.rule;

    if (herb.dosage != null) {
      totalDosage += herb.dosage;
      if (herb.dosage < rule.min) {
        warnings.push({ level: 'warning', type: '剂量', message: `${herb.name} 剂量 ${herb.dosage}${herb.unit} 偏低（建议 ${rule.min}-${rule.max}${rule.unit}）` });
        score -= scoring.dosageLowPenalty || 3;
      }
      if (herb.dosage > rule.max) {
        warnings.push({ level: 'error', type: '剂量', message: `${herb.name} 剂量 ${herb.dosage}${herb.unit} 超标（建议 ${rule.min}-${rule.max}${rule.unit}）` });
        score -= scoring.dosageHighPenalty || 8;
      }
    }

    for (const c of rule.caution || []) {
      if (diagnosis && diagnosis.includes(c)) {
        warnings.push({ level: 'warning', type: '禁忌', message: `${herb.name} 对「${c}」患者需谨慎` });
        score -= scoring.cautionPenalty || 4;
      }
    }

    for (const inc of rule.incompatible || []) {
      if (herbs.some(h => h.name !== herb.name && h.name.includes(inc))) {
        warnings.push({ level: 'error', type: '配伍', message: `${herb.name} 与 ${inc} 存在配伍禁忌` });
      }
    }
  }

  const licoriceMax = thresholds.licoriceMaxRatio || 0.15;
  if (totalDosage > 0) {
    const licorice = herbs.find(h => h.name.includes('甘草'));
    if (licorice?.dosage && licorice.dosage / totalDosage > licoriceMax) {
      warnings.push({ level: 'warning', type: '比例', message: `甘草用量超过全方 ${licoriceMax * 100}%，注意长期使用的副作用` });
      score -= scoring.licoriceRatioPenalty || 5;
    }
  }

  warnings.push(...checkPair(herbs, eighteenIncompatible, '十八反'));
  warnings.push(...checkPair(herbs, nineteenFear, '十九畏'));

  const errors = warnings.filter(w => w.level === 'error');
  score -= errors.length * (scoring.errorPenalty || 5);
  score = Math.max(0, Math.min(100, score));

  if (patientAge >= 65) suggestions.push('老年患者建议酌减剂量，关注肝肾功能');
  if (patientAge <= 12) suggestions.push('儿童处方需按体重折算，建议使用儿科专用剂量');
  if (patientGender === '女') suggestions.push('请确认患者是否妊娠/哺乳');

  const warm = herbs.filter(h => {
    const r = findHerbRule(h.name, herbRules)?.rule;
    return r?.nature?.includes('温') || r?.nature?.includes('热');
  });
  const cold = herbs.filter(h => findHerbRule(h.name, herbRules)?.rule?.nature?.includes('寒'));
  if (warm.length > 0 && cold.length > 0) {
    suggestions.push('方中含温药与寒药，已构成寒热并用，请确认是否符合辨证');
  }

  let status = '已通过';
  const rejectBelow = thresholds.rejectScoreBelow ?? 60;
  const reviewBelow = thresholds.reviewScoreBelow ?? 85;
  if (errors.length > 0 || score < rejectBelow) status = '需修改';
  else if (warnings.length > 0 || score < reviewBelow) status = '建议复核';

  return {
    score,
    status,
    label: mapStatusToLabel(status),
    warnings,
    suggestions,
    herbs,
    summary: status === '已通过'
      ? '处方审方通过，未发现严重配伍禁忌或剂量异常'
      : status === '建议复核'
        ? `发现 ${warnings.length} 项提示，建议药师复核后发药`
        : `发现 ${errors.length} 项严重问题，请修改处方`,
    analyzedAt: new Date().toISOString(),
    engine: 'TCM-ReviewEngine v3',
    rulesVersion: rules.version,
  };
}

function emptyResult(msg) {
  return {
    score: 0, status: '需修改', label: 'needs_revision',
    warnings: [{ level: 'error', message: msg }], suggestions: [], herbs: [],
    summary: msg, engine: 'TCM-ReviewEngine v3',
  };
}

function extractFeatures(input, herbs, rules) {
  const { herbRules, eighteenIncompatible, nineteenFear, thresholds } = rules;
  const result = analyzePrescription({ ...input, herbs }, { rules });
  const names = herbs.map(h => h.name);
  let total = 0;
  herbs.forEach(h => { if (h.dosage) total += h.dosage; });
  const licorice = herbs.find(h => h.name.includes('甘草'));
  const warm = herbs.some(h => findHerbRule(h.name, herbRules)?.rule?.nature?.match(/温|热/));
  const cold = herbs.some(h => findHerbRule(h.name, herbRules)?.rule?.nature?.includes('寒'));

  return {
    herb_count_norm: Math.min(herbs.length / (thresholds.maxHerbCount || 20), 1),
    has_dosage_high: result.warnings.some(w => w.type === '剂量' && w.level === 'error') ? 1 : 0,
    has_dosage_low: result.warnings.some(w => w.type === '剂量' && w.level === 'warning') ? 1 : 0,
    has_18fan: checkPair(herbs, eighteenIncompatible, '十八反').length > 0 ? 1 : 0,
    has_19wei: checkPair(herbs, nineteenFear, '十九畏').length > 0 ? 1 : 0,
    has_incompatible_pair: result.warnings.some(w => w.type === '配伍') ? 1 : 0,
    licorice_ratio_high: licorice?.dosage && total > 0 && licorice.dosage / total > (thresholds.licoriceMaxRatio || 0.15) ? 1 : 0,
    elderly_patient: input.patientAge >= 65 ? 1 : 0,
    pediatric_patient: input.patientAge <= 12 ? 1 : 0,
    warm_cold_mix: warm && cold ? 1 : 0,
    _names: names,
  };
}

module.exports = {
  analyzePrescription,
  parseHerbs,
  extractFeatures,
  mapStatusToLabel,
  checkPair,
  findHerbRule,
};
