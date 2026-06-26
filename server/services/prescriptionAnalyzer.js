/** 智能处方审方引擎 — 剂量/配伍/禁忌/性味分析 */

const HERB_RULES = {
  '人参': { min: 3, max: 9, unit: 'g', nature: '温', incompatible: ['藜芦'], caution: ['实证', '热证'] },
  '黄芪': { min: 10, max: 30, unit: 'g', nature: '温', incompatible: [], caution: ['表实邪盛'] },
  '当归': { min: 6, max: 15, unit: 'g', nature: '温', incompatible: [], caution: ['湿盛便溏'] },
  '白芍': { min: 6, max: 15, unit: 'g', nature: '寒', incompatible: ['藜芦'], caution: ['虚寒'] },
  '川芎': { min: 3, max: 9, unit: 'g', nature: '温', incompatible: [], caution: ['孕妇'] },
  '甘草': { min: 3, max: 10, unit: 'g', nature: '平', incompatible: [], caution: ['高血压'], maxRatio: 0.15 },
  '麻黄': { min: 3, max: 9, unit: 'g', nature: '温', incompatible: [], caution: ['高血压', '失眠'] },
  '桂枝': { min: 3, max: 10, unit: 'g', nature: '温', incompatible: [], caution: ['阴虚'] },
  '三七': { min: 3, max: 6, unit: 'g', nature: '温', incompatible: [], caution: ['孕妇', '出血倾向'] },
  '附子': { min: 3, max: 15, unit: 'g', nature: '大热', incompatible: ['半夏', '瓜蒌', '贝母', '白蔹', '白及'], caution: ['孕妇'] },
  '半夏': { min: 3, max: 9, unit: 'g', nature: '温', incompatible: ['附子', '乌头'], caution: ['孕妇'] },
  '板蓝根': { min: 10, max: 30, unit: 'g', nature: '寒', incompatible: [], caution: ['脾胃虚寒'] },
};

const EIGHTEEN_INCOMPATIBLE = [
  ['甘草', '甘遂'], ['甘草', '大戟'], ['甘草', '海藻'], ['甘草', '芫花'],
  ['乌头', '贝母'], ['乌头', '瓜蒌'], ['乌头', '半夏'], ['乌头', '白蔹'], ['乌头', '白及'],
  ['藜芦', '人参'], ['藜芦', '沙参'], ['藜芦', '丹参'], ['藜芦', '玄参'], ['藜芦', '细辛'], ['藜芦', '芍药'],
  ['硫黄', '朴硝'], ['水银', '砒霜'], ['狼毒', '密陀僧'], ['巴豆', '牵牛'],
];

const NINETEEN_FEAR = [
  ['人参', '莱菔子'], ['丁香', '郁金'], ['川乌', '犀角'], ['牙硝', '三棱'],
  ['官桂', '石脂'], ['人参', '五灵脂'],
];

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

function analyzePrescription({ prescription, patientAge, patientGender, diagnosis, herbs: herbList }) {
  const herbs = herbList || parseHerbs(prescription);
  const warnings = [];
  const suggestions = [];
  let score = 100;

  if (herbs.length === 0) {
    return { score: 0, status: '需修改', warnings: [{ level: 'error', message: '未能解析处方内容' }], suggestions: [], herbs: [], summary: '处方为空或格式无法识别' };
  }

  if (herbs.length > 20) {
    warnings.push({ level: 'warning', type: '剂量', message: `药味数 ${herbs.length} 味，建议控制在 20 味以内` });
    score -= 5;
  }

  let totalDosage = 0;
  for (const herb of herbs) {
    const rule = Object.entries(HERB_RULES).find(([k]) => herb.name.includes(k))?.[1];
    if (!rule) continue;

    if (herb.dosage != null) {
      totalDosage += herb.dosage;
      if (herb.dosage < rule.min) {
        warnings.push({ level: 'warning', type: '剂量', message: `${herb.name} 剂量 ${herb.dosage}${herb.unit} 偏低（建议 ${rule.min}-${rule.max}${rule.unit}）` });
        score -= 3;
      }
      if (herb.dosage > rule.max) {
        warnings.push({ level: 'error', type: '剂量', message: `${herb.name} 剂量 ${herb.dosage}${herb.unit} 超标（建议 ${rule.min}-${rule.max}${rule.unit}）` });
        score -= 8;
      }
    }

    for (const c of rule.caution || []) {
      if (diagnosis && diagnosis.includes(c)) {
        warnings.push({ level: 'warning', type: '禁忌', message: `${herb.name} 对「${c}」患者需谨慎` });
        score -= 4;
      }
    }
  }

  if (totalDosage > 0) {
    const licorice = herbs.find(h => h.name.includes('甘草'));
    if (licorice && licorice.dosage / totalDosage > 0.15) {
      warnings.push({ level: 'warning', type: '比例', message: '甘草用量超过全方 15%，注意长期使用的副作用' });
      score -= 5;
    }
  }

  warnings.push(...checkPair(herbs, EIGHTEEN_INCOMPATIBLE, '十八反'));
  warnings.push(...checkPair(herbs, NINETEEN_FEAR, '十九畏'));

  const errors = warnings.filter(w => w.level === 'error');
  score -= errors.length * 5;
  score = Math.max(0, Math.min(100, score));

  if (patientAge >= 65) suggestions.push('老年患者建议酌减剂量，关注肝肾功能');
  if (patientAge <= 12) suggestions.push('儿童处方需按体重折算，建议使用儿科专用剂量');
  if (patientGender === '女') suggestions.push('请确认患者是否妊娠/哺乳');

  const warm = herbs.filter(h => { const r = HERB_RULES[Object.keys(HERB_RULES).find(k => h.name.includes(k)) || '']; return r?.nature?.includes('温') || r?.nature?.includes('热'); });
  const cold = herbs.filter(h => { const r = HERB_RULES[Object.keys(HERB_RULES).find(k => h.name.includes(k)) || '']; return r?.nature?.includes('寒'); });
  if (warm.length > 0 && cold.length > 0) suggestions.push('方中含温药与寒药，已构成寒热并用，请确认是否符合辨证');

  let status = '已通过';
  if (errors.length > 0 || score < 60) status = '需修改';
  else if (warnings.length > 0 || score < 85) status = '建议复核';

  return {
    score,
    status,
    warnings,
    suggestions,
    herbs,
    summary: status === '已通过'
      ? '处方审方通过，未发现严重配伍禁忌或剂量异常'
      : status === '建议复核'
        ? `发现 ${warnings.length} 项提示，建议药师复核后发药`
        : `发现 ${errors.length} 项严重问题，请修改处方`,
    analyzedAt: new Date().toISOString(),
    engine: 'TCM-ReviewEngine v2',
  };
}

module.exports = { analyzePrescription, parseHerbs, HERB_RULES };
