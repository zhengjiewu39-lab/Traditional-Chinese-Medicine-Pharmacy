/**
 * Generate demo prescriptions linked to patients (synthetic, no PHI).
 */

const { loadRules } = require('../services/ruleLoader');
const { analyzePrescription } = require('../services/prescriptionAnalyzer');
const cdssEngine = require('../services/cdssEngine');

const DOCTORS = ['赵医生', '李医生', '张医生', '王医生', '陈医生', '刘医生'];
const REVIEWERS = ['李药师', '王药师', '张药师', '陈药师'];
const DIAGNOSES = [
  '气血两虚', '风热感冒', '脾胃虚寒', '肝郁气滞', '失眠多梦', '头痛眩晕',
  '咳嗽痰多', '月经不调', '腰膝酸软', '水肿', '胸痹心痛', '消化不良',
  '肾阳不足', '阴虚火旺', '风湿痹痛',
];

const { getRawHerbNames } = require('./herbCatalog');

const HERB_POOL = getRawHerbNames();

function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function fmtHerb(name, dosage, unit = 'g') {
  return `${name}${dosage}${unit}`;
}

function parseHerbsFromText(text) {
  return text.split(/[，,、]+/).filter(Boolean).map((part) => {
    const m = part.trim().match(/^(.+?)(\d+(?:\.\d+)?\s*(?:g|克|盒|瓶|袋)?)$/);
    if (m) return { name: m[1].trim(), dosage: m[2].trim() };
    return { name: part.trim(), dosage: '10g' };
  });
}

function herbsToText(herbs) {
  return herbs.map((h) => `${h.name}${h.dosage || '10g'}`).join('，');
}

function buildSafeFormula(rng, herbKeys) {
  const n = 4 + Math.floor(rng() * 4);
  const chosen = [];
  while (chosen.length < n) {
    const h = pick(rng, HERB_POOL);
    if (!chosen.includes(h)) chosen.push(h);
  }
  return chosen.map((h) => {
    const rule = herbKeys[h];
    const d = rule ? rule.min + rng() * (rule.max - rule.min) : 6 + rng() * 8;
    return { name: h, dosage: `${+d.toFixed(1)}g` };
  });
}

function buildRiskFormula(rng, herbKeys) {
  const type = rng();
  if (type < 0.4) {
    return [
      { name: '甘草', dosage: '10g' },
      { name: '甘遂', dosage: `${(0.8 + rng() * 0.4).toFixed(1)}g` },
    ];
  }
  if (type < 0.7) {
    const h = pick(rng, ['甘草', '黄芪', '当归']);
    const rule = herbKeys[h];
    const high = rule ? rule.max * (1.4 + rng() * 0.5) : 28;
    return [
      { name: h, dosage: `${+high.toFixed(1)}g` },
      { name: '白芍', dosage: '10g' },
      { name: '川芎', dosage: '6g' },
    ];
  }
  return [
    { name: '人参', dosage: '6g' },
    { name: '莱菔子', dosage: '10g' },
  ];
}

function randomDateInPastYear(rng) {
  const daysAgo = Math.floor(rng() * 330);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function pickStatus(rng, analysisStatus) {
  const r = rng();
  if (analysisStatus === '需修改') {
    if (r < 0.5) return '待审核';
    if (r < 0.75) return '已驳回';
    return '待审核';
  }
  if (r < 0.55) return '已完成';
  if (r < 0.7) return '待取药';
  if (r < 0.85) return '待审核';
  if (r < 0.92) return '配药中';
  return '已审核';
}

function generatePickupCode(existingCodes, rng) {
  const codes = new Set(existingCodes);
  let code;
  do {
    code = 'TCM' + String(Math.floor(100000 + rng() * 900000));
  } while (codes.has(code));
  codes.add(code);
  return code;
}

function buildTimeline(status, dateIso, reviewer, note) {
  return [{ status, at: `${dateIso}T10:00:00.000Z`, actor: reviewer || '系统', note: note || '' }];
}

function generatePrescriptionForPatient(patient, rxId, rng, rules, existingCodes) {
  const herbKeys = rules.herbRules || {};
  const useRisk = rng() < 0.12;
  const herbs = useRisk ? buildRiskFormula(rng, herbKeys) : buildSafeFormula(rng, herbKeys);
  const prescriptionText = herbsToText(herbs);
  const diagnosis = patient.primaryDiagnosis || pick(rng, DIAGNOSES);

  const ruleAnalysis = analyzePrescription({
    prescription: prescriptionText,
    diagnosis,
    patientAge: patient.age,
    patientGender: patient.gender,
  }, { rules });

  const cdss = cdssEngine.analyzePrescription({
    prescription: prescriptionText,
    diagnosis,
    patientAge: patient.age,
    patientGender: patient.gender,
  });

  const status = pickStatus(rng, ruleAnalysis.status);
  const date = randomDateInPastYear(rng);
  const doctor = pick(rng, DOCTORS);
  const reviewer = status === '待审核' ? null : pick(rng, REVIEWERS);
  const needsCode = ['待取药', '已完成', '配药中', '已审核'].includes(status);
  const pickupCode = needsCode ? generatePickupCode(existingCodes, rng) : null;
  if (pickupCode) existingCodes.push(pickupCode);

  const timelineNote = status === '待审核'
    ? '等待药师 ADR 预防审方'
    : `CDSS 审方 · 评分 ${cdss.score} · ${cdss.joint?.status || ruleAnalysis.status}`;

  return {
    id: rxId,
    patientId: patient.id,
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    doctor,
    diagnosis,
    date,
    herbs,
    prescriptionText,
    status,
    pickupCode,
    reviewer,
    reviewScore: cdss.score,
    cdssStatus: cdss.joint?.status || ruleAnalysis.status,
    cdssLabel: cdss.label,
    warnings: (cdss.joint?.alerts || ruleAnalysis.warnings || []).slice(0, 5),
    analysisSummary: cdss.summary || ruleAnalysis.summary,
    adrRiskScore: cdss.adrPrevention?.adrRiskScore,
    demoTag: 'synthetic',
    timeline: buildTimeline(status, date, reviewer, timelineNote),
  };
}

function generateDemoPrescriptions(patients, options = {}) {
  const { seed = 20260707, startId = 1, perPatient = 1 } = options;
  const rng = mulberry32(seed);
  const rules = loadRules();
  const existingCodes = [];
  const prescriptions = [];
  let rxId = startId;

  for (const patient of patients) {
    const count = Math.max(perPatient, 1);
    for (let i = 0; i < count; i++) {
      prescriptions.push(generatePrescriptionForPatient(patient, rxId, rng, rules, existingCodes));
      rxId += 1;
    }
  }

  prescriptions.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    prescriptions,
    nextPrescriptionId: rxId,
  };
}

function syncPatientPrescriptionCounts(patients, prescriptions) {
  const counts = {};
  prescriptions.forEach((rx) => {
    counts[rx.patientId] = (counts[rx.patientId] || 0) + 1;
  });
  patients.forEach((p) => {
    if (counts[p.id]) p.prescriptionCount = counts[p.id];
  });
}

function ensureDemoPrescriptions(store, perPatient = 1) {
  const patients = store.patients || [];
  const existing = store.prescriptions || [];
  const demoRx = existing.filter((rx) => rx.demoTag === 'synthetic' || rx.patientId > 3);
  const patientsWithoutRx = patients.filter(
    (p) => !existing.some((rx) => rx.patientId === p.id)
  );

  if (patientsWithoutRx.length === 0 && demoRx.length >= patients.length) {
    return { added: 0, total: existing.length };
  }

  const startId = existing.length > 0
    ? Math.max(...existing.map((r) => r.id)) + 1
    : 1;

  const { prescriptions: newRx, nextPrescriptionId } = generateDemoPrescriptions(
    patientsWithoutRx.length ? patientsWithoutRx : patients,
    { startId, perPatient, seed: 20260707 + startId }
  );

  store.prescriptions = [...existing, ...newRx];
  syncPatientPrescriptionCounts(store.patients, store.prescriptions);

  store.nextId = store.nextId || {};
  store.nextId.prescription = Math.max(store.nextId.prescription || 1, nextPrescriptionId);

  return { added: newRx.length, total: store.prescriptions.length };
}

module.exports = {
  generateDemoPrescriptions,
  ensureDemoPrescriptions,
  syncPatientPrescriptionCounts,
  herbsToText,
  parseHerbsFromText,
};
