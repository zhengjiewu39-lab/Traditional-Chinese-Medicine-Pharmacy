/**
 * Safety policy applied around the semantic track: input screening (length, injection) and
 * output screening (citations, herb/dose changes, diagnosis or prescribing language).
 */

const MAX_FREE_TEXT = 4000;

const INJECTION_PATTERNS = [
  /忽略(以上|之前|前面|所有|全部)?.{0,6}(指令|规则|限制|提示)/,
  /(无视|绕过|跳过).{0,6}(规则|审核|限制|药师)/,
  /(直接|自动)(通过|批准|放行)/,
  /(批准|放行)(该|此|这张|本)?处方/,
  /(你现在是|你是一个|扮演|假装).{0,10}(管理员|药师|医生|系统)/,
  /(系统提示|system\s*prompt|developer\s*message)/i,
  /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|rules)/i,
  /disregard\s+(the\s+)?(rules|instructions)/i,
  /you\s+are\s+now\b/i,
  /\b(role|state|riskTier)\s*[:=]\s*["']?(admin|pharmacist|pharmacist_approved|A0|A1)\b/i,
  /<\/?\s*(system|assistant|instruction)s?\s*>/i,
];

const CLINICAL_ACTION_PATTERNS = [
  { re: /诊断为|确诊为|辨证为.{0,8}证/, code: 'diagnosis' },
  { re: /建议(加用|加入|改用|换用|替换为|增加|减少|去掉|删除)/, code: 'prescribing' },
  { re: /(改为|调整为|增至|减至|加量至|减量至)\s*\d+(\.\d+)?\s*(g|克)/, code: 'dose_change' },
  { re: /处方如下|为您开具|开具以下/, code: 'prescribing' },
  { re: /(无需|不必)(经过)?药师|已(被)?批准|可以直接(服用|调剂|发药)/, code: 'approval_claim' },
  { re: /\bdiagnos(e|ed|is)\b.{0,24}(as|of|with)\b/i, code: 'diagnosis' },
  { re: /\b(add|remove|replace|switch to|prescribe)\b.{0,24}(herb|drug|formula)\b/i, code: 'prescribing' },
  { re: /\b(change|adjust|increase|decrease)\b.{0,16}(dose|dosage).{0,8}\d+/i, code: 'dose_change' },
  { re: /\b(no need for (a )?pharmacist|without pharmacist (review|approval)|skip the pharmacist|can (directly )?(dispense|approve)|dispense directly)\b/i, code: 'approval_claim' },
];

function collectFreeText(caseRecord) {
  const p = caseRecord.patient || {};
  const rx = caseRecord.prescription || {};
  return [
    caseRecord.source?.rawText,
    rx.usage, rx.frequency, rx.decoctionNotes, rx.diagnosisText,
    ...(Array.isArray(p.allergies) ? p.allergies : []),
    ...(Array.isArray(p.currentMedications) ? p.currentMedications : []),
    ...(rx.herbs || []).map((h) => `${h.name} ${h.note || ''} ${h.processing || ''}`),
  ].filter(Boolean).map(String);
}

function screenInput(caseRecord) {
  const texts = collectFreeText(caseRecord);
  const findings = [];
  for (const t of texts) {
    if (t.length > MAX_FREE_TEXT) findings.push({ code: 'input_too_long', detail: `${t.length} chars` });
    for (const re of INJECTION_PATTERNS) {
      if (re.test(t)) {
        findings.push({ code: 'prompt_injection_suspected', detail: re.source.slice(0, 60) });
        break;
      }
    }
  }
  return {
    injectionSuspected: findings.some((f) => f.code === 'prompt_injection_suspected'),
    tooLong: findings.some((f) => f.code === 'input_too_long'),
    findings,
  };
}

function textFieldsOf(out) {
  const texts = [];
  const skip = new Set(['evidenceIds', 'code', 'type', 'field', 'severity', 'suggestedRiskTier', 'evidenceStrength']);
  function walk(v, key) {
    if (skip.has(key)) return;
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach((item) => walk(item));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, val]) => walk(val, k));
  }
  walk(out);
  return texts;
}

/**
 * @returns {{ violations: Array<{code:string,message:string}>, acceptedWarnings: any[], rejectedWarnings: any[] }}
 */
function screenOutput(out, { canonicalHerbs, allowedEvidenceIds }) {
  const violations = [];
  const acceptedWarnings = [];
  const rejectedWarnings = [];
  for (const w of out.warnings || []) {
    const bad = (w.evidenceIds || []).filter((id) => !allowedEvidenceIds.has(id));
    if (bad.length || !(w.evidenceIds || []).length) {
      rejectedWarnings.push({ ...w, reason: bad.length ? `unknown citation ${bad.join(',')}` : 'no citation' });
      violations.push({ code: 'citation_not_found', message: `Warning ${w.code} cites ${bad.join(',') || 'nothing'}` });
    } else {
      acceptedWarnings.push(w);
    }
  }
  const canon = new Map();
  for (const h of canonicalHerbs) {
    if (!canon.has(h.name)) canon.set(h.name, new Set());
    if (h.dosage != null) canon.get(h.name).add(Number(h.dosage));
  }
  for (const h of out.structuredPrescription?.herbs || []) {
    const doses = canon.get(h.name);
    if (!doses) violations.push({ code: 'herb_added', message: `Model introduced herb ${h.name}` });
    else if (h.dosage != null && doses.size && !doses.has(Number(h.dosage))) {
      violations.push({ code: 'dose_changed', message: `Model changed ${h.name} dose ${[...doses].join('/')} → ${h.dosage}` });
    }
  }
  for (const t of textFieldsOf(out)) {
    for (const { re, code } of CLINICAL_ACTION_PATTERNS) {
      if (re.test(t)) violations.push({ code: `autonomous_${code}`, message: `Model text contains ${code} language` });
    }
  }
  return { violations, acceptedWarnings, rejectedWarnings };
}

module.exports = {
  MAX_FREE_TEXT, INJECTION_PATTERNS, screenInput, screenOutput, collectFreeText,
};
