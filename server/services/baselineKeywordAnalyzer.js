/** Baseline: keyword-only checker (no structured rules) */

const DANGER_KEYWORDS = ['甘遂', '大戟', '海藻', '芫花', '十八反', '十九畏'];
const HIGH_DOSE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:g|克)/g;

function analyzePrescription(input) {
  const text = input.prescription || '';
  const warnings = [];
  if (!text.trim() && !input.herbs?.length) {
    return fail('empty prescription');
  }
  for (const kw of DANGER_KEYWORDS) {
    if (text.includes(kw)) {
      warnings.push({ level: 'warning', type: 'keyword', message: `检测到敏感词 ${kw}` });
    }
  }
  let match;
  while ((match = HIGH_DOSE_PATTERN.exec(text)) !== null) {
    if (parseFloat(match[1]) > 30) {
      warnings.push({ level: 'warning', type: 'keyword', message: `检测到可能的超大剂量 ${match[1]}g` });
      break;
    }
  }
  const hasError = warnings.some(w => w.level === 'error');
  const label = hasError ? 'needs_revision' : warnings.length ? 'review' : 'approved';
  const status = label === 'needs_revision' ? '需修改' : label === 'review' ? '建议复核' : '已通过';
  return {
    score: label === 'approved' ? 90 : label === 'review' ? 70 : 40,
    status,
    label,
    warnings,
    suggestions: [],
    herbs: [],
    summary: 'Baseline keyword scan',
    engine: 'baseline-keyword',
  };
}

function fail(msg) {
  return {
    score: 0, status: '需修改', label: 'needs_revision',
    warnings: [{ level: 'error', message: msg }], suggestions: [], herbs: [],
    summary: msg, engine: 'baseline-keyword',
  };
}

module.exports = { analyzePrescription };
