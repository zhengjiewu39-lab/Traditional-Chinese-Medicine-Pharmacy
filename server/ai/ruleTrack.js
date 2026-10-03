/**
 * Deterministic rule track. Its tier is a floor: no later stage (LLM, patient, staff) can lower it.
 *
 * Hit tiers:  A3 hard stop · A2 pharmacist decision · A1 informational.
 * A3 `resolution`:
 *   'prescriber_revision'    — only a revised prescription clears it (十八反/十九畏, banned herbs,
 *                              severe allergy, identity/source anomaly, expired prescription).
 *   'prescriber_attestation' — the prescriber's documented double signature (prescriberAttestations)
 *                              lowers it to A2 for pharmacist review; nothing else does.
 */
const { loadRules } = require('../services/ruleLoader');
const { analyzePrescription: legacyReview } = require('../services/prescriptionAnalyzer');
const safetyRules = require('../config/ai-safety-rules.json');
const { clinicalProjection } = require('../workflow/clinicalFacts');

const TIER_ORDER = { A0: 0, A1: 1, A2: 2, A3: 3 };
const maxTier = (a, b) => (TIER_ORDER[a] >= TIER_ORDER[b] ? a : b);

const matchesAny = (name, list) => list.find((k) => name.includes(k)) || null;
const exactAny = (name, list) => list.find((k) => name === k) || null;

function ruleSetVersion() {
  return `tcm-rules@${loadRules().version}+${safetyRules.id}@${safetyRules.version}`;
}

function hit(code, tier, message, extra = {}) {
  return {
    code,
    ruleId: extra.ruleId || code,
    tier,
    message,
    herbs: extra.herbs || [],
    resolution: extra.resolution || (tier === 'A3' ? 'prescriber_revision' : 'pharmacist'),
    attestationKey: extra.attestationKey || null,
    counterfactual: extra.counterfactual || null,
    verifyWithPrescriber: Boolean(extra.verifyWithPrescriber),
    candidateEvidenceIds: safetyRules.ruleEvidence[code] ?? [],
  };
}

function doseLimitFor(name, herbRules) {
  const toxicKey = matchesAny(name, Object.keys(safetyRules.toxicHerbs));
  const legacyKey = Object.keys(herbRules).find((k) => name.includes(k));
  const toxic = toxicKey ? safetyRules.toxicHerbs[toxicKey] : null;
  const legacy = legacyKey ? herbRules[legacyKey] : null;
  if (!toxic && !legacy) return null;
  const max = Math.min(toxic?.max ?? Infinity, legacy?.max ?? Infinity);
  const min = Math.max(toxic?.min ?? 0, legacy?.min ?? 0);
  return { min, max: Number.isFinite(max) ? max : null, toxic, key: toxicKey || legacyKey };
}

function daysBetween(isoDate, now) {
  return Math.floor((now.getTime() - new Date(`${isoDate}T00:00:00Z`).getTime()) / 86400000);
}

/** Known herb = present in either rule table or any safety list. */
function isKnownHerb(name, herbRules) {
  const lists = [
    Object.keys(herbRules), Object.keys(safetyRules.toxicHerbs), safetyRules.specialManagedToxic, safetyRules.bannedHerbs,
    safetyRules.pregnancyContraindicated, safetyRules.pregnancyCaution, safetyRules.lactationCaution,
    safetyRules.hepatotoxic, safetyRules.nephrotoxic, ...Object.values(safetyRules.decoction),
    ...safetyRules.interactions.map((i) => i.herbs),
  ];
  return lists.some((l) => matchesAny(name, l));
}

function runRuleTrack(caseRecord, { now = new Date() } = {}) {
  const rules = loadRules();
  const { herbRules, eighteenIncompatible, nineteenFear } = rules;
  const L = safetyRules.limits;
  const patient = clinicalProjection(caseRecord.patient || {});
  const rx = caseRecord.prescription || {};
  const prescriber = caseRecord.prescriber || {};
  const herbs = (rx.herbs || []).map((h) => ({ ...h, name: String(h.name).trim() }));
  const names = herbs.map((h) => h.name);
  const hits = [];
  const missing = [];
  const need = (field, message, critical = true) => missing.push({ field, message, critical, source: 'rule' });

  // ---- completeness & legality
  if (herbs.length === 0) need('prescription.herbs', '处方未包含可识别的药味');
  herbs.forEach((h) => { if (h.dosage == null) need(`prescription.herbs.${h.name}.dosage`, `${h.name} 未注明剂量`); });
  const cf = require('../workflow/clinicalFacts');
  const pFacts = cf.attachFacts(patient);
  if (pFacts.facts.ageYears.status === 'not_asked' && patient.ageYears == null) need('patient.facts.ageYears', '缺少患者年龄');
  if (cf.allergyIsMissing(pFacts)) need('patient.facts.allergies', '过敏史未询问或未知，不能视为无过敏');
  if (!patient.sex || patient.sex === 'unknown') need('patient.sex', '缺少患者性别', false);
  if (rx.doseCount == null) need('prescription.doseCount', '缺少剂数');
  if (!rx.usage && !rx.frequency) need('prescription.usage', '缺少用法用量');
  if (!rx.form) need('prescription.form', '缺少剂型（汤剂/颗粒等）', false);
  if (!prescriber.name && !prescriber.id) {
    need('prescriber', '缺少处方医师信息');
    hits.push(hit('PRESCRIBER_MISSING', 'A2', '处方医师信息缺失，无法核验处方来源', {
      counterfactual: '补充处方医师姓名或工号并完成资质核验后可重新评估',
    }));
  }
  if (prescriber.licenseVerified === false) {
    hits.push(hit('SOURCE_ANOMALY', 'A3', '处方医师资质核验未通过，处方来源异常', {
      counterfactual: '需核实处方来源并由具备资质的医师重新开具',
    }));
  }
  if (patient.identityVerified === false) {
    hits.push(hit('IDENTITY_ANOMALY', 'A3', '患者身份核验未通过', {
      counterfactual: '需线下核验患者身份后重新提交',
    }));
  }
  if (rx.issuedAt) {
    const age = daysBetween(rx.issuedAt, now);
    if (age > L.prescriptionValidityDays) {
      hits.push(hit('PRESCRIPTION_EXPIRED', 'A3', `处方开具已 ${age} 天，超过演示规则有效期 ${L.prescriptionValidityDays} 天`, {
        counterfactual: '需处方医师重新开具处方',
      }));
    }
  } else {
    need('prescription.issuedAt', '缺少处方开具日期', false);
  }

  // ---- duplicates
  const seen = new Map();
  for (const n of names) seen.set(n, (seen.get(n) || 0) + 1);
  for (const [n, c] of seen) {
    if (c > 1) {
      hits.push(hit('DUPLICATE_HERB', 'A2', `${n} 在处方中重复出现 ${c} 次`, {
        herbs: [n], verifyWithPrescriber: true, counterfactual: `请处方医师确认 ${n} 是否为重复录入及合计剂量`,
      }));
    }
  }

  // ---- incompatibility pairs
  const pairHits = (pairs, code, label) => {
    for (const [a, b] of pairs) {
      const ha = names.find((n) => n.includes(a));
      const hb = names.find((n) => n.includes(b) && n !== ha);
      if (ha && hb) {
        hits.push(hit(code, 'A3', `${label}：${ha} 与 ${hb} 不宜同用`, {
          herbs: [ha, hb], ruleId: `${code}:${a}-${b}`, counterfactual: `${label}阻断：需处方医师修改处方（删除或调整 ${a}/${b} 其中之一）后重新评估`,
        }));
      }
    }
  };
  pairHits(eighteenIncompatible, 'EIGHTEEN_INCOMPATIBLE', '十八反');
  pairHits(nineteenFear, 'NINETEEN_FEAR', '十九畏');
  for (const h of herbs) {
    const key = Object.keys(herbRules).find((k) => h.name.includes(k));
    for (const inc of herbRules[key]?.incompatible || []) {
      const other = names.find((n) => n !== h.name && n.includes(inc));
      const already = hits.some((x) => (x.code === 'EIGHTEEN_INCOMPATIBLE' || x.code === 'NINETEEN_FEAR') && x.herbs.includes(h.name) && x.herbs.includes(other));
      if (other && !already) {
        hits.push(hit('INCOMPATIBLE_PAIR', 'A3', `${h.name} 与 ${other} 存在配伍禁忌（规则表）`, {
          herbs: [h.name, other], ruleId: `INCOMPATIBLE_PAIR:${key}-${inc}`, counterfactual: '需处方医师修改处方后重新评估',
        }));
      }
    }
  }

  // ---- banned, special-managed, toxic
  for (const h of herbs) {
    if (matchesAny(h.name, safetyRules.bannedHerbs)) {
      hits.push(hit('BANNED_HERB', 'A3', `${h.name} 属本演示规则禁用药材（含马兜铃酸类）`, {
        herbs: [h.name], counterfactual: '需处方医师更换处方，系统不提供替代药建议',
      }));
    }
    if (exactAny(h.name, safetyRules.specialManagedToxic)) {
      hits.push(hit('TOXIC_SPECIAL_MANAGED', 'A3', `${h.name} 属特殊管理毒性中药品种`, {
        herbs: [h.name], resolution: 'prescriber_attestation', attestationKey: `TOXIC_SPECIAL_MANAGED:${h.name}`,
        counterfactual: `需具备资质的处方医师出具专用处方并双签（TOXIC_SPECIAL_MANAGED:${h.name}）后重新评估`,
      }));
    }
  }

  // ---- dose
  let total = 0;
  for (const h of herbs) {
    if (h.dosage == null) continue;
    total += h.dosage;
    const lim = doseLimitFor(h.name, herbRules);
    if (!lim) continue;
    const isToxic = Boolean(lim.toxic);
    if (isToxic) {
      hits.push(hit('TOXIC_HERB_PRESENT', 'A2', `${h.name} 为${lim.toxic.toxicity}药材，需药师审核剂量与炮制规格`, {
        herbs: [h.name], counterfactual: null,
      }));
    }
    if (lim.max != null && h.dosage > lim.max) {
      const hard = h.dosage > lim.max * L.overdoseHardFactor || isToxic;
      if (hard) {
        hits.push(hit('OVERDOSE', 'A3', `${h.name} ${h.dosage}g 明显超过规则上限 ${lim.max}g`, {
          herbs: [h.name], resolution: 'prescriber_attestation', attestationKey: `OVERDOSE:${h.name}`, verifyWithPrescriber: true,
          counterfactual: `需处方医师核实 ${h.name} 剂量（规则上限 ${lim.max}g）；如确需超量，医师双签（OVERDOSE:${h.name}）后重新评估`,
        }));
      } else {
        hits.push(hit('DOSE_ABOVE_RANGE', 'A2', `${h.name} ${h.dosage}g 超过常用范围 ${lim.min}-${lim.max}g`, {
          herbs: [h.name], verifyWithPrescriber: true, counterfactual: `建议与处方医师核实 ${h.name} 剂量是否为处方意图`,
        }));
      }
    } else if (lim.min && h.dosage < lim.min) {
      hits.push(hit('DOSE_BELOW_RANGE', 'A1', `${h.name} ${h.dosage}g 低于常用范围 ${lim.min}-${lim.max}g`, { herbs: [h.name] }));
    }
  }
  if (herbs.length > L.maxHerbCount) {
    hits.push(hit('HERB_COUNT_HIGH', 'A2', `药味数 ${herbs.length} 超过 ${L.maxHerbCount}`, {}));
  }
  if (total > L.totalDailyDoseMaxG) {
    hits.push(hit('TOTAL_DOSE_HIGH', 'A2', `全方每剂总量 ${total}g 超过 ${L.totalDailyDoseMaxG}g`, { verifyWithPrescriber: true }));
  }

  // ---- special populations
  const age = patient.ageYears;
  const toxicNames = herbs.filter((h) => matchesAny(h.name, Object.keys(safetyRules.toxicHerbs)) || exactAny(h.name, safetyRules.specialManagedToxic)).map((h) => h.name);
  const [fertileLo, fertileHi] = L.fertileAgeRange;
  const pregContra = names.filter((n) => matchesAny(n, safetyRules.pregnancyContraindicated));
  const pregCaution = names.filter((n) => matchesAny(n, safetyRules.pregnancyCaution) && !pregContra.includes(n));
  if (patient.pregnancy === 'yes') {
    pregContra.forEach((n) => hits.push(hit('PREGNANCY_CONTRAINDICATED', 'A3', `孕妇禁用：${n}`, {
      herbs: [n], resolution: 'prescriber_attestation', attestationKey: `PREGNANCY_CONTRAINDICATED:${n}`,
      counterfactual: `妊娠禁用药阻断：需处方医师确认并双签（PREGNANCY_CONTRAINDICATED:${n}）后由药师重新审核`,
    })));
    pregCaution.forEach((n) => hits.push(hit('PREGNANCY_CAUTION', 'A2', `孕妇慎用：${n}`, { herbs: [n] })));
  } else if (patient.pregnancy !== 'no' && patient.sex === 'female' && typeof age === 'number' && age >= fertileLo && age <= fertileHi && (pregContra.length || pregCaution.length)) {
    need('patient.pregnancy', '育龄期女性处方含妊娠禁用/慎用药材，需确认妊娠状态');
    hits.push(hit('PREGNANCY_STATUS_UNKNOWN', 'A2', `妊娠状态未确认，处方含 ${[...pregContra, ...pregCaution].join('、')}`, {
      herbs: [...pregContra, ...pregCaution], counterfactual: '补充妊娠状态后重新评估',
    }));
  }
  if (patient.lactation === 'yes') {
    names.filter((n) => matchesAny(n, safetyRules.lactationCaution)).forEach((n) => hits.push(hit('LACTATION_CAUTION', 'A2', `哺乳期慎用：${n}`, { herbs: [n] })));
  }
  if (typeof age === 'number' && age <= L.pediatricAgeMax) {
    if (toxicNames.length) {
      hits.push(hit('PEDIATRIC_TOXIC', 'A3', `${age} 岁儿童处方含有毒药材：${toxicNames.join('、')}`, {
        herbs: toxicNames, resolution: 'prescriber_attestation', attestationKey: 'PEDIATRIC_TOXIC',
        counterfactual: '需处方医师按儿童体重核实剂量并双签（PEDIATRIC_TOXIC）后重新评估',
      }));
    }
    const adultish = herbs.filter((h) => {
      const lim = doseLimitFor(h.name, herbRules);
      return lim?.max && h.dosage != null && h.dosage > lim.max * L.pediatricDoseFactor;
    });
    if (adultish.length) {
      hits.push(hit('PEDIATRIC_DOSE_CHECK', 'A2', `${age} 岁儿童处方中 ${adultish.map((h) => h.name).join('、')} 接近成人剂量`, {
        herbs: adultish.map((h) => h.name), verifyWithPrescriber: true, counterfactual: '补充体重并由处方医师确认儿童折算剂量',
      }));
    }
    if (patient.weightKg == null) need('patient.weightKg', '儿童处方需提供体重', false);
  }
  if (typeof age === 'number' && age >= L.veryElderlyAge && toxicNames.length) {
    hits.push(hit('VERY_ELDERLY_TOXIC', 'A3', `${age} 岁高龄患者处方含有毒药材：${toxicNames.join('、')}`, {
      herbs: toxicNames, resolution: 'prescriber_attestation', attestationKey: 'VERY_ELDERLY_TOXIC',
      counterfactual: '需处方医师评估肝肾功能并双签（VERY_ELDERLY_TOXIC）后重新评估',
    }));
  } else if (typeof age === 'number' && age >= L.geriatricAge && toxicNames.length) {
    hits.push(hit('GERIATRIC_TOXIC', 'A2', `${age} 岁老年患者处方含有毒药材：${toxicNames.join('、')}`, { herbs: toxicNames }));
  }

  // ---- allergy
  for (const allergen of cf.reportedAllergyNames(pFacts)) {
    const a = String(allergen).trim();
    if (!a) continue;
    const matched = names.filter((n) => n.includes(a) || a.includes(n));
    if (matched.length) {
      const severe = patient.allergySeverity !== 'mild';
      hits.push(hit(severe ? 'SEVERE_ALLERGY' : 'ALLERGY_MATCH', severe ? 'A3' : 'A2', `患者对「${a}」过敏，处方含 ${matched.join('、')}${severe ? '（严重或程度不明）' : ''}`, {
        herbs: matched, counterfactual: severe ? '需处方医师更换处方' : '需药师与患者确认过敏程度',
      }));
    }
  }

  // ---- organ function
  if (cf.liverReportedTrue(pFacts)) {
    names.filter((n) => matchesAny(n, safetyRules.hepatotoxic)).forEach((n) => hits.push(hit('HEPATOTOXIC_RISK', 'A2', `肝功能异常患者使用 ${n}`, { herbs: [n] })));
  }
  if (cf.renalReportedTrue(pFacts)) {
    names.filter((n) => matchesAny(n, safetyRules.nephrotoxic)).forEach((n) => hits.push(hit('NEPHROTOXIC_RISK', 'A2', `肾功能异常患者使用 ${n}`, { herbs: [n] })));
  }

  // ---- herb–drug interactions
  const meds = cf.activeMedications(pFacts).map((m) => String(m.name).toLowerCase());
  for (const rule of safetyRules.interactions) {
    const hs = names.filter((n) => matchesAny(n, rule.herbs));
    const ds = rule.drugs.filter((d) => meds.some((m) => m.includes(d.toLowerCase())));
    if (hs.length && ds.length) {
      const h = hit('HERB_DRUG_INTERACTION', 'A2', `${hs.join('、')} 与 ${ds.join('、')}：${rule.message}`, { herbs: hs, ruleId: rule.id });
      h.candidateEvidenceIds = rule.evidence;
      hits.push(h);
    }
  }
  if (cf.attachFacts(patient).facts.currentMedications.status === 'not_asked' || cf.attachFacts(patient).facts.currentMedications.status === 'unknown') need('patient.facts.currentMedications', '合并用药未询问或未知', false);

  // ---- decoction
  const notes = `${rx.decoctionNotes || ''}`;
  for (const [method, list] of Object.entries(safetyRules.decoction)) {
    for (const h of herbs) {
      if (!matchesAny(h.name, list)) continue;
      const declared = (h.processing || '').includes(method) || (notes.includes(h.name) && notes.includes(method));
      if (declared) continue;
      const toxicPreboil = method === '先煎' && safetyRules.toxicHerbs[matchesAny(h.name, Object.keys(safetyRules.toxicHerbs))]?.preboil;
      hits.push(hit(toxicPreboil ? 'DECOCTION_PREBOIL_MISSING' : 'DECOCTION_METHOD_NOTE', toxicPreboil ? 'A2' : 'A1',
        `${h.name} 通常需${method}，处方未注明`, { herbs: [h.name], counterfactual: `请确认 ${h.name} 的煎煮方法（${method}）` }));
    }
  }

  // ---- herbs the rule set cannot judge
  const unknown = names.filter((n) => !isKnownHerb(n, herbRules));
  unknown.forEach((n) => hits.push(hit('HERB_NOT_IN_RULESET', 'A2', `${n} 不在规则库中，交模型结合检索对照判断剂量与禁忌（非正式药典，需药师复核）`, { herbs: [n] })));
  const highRiskPopulation = patient.pregnancy === 'yes' || (typeof age === 'number' && (age < 6 || age >= L.veryElderlyAge));
  if (unknown.length && highRiskPopulation) {
    hits.push(hit('UNJUDGEABLE_HIGH_RISK', 'A3', `高风险人群处方含规则库未覆盖药材：${unknown.join('、')}`, {
      herbs: unknown, resolution: 'prescriber_attestation', attestationKey: 'UNJUDGEABLE_HIGH_RISK',
      counterfactual: '需处方医师书面确认（UNJUDGEABLE_HIGH_RISK）后由药师审核',
    }));
  }

  // ---- prescriber attestations: deterministic, only for attestation-resolvable stops
  const attestations = new Set(rx.prescriberAttestations || []);
  for (const h of hits) {
    if (h.tier === 'A3' && h.resolution === 'prescriber_attestation' && attestations.has(h.attestationKey)) {
      h.tier = 'A2';
      h.attested = true;
      h.message = `${h.message}（处方医师已双签：${h.attestationKey}，需药师审核）`;
    }
  }

  let tier = herbs.length ? 'A1' : 'A2';
  for (const h of hits) tier = maxTier(tier, h.tier);
  if (missing.some((m) => m.critical)) tier = maxTier(tier, 'A2');

  let legacy = null;
  if (herbs.length) {
    const r = legacyReview({ herbs: herbs.map((h) => ({ name: h.name, dosage: h.dosage, unit: h.unit || 'g' })), patientAge: age, diagnosis: rx.diagnosisText || '' });
    legacy = { engine: r.engine, rulesVersion: r.rulesVersion, score: r.score, status: r.status, warningCount: r.warnings.length };
  }

  return {
    version: ruleSetVersion(),
    tier,
    hits,
    missingInformation: missing,
    totalDoseG: Math.round(total * 100) / 100,
    herbCount: herbs.length,
    unknownHerbs: unknown,
    legacyReview: legacy,
  };
}

function substitutionCandidatesFor() {
  return [];
}

module.exports = {
  runRuleTrack, ruleSetVersion, substitutionCandidatesFor, TIER_ORDER, maxTier, safetyRules,
};
