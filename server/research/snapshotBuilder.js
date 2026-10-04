/**
 * Freeze one de-identified research case per existing synthetic patient.
 * Does not invent clinical facts. Unlabeled seed rows stay synthetic.
 */
const { hashObject, sha256 } = require('../common/hash');
const safetyRules = require('../config/ai-safety-rules.json');

const SELECTION_RULE = {
  id: 'one-rx-per-patient-date-asc-id-asc@1',
  text: 'For each patient, choose the prescription with the earliest date, then the lowest numeric id. One patient yields one base case.',
};

const ENCOUNTER_RULE = {
  id: 'issued-at-as-encounter@1',
  text: 'Analyze as of the frozen issuedAt date. The original issue date is kept. Stale-at-evaluation-now is a stratum, not a rewritten date. The expiry rule is not deleted.',
};

const DATASET_ID = 'research-500-v1';
const DATASET_VERSION = '1.1.0';
const ANALYZABLE_UNITS = new Set(['g', '克']);
const UNSUPPORTED_UNITS = new Set(['kg', '千克', 'ml', '毫升', '盒', '瓶', '袋']);

function sexOf(gender) {
  if (gender === '男' || gender === 'male') return 'male';
  if (gender === '女' || gender === 'female') return 'female';
  return null;
}

function parseDose(raw) {
  if (raw == null || raw === '') return { ok: false, reason: 'missing_dose', raw };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return { ok: false, reason: 'invalid_dose', raw };
    return { ok: true, qty: raw, unit: 'g' };
  }
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-zµμ\u4e00-\u9fff]+)?$/);
  if (!m) return { ok: false, reason: 'unparsed_dose', raw: s };
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, reason: 'invalid_dose', raw: s };
  const unitRaw = m[2];
  if (!unitRaw) return { ok: false, reason: 'missing_unit', raw: s };
  if (UNSUPPORTED_UNITS.has(unitRaw) || !ANALYZABLE_UNITS.has(unitRaw)) {
    return { ok: false, reason: 'unsupported_unit', raw: s, unit: unitRaw };
  }
  return { ok: true, qty, unit: 'g' };
}

function parseDoseCount(raw) {
  if (raw == null || raw === '') return { ok: false, reason: 'missing_dose_count', raw };
  if (typeof raw === 'string' && !/^\d+$/.test(String(raw).trim())) {
    return { ok: false, reason: 'invalid_dose_count', raw };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return { ok: false, reason: 'invalid_dose_count', raw };
  }
  return { ok: true, value: n };
}

function parseHerbs(rx) {
  const lines = Array.isArray(rx?.herbs) ? rx.herbs : [];
  const herbs = [];
  const errors = [];
  for (const h of lines) {
    const name = String(h?.name || '').trim();
    if (!name) {
      errors.push({ reason: 'missing_herb_name', raw: h });
      continue;
    }
    const dose = parseDose(h.dosage);
    if (!dose.ok) {
      errors.push({ reason: dose.reason, herb: name, raw: h.dosage, unit: dose.unit || null });
      continue;
    }
    herbs.push({ name, dosage: dose.qty, unit: 'g' });
  }
  return {
    herbs: errors.length ? [] : herbs,
    errors,
    sourceHerbs: lines,
    unanalyzable: errors.length > 0,
  };
}

function daysBetween(isoDate, now) {
  return Math.floor((new Date(now).getTime() - new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`).getTime()) / 86400000);
}

function scriptsFromKnown(known) {
  const script = {};
  if (known.ageYears != null) {
    script['patient.facts.ageYears'] = { status: 'reported', value: known.ageYears, source: 'script_from_source' };
  } else {
    script['patient.facts.ageYears'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  }
  if (known.allergies?.value?.length) {
    script['patient.facts.allergies'] = { status: 'reported', value: known.allergies.value, source: 'script_from_source' };
  } else {
    script['patient.facts.allergies'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  }
  script['patient.facts.pregnancy'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  script['patient.facts.currentMedications'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  script['patient.facts.liverImpairment'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  script['patient.facts.lactation'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  script['patient.facts.renalImpairment'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  script['patient.facts.weightKg'] = { status: 'unknown', value: null, source: 'script_absent_in_source' };
  return script;
}

function provenanceOf(patient, rx) {
  const evidence = [];
  if (patient?.demoTag === 'synthetic') evidence.push('patient.demoTag=synthetic');
  if (rx?.demoTag === 'synthetic') evidence.push('prescription.demoTag=synthetic');
  if (patient && patient.demoTag !== 'synthetic') evidence.push('unlabeled_initialization_record');
  if (!evidence.length) evidence.push('unlabeled_initialization_record');
  return {
    kind: 'synthetic',
    evidence,
    note: 'Initialization demo rows without a synthetic tag are still synthetic. Patient id is not used to infer live vs demo.',
  };
}

function knownFactsFromPatient(patient) {
  const complete = {};
  const sex = sexOf(patient.gender);
  if (sex) complete.sex = sex;
  const age = Number(patient.age);
  if (Number.isFinite(age) && age > 0 && age < 120) complete.ageYears = age;
  if (Array.isArray(patient.allergies) && patient.allergies.length) {
    complete.allergies = {
      status: 'reported',
      value: patient.allergies.map(String),
      source: 'synthetic_catalog',
    };
  }
  if (Array.isArray(patient.medicalHistory) && patient.medicalHistory.length) {
    complete.medicalHistory = [...patient.medicalHistory];
  }
  return complete;
}

function researchCaseId(patientRef, rxId) {
  return `RC-${sha256(`${patientRef}|${rxId}`).slice(0, 16)}`;
}

function splitOf(baseId) {
  const n = parseInt(sha256(baseId).slice(0, 8), 16);
  return (n % 10) < 2 ? 'dev' : 'test';
}

function pickPrescription(rxs) {
  return [...rxs].sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    if (da !== db) return da.localeCompare(db);
    return Number(a.id) - Number(b.id);
  })[0];
}

function buildScenes(base, known) {
  const scenes = [];
  const split = base.split;
  const askable = scriptsFromKnown(known);
  scenes.push({
    id: `${base.baseId}:complete`,
    baseId: base.baseId,
    split,
    category: 'complete',
    description: 'All facts present in the source record are visible. Absent fields stay unknown.',
    initialObservedFacts: { ...known },
    hiddenPatientFacts: {},
    patientAnswerScript: { ...askable },
    narrativeText: narrativeFromFacts(known, base.prescription),
  });
  if (known.allergies?.value?.length) {
    const { allergies, ...rest } = known;
    scenes.push({
      id: `${base.baseId}:omit-allergy`,
      baseId: base.baseId,
      split,
      category: 'critical_missing',
      description: 'Known allergy list withheld from the initial chart; script reports the same list.',
      initialObservedFacts: rest,
      hiddenPatientFacts: { allergies: allergies.value },
      patientAnswerScript: { ...askable, 'patient.facts.allergies': { status: 'reported', value: allergies.value, source: 'script_from_source' } },
      narrativeText: narrativeFromFacts(rest, base.prescription),
    });
  } else {
    scenes.push({
      id: `${base.baseId}:unknown-allergy`,
      baseId: base.baseId,
      split,
      category: 'unknown',
      description: 'Source has no usable allergy list. Script answers unknown. Empty list is not treated as none.',
      initialObservedFacts: { ...known },
      hiddenPatientFacts: { allergies: 'unknown' },
      patientAnswerScript: { ...askable },
      narrativeText: narrativeFromFacts(known, base.prescription),
    });
  }
  scenes.push({
    id: `${base.baseId}:paraphrase`,
    baseId: base.baseId,
    split,
    category: 'colloquial',
    description: 'Natural-language paraphrase of the same visible facts. Wording is not a new clinical fact.',
    initialObservedFacts: { ...known },
    hiddenPatientFacts: {},
    patientAnswerScript: { ...askable },
    narrativeText: narrativeFromFacts(known, base.prescription, { colloquial: true }),
    paraphraseOf: `${base.baseId}:complete`,
  });
  return scenes.map((s) => ({
    ...s,
    expertReferenceLabels: { reviewStatus: 'unreviewed' },
    expertReviewStatus: 'unreviewed',
    clinicalCorrectness: 'not_evaluated',
    prescription: base.prescription,
    researchCaseId: s.id,
    encounterAt: base.encounterAt,
    evaluationNow: base.evaluationNow,
    staleAtEvaluationNow: base.staleAtEvaluationNow,
  }));
}

function narrativeFromFacts(facts, prescription, { colloquial } = {}) {
  const sex = facts.sex === 'female' ? (colloquial ? '女同志' : '女性') : facts.sex === 'male' ? (colloquial ? '男的' : '男性') : '性别未写';
  const age = facts.ageYears != null ? (colloquial ? `大概${facts.ageYears}岁` : `${facts.ageYears}岁`) : '年龄未写';
  const alg = facts.allergies?.value?.length
    ? `已知过敏 ${facts.allergies.value.join('、')}`
    : '过敏史未提供';
  const herbs = (prescription?.herbs || []).map((h) => `${h.name}${h.dosage}${h.unit || ''}`).join('，');
  return `${sex}，${age}。${alg}。处方：${herbs || '未解析'}。`;
}

function buildSnapshot({ patients = [], prescriptions = [], sourceVersion = 'store', evaluationNow = null } = {}) {
  const frozenEvalNow = evaluationNow || new Date().toISOString();
  const validityDays = Number(safetyRules.limits?.prescriptionValidityDays || 3);
  const exceptions = [];
  const seenRef = new Set();
  const seenCase = new Set();
  const bases = [];
  const byPatient = new Map();
  for (const rx of prescriptions || []) {
    const pid = rx.patientId;
    if (pid == null) {
      exceptions.push({ code: 'rx_missing_patient', prescriptionId: rx.id });
      continue;
    }
    if (!byPatient.has(pid)) byPatient.set(pid, []);
    byPatient.get(pid).push(rx);
  }

  for (const patient of patients || []) {
    const ref = patient.patientRef || (patient.id != null ? `P${patient.id}` : null);
    if (!ref) {
      exceptions.push({ code: 'patient_missing_ref', patientId: patient.id });
      continue;
    }
    if (seenRef.has(ref)) {
      exceptions.push({ code: 'duplicate_patient_ref', patientRef: ref, patientId: patient.id });
      continue;
    }
    seenRef.add(ref);
    const rxs = byPatient.get(patient.id) || [];
    if (!rxs.length) {
      exceptions.push({ code: 'patient_without_prescription', patientRef: ref });
      continue;
    }
    const rx = pickPrescription(rxs);
    if (Number(rx.patientId) !== Number(patient.id)) {
      exceptions.push({ code: 'prescription_patient_mismatch', patientRef: ref, prescriptionId: rx.id });
      continue;
    }
    const parsed = parseHerbs(rx);
    if (parsed.unanalyzable || !parsed.herbs.length) {
      exceptions.push({
        code: 'unanalyzable_prescription',
        patientRef: ref,
        prescriptionId: rx.id,
        errors: parsed.errors,
        sourceHerbs: parsed.sourceHerbs,
        executable: false,
      });
      continue;
    }
    const doseParsed = parseDoseCount(rx.doseCount);
    if (rx.doseCount != null && rx.doseCount !== '' && !doseParsed.ok) {
      exceptions.push({
        code: 'unanalyzable_dose_count',
        patientRef: ref,
        prescriptionId: rx.id,
        raw: rx.doseCount,
        reason: doseParsed.reason,
        executable: false,
      });
      continue;
    }
    const baseId = researchCaseId(ref, rx.id);
    if (seenCase.has(baseId)) {
      exceptions.push({ code: 'duplicate_research_case', baseId });
      continue;
    }
    seenCase.add(baseId);
    const known = knownFactsFromPatient(patient);
    const declaredDefaults = {};
    if (!doseParsed.ok) declaredDefaults.doseCount = 7;
    if (!rx.usage) declaredDefaults.usage = '水煎服';
    if (!rx.form) declaredDefaults.form = 'decoction';
    const issuedAt = String(rx.date || '').slice(0, 10) || null;
    const prescription = {
      herbs: parsed.herbs,
      doseCount: doseParsed.ok ? doseParsed.value : declaredDefaults.doseCount,
      usage: rx.usage || declaredDefaults.usage,
      form: rx.form || declaredDefaults.form,
      issuedAt,
      declaredDefaults,
    };
    const staleAtEvaluationNow = Boolean(issuedAt && daysBetween(issuedAt, frozenEvalNow) > validityDays);
    bases.push({
      baseId,
      split: splitOf(baseId),
      provenance: provenanceOf(patient, rx),
      knownCompleteFacts: known,
      prescription,
      encounterAt: issuedAt,
      evaluationNow: frozenEvalNow,
      staleAtEvaluationNow,
      source: { storePatientRef: ref, storePrescriptionId: rx.id },
    });
  }

  const cases = [];
  for (const base of bases) {
    for (const scene of buildScenes(base, base.knownCompleteFacts)) cases.push(scene);
  }

  const payload = {
    datasetId: DATASET_ID,
    version: DATASET_VERSION,
    generatedAt: frozenEvalNow,
    evaluationNow: frozenEvalNow,
    encounterRule: ENCOUNTER_RULE,
    prescriptionValidityDays: validityDays,
    sourceVersion,
    selectionRule: SELECTION_RULE,
    purpose: {
      dev: 'development',
      test: 'formal_evaluation',
      note: 'Scenes of one base case stay in the same split. Dev must not be reported as an independent test set.',
    },
    expertReviewStatus: 'unreviewed',
    clinicalCorrectness: 'not_evaluated',
    label: '500 synthetic base cases from the existing demo catalog. Not a clinical gold standard. Not real patients.',
    archivedInteractivePack: 'benchmarks/ai-review/cases-interactive-v1.json',
    defaults: {
      source: { channel: 'research_snapshot' },
      prescriber: { name: '合成医师', licenseVerified: true },
    },
    baseCases: bases.map((b) => ({
      baseId: b.baseId,
      split: b.split,
      provenance: b.provenance,
      knownCompleteFacts: b.knownCompleteFacts,
      prescription: b.prescription,
      encounterAt: b.encounterAt,
      evaluationNow: b.evaluationNow,
      staleAtEvaluationNow: b.staleAtEvaluationNow,
      source: b.source,
    })),
    cases,
    exceptions,
    counts: {
      sourcePatients: (patients || []).length,
      sourcePrescriptions: (prescriptions || []).length,
      baseCases: bases.length,
      scenes: cases.length,
      exceptions: exceptions.length,
      unlabeledSynthetic: bases.filter((b) => b.provenance.evidence.includes('unlabeled_initialization_record')).length,
    },
  };
  payload.contentHash = hashSnapshotContent(payload);
  return payload;
}

function hashSnapshotContent(payload) {
  return hashObject({
    datasetId: payload.datasetId,
    version: payload.version,
    evaluationNow: payload.evaluationNow,
    encounterRule: payload.encounterRule,
    defaults: payload.defaults,
    selectionRule: payload.selectionRule,
    baseCases: payload.baseCases,
    cases: (payload.cases || []).map((c) => ({
      id: c.id,
      baseId: c.baseId,
      split: c.split,
      category: c.category,
      initialObservedFacts: c.initialObservedFacts,
      hiddenPatientFacts: c.hiddenPatientFacts,
      patientAnswerScript: c.patientAnswerScript,
      prescription: c.prescription,
      narrativeText: c.narrativeText || null,
      encounterAt: c.encounterAt || null,
      staleAtEvaluationNow: Boolean(c.staleAtEvaluationNow),
    })),
    exceptions: payload.exceptions,
  });
}

module.exports = {
  SELECTION_RULE,
  ENCOUNTER_RULE,
  DATASET_ID,
  DATASET_VERSION,
  parseDose,
  parseDoseCount,
  parseHerbs,
  scriptsFromKnown,
  provenanceOf,
  knownFactsFromPatient,
  hashSnapshotContent,
  buildSnapshot,
  researchCaseId,
};
