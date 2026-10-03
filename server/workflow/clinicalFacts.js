/**
 * Clinical facts: false / [] is not "explicitly none".
 * Legacy booleans and empty arrays migrate to unknown.
 */
const FACT_STATUSES = ['not_asked', 'unknown', 'none', 'denied', 'reported', 'verified', 'conflicting', 'not_applicable'];
const MED_STATUSES = ['active', 'stopped', 'unknown'];
const CHANGE_KINDS = ['add', 'stop', 'correct'];

function fact({
  status = 'not_asked', value = null, unit = null,
  reportedBy = null, reportedAt = null, verifiedBy = null, verifiedAt = null,
  source = 'legacy_unknown', version = 1,
  fieldPath = null, sourceText = null, contentVersion = null,
  previousValues = null, candidateScore = null,
} = {}) {
  const st = FACT_STATUSES.includes(status) ? status : 'unknown';
  const keepValue = ['reported', 'verified', 'none', 'denied', 'conflicting', 'not_applicable'].includes(st);
  return {
    status: st,
    value: keepValue ? value : null,
    unit,
    reportedBy,
    reportedAt,
    verifiedBy: st === 'verified' ? verifiedBy : null,
    verifiedAt: st === 'verified' ? verifiedAt : null,
    source,
    version,
    fieldPath,
    sourceText,
    contentVersion,
    previousValues: Array.isArray(previousValues) ? previousValues : undefined,
    candidateScore: typeof candidateScore === 'number' ? candidateScore : undefined,
  };
}

function migrateBoolean(v) {
  if (v === true) return fact({ status: 'reported', value: true, source: 'legacy_boolean_true' });
  return fact({ status: 'unknown', value: null, source: 'legacy_unconfirmed' });
}

function migrateTri(v) {
  if (v === 'yes') return fact({ status: 'reported', value: 'yes', source: 'legacy_tri' });
  if (v === 'no') return fact({ status: 'none', value: 'no', source: 'legacy_tri' });
  if (v === 'unknown') return fact({ status: 'unknown', value: null, source: 'legacy_tri' });
  return fact({ status: 'not_asked', value: null, source: 'legacy_absent' });
}

function migrateScalar(v, unit) {
  if (v == null || v === '') return fact({ status: 'not_asked', unit, source: 'legacy_absent' });
  return fact({ status: 'reported', value: v, unit, source: 'legacy_scalar' });
}

function looksLikeFact(x) {
  return x && typeof x === 'object' && !Array.isArray(x) && FACT_STATUSES.includes(x.status);
}

function migrateAllergyList(list) {
  if (looksLikeFact(list)) {
    const names = Array.isArray(list.value) ? list.value.map(String) : [];
    return {
      fact: fact({
        status: list.status,
        value: list.status === 'reported' ? names : (list.status === 'none' ? [] : null),
        source: list.source || 'fact_object',
        version: list.version || 1,
      }),
      items: names.map((name) => ({ name, status: 'reported', severity: 'unknown', source: 'fact_object', version: 1 })),
    };
  }
  if (list == null) return { fact: fact({ status: 'not_asked', value: [], source: 'legacy_absent' }), items: [] };
  if (!Array.isArray(list) || list.length === 0) {
    return { fact: fact({ status: 'unknown', value: [], source: 'legacy_empty_array' }), items: [] };
  }
  const items = list.map((name) => ({
    name: String(name),
    status: 'reported',
    severity: 'unknown',
    source: 'legacy_array',
    version: 1,
  }));
  return { fact: fact({ status: 'reported', value: items.map((i) => i.name), source: 'legacy_array' }), items };
}

function migrateMedList(list) {
  if (looksLikeFact(list)) {
    const names = Array.isArray(list.value) ? list.value.map(String) : [];
    return {
      fact: fact({
        status: list.status,
        value: list.status === 'reported' ? names : (list.status === 'none' ? [] : null),
        source: list.source || 'fact_object',
        version: list.version || 1,
      }),
      items: names.map((name) => ({
        name, category: null, dose: null, frequency: null, itemStatus: 'active',
        startedAt: null, stoppedAt: null, source: 'fact_object', version: 1,
      })),
    };
  }
  if (list == null) return { fact: fact({ status: 'not_asked', value: [], source: 'legacy_absent' }), items: [] };
  if (!Array.isArray(list) || list.length === 0) {
    return { fact: fact({ status: 'unknown', value: [], source: 'legacy_empty_array' }), items: [] };
  }
  const items = list.map((raw) => {
    if (raw && typeof raw === 'object') {
      return {
        name: String(raw.name || ''),
        category: raw.category || null,
        dose: raw.dose || raw.dosage || null,
        frequency: raw.frequency || null,
        itemStatus: MED_STATUSES.includes(raw.itemStatus) ? raw.itemStatus : (raw.status && MED_STATUSES.includes(raw.status) ? raw.status : 'active'),
        startedAt: raw.startedAt || null,
        stoppedAt: raw.stoppedAt || null,
        source: raw.source || 'legacy_object',
        version: raw.version || 1,
      };
    }
    return {
      name: String(raw),
      category: null,
      dose: null,
      frequency: null,
      itemStatus: 'active',
      startedAt: null,
      stoppedAt: null,
      source: 'legacy_array',
      version: 1,
    };
  }).filter((m) => m.name);
  return { fact: fact({ status: 'reported', value: items.map((i) => i.name), source: 'legacy_array' }), items };
}

function factIsUnset(f) {
  return !f || f.status === 'not_asked' || f.status === 'unknown';
}

const FIELD_VALUE_SCHEMA = {
  'patient.facts.ageYears': { type: 'number', unit: 'years', min: 0, max: 120 },
  'patient.facts.weightKg': { type: 'number', unit: 'kg', min: 0.5, max: 300 },
  'patient.facts.pregnancy': { type: 'tri' },
  'patient.facts.lactation': { type: 'tri' },
  'patient.facts.liverImpairment': { type: 'boolean' },
  'patient.facts.renalImpairment': { type: 'boolean' },
  'patient.facts.allergies': { type: 'list' },
  'patient.facts.currentMedications': { type: 'list' },
  'patient.sex': { type: 'sex' },
};

function coerceFactValue(fieldPath, status, raw) {
  const spec = FIELD_VALUE_SCHEMA[fieldPath];
  if (!spec) return { status: status || 'unknown', value: raw ?? null };
  if (status === 'unknown' || status === 'not_asked' || status === 'not_applicable') {
    return { status, value: null };
  }
  if (status === 'denied') {
    if (spec.type === 'list') return { status: 'denied', value: Array.isArray(raw) ? raw.map(String) : (raw ? [String(raw)] : []) };
    return { status: 'denied', value: raw ?? null };
  }
  if (status === 'none') {
    if (spec.type === 'list') return { status: 'none', value: [] };
    if (spec.type === 'tri') return { status: 'none', value: 'no' };
    if (spec.type === 'boolean') return { status: 'none', value: false };
    return { status: 'none', value: null };
  }
  if (spec.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
      const err = new Error('invalid_fact_value');
      err.code = 'invalid_fact_value';
      err.fieldPath = fieldPath;
      throw err;
    }
    return { status: 'reported', value: n, unit: spec.unit };
  }
  if (spec.type === 'boolean') {
    const v = raw === true || raw === 'true' || raw === 'yes' || raw === '1';
    const no = raw === false || raw === 'false' || raw === 'no' || raw === '0';
    if (!v && !no) return { status: 'unknown', value: null };
    return v ? { status: 'reported', value: true } : { status: 'none', value: false };
  }
  if (spec.type === 'tri') {
    if (raw === 'yes' || raw === true) return { status: 'reported', value: 'yes' };
    if (raw === 'no' || raw === false) return { status: 'none', value: 'no' };
    return { status: 'unknown', value: null };
  }
  if (spec.type === 'sex') {
    const s = String(raw || '').toLowerCase();
    if (['male', 'female', 'unknown'].includes(s)) return { status: 'reported', value: s };
    return { status: 'unknown', value: null };
  }
  if (spec.type === 'list') {
    if (Array.isArray(raw)) return { status: raw.length ? 'reported' : 'unknown', value: raw };
    if (raw && typeof raw === 'object' && raw.name) return { status: 'reported', value: raw };
    if (typeof raw === 'string' && raw.trim()) return { status: 'reported', value: raw.trim() };
    return { status: 'unknown', value: null };
  }
  return { status: status || 'reported', value: raw };
}

function projectFromFacts(p) {
  const f = p.facts || {};
  if (['reported', 'verified', 'conflicting'].includes(f.ageYears?.status) && f.ageYears.value != null) p.ageYears = Number(f.ageYears.value);
  else if (f.ageYears?.status === 'not_asked' || f.ageYears?.status === 'unknown') p.ageYears = undefined;
  if ((f.weightKg?.status === 'reported' || f.weightKg?.status === 'verified') && f.weightKg.value != null) p.weightKg = Number(f.weightKg.value);
  else if (f.weightKg) p.weightKg = undefined;
  if (f.pregnancy?.status === 'reported' || f.pregnancy?.status === 'verified') p.pregnancy = f.pregnancy.value;
  else if (f.pregnancy?.status === 'none') p.pregnancy = 'no';
  else if (f.pregnancy) p.pregnancy = 'unknown';
  if (f.lactation?.status === 'reported' || f.lactation?.status === 'verified') p.lactation = f.lactation.value;
  else if (f.lactation?.status === 'none') p.lactation = 'no';
  else if (f.lactation) p.lactation = 'unknown';
  p.allergies = (f.allergies?.status === 'reported' || f.allergies?.status === 'verified' || f.allergies?.status === 'conflicting')
    ? (p.allergyItems || []).filter((i) => i.status === 'reported').map((i) => i.name)
    : (f.allergies?.status === 'none' ? [] : (f.allergies?.status === 'denied' ? f.allergies.value : null));
  p.currentMedications = (f.currentMedications?.status === 'reported' || f.currentMedications?.status === 'verified')
    ? activeMedicationsRaw(p).map((i) => i.name)
    : (f.currentMedications?.status === 'none' ? [] : null);
  p.liverImpairment = (f.liverImpairment?.status === 'reported' || f.liverImpairment?.status === 'verified') && f.liverImpairment.value === true ? true : undefined;
  p.renalImpairment = (f.renalImpairment?.status === 'reported' || f.renalImpairment?.status === 'verified') && f.renalImpairment.value === true ? true : undefined;
  return p;
}

function activeMedicationsRaw(p) {
  return (p.medicationItems || []).filter((i) => i.itemStatus === 'active');
}

function clinicalProjection(patient = {}) {
  const p = attachFacts(patient);
  return {
    ageYears: typeof p.ageYears === 'number' ? p.ageYears : undefined,
    weightKg: typeof p.weightKg === 'number' ? p.weightKg : undefined,
    sex: p.sex || 'unknown',
    pregnancy: p.pregnancy || 'unknown',
    lactation: p.lactation || 'unknown',
    allergies: p.allergies,
    allergyStatus: p.facts.allergies.status,
    currentMedications: p.currentMedications,
    medicationStatus: p.facts.currentMedications.status,
    medicationItems: activeMedicationsRaw(p),
    liverImpairment: p.liverImpairment === true,
    renalImpairment: p.renalImpairment === true,
    liverStatus: p.facts.liverImpairment.status,
    renalStatus: p.facts.renalImpairment.status,
    facts: p.facts,
    allergyItems: p.allergyItems,
    patientRef: p.patientRef,
    identityVerified: p.identityVerified,
  };
}

function factLabel(factObj, { noneText = '明确没有', unknownText = '未知', notAskedText = '未询问' } = {}) {
  if (!factObj || typeof factObj !== 'object') return { status: 'unknown', text: unknownText, names: [] };
  const st = factObj.status || 'unknown';
  if (st === 'none') return { status: 'none', text: noneText, names: [] };
  if (st === 'denied') return { status: 'denied', text: '已否认', names: Array.isArray(factObj.value) ? factObj.value : [] };
  if (st === 'not_asked') return { status: 'not_asked', text: notAskedText, names: [] };
  if (st === 'unknown' || st === 'not_applicable') return { status: st, text: unknownText, names: [] };
  if (st === 'conflicting') return { status: 'conflicting', text: '存在冲突', names: Array.isArray(factObj.value) ? factObj.value : [] };
  const names = Array.isArray(factObj.value) ? factObj.value : (factObj.value != null ? [factObj.value] : []);
  return { status: 'reported', text: names.join('、') || String(factObj.value ?? ''), names };
}

function attachFacts(patient = {}) {
  const p = { ...patient };
  if (p.facts?.allergies && p.facts?.liverImpairment) {
    p.allergyItems = Array.isArray(p.allergyItems) ? p.allergyItems : [];
    p.medicationItems = Array.isArray(p.medicationItems) ? p.medicationItems : [];
    p.factChangeLog = Array.isArray(p.factChangeLog) ? p.factChangeLog : [];
    // Adopt leftover top-level lists only when there is no item history.
    // Stopped/corrected items must not be remigrated from the old array.
    if (!p.medicationItems.length && Array.isArray(p.currentMedications) && p.currentMedications.length) {
      const meds = migrateMedList(p.currentMedications);
      p.facts.currentMedications = meds.fact;
      p.medicationItems = meds.items;
    }
    if (!p.allergyItems.length && Array.isArray(p.allergies) && p.allergies.length) {
      const allergies = migrateAllergyList(p.allergies);
      p.facts.allergies = allergies.fact;
      p.allergyItems = allergies.items;
    }
    if (typeof p.ageYears === 'number' && Number(p.facts.ageYears?.value) !== p.ageYears) {
      p.facts.ageYears = migrateScalar(p.ageYears, 'years');
    }
    if (typeof p.weightKg === 'number' && Number(p.facts.weightKg?.value) !== p.weightKg) {
      p.facts.weightKg = migrateScalar(p.weightKg, 'kg');
    }
    if (p.pregnancy === 'yes' && p.facts.pregnancy?.status !== 'reported') {
      p.facts.pregnancy = migrateTri('yes');
    } else if (p.pregnancy === 'no' && factIsUnset(p.facts.pregnancy)) {
      p.facts.pregnancy = migrateTri('no');
    }
    if (p.sex && ['male', 'female', 'unknown'].includes(p.sex)) {
      p.facts.sex = p.facts.sex || fact({ status: 'reported', value: p.sex, source: 'legacy_sex' });
    }
    return projectFromFacts(p);
  }
  const allergies = migrateAllergyList(p.allergies);
  const meds = migrateMedList(p.currentMedications);
  p.facts = {
    liverImpairment: migrateBoolean(p.liverImpairment),
    renalImpairment: migrateBoolean(p.renalImpairment),
    pregnancy: migrateTri(p.pregnancy),
    lactation: migrateTri(p.lactation),
    allergies: allergies.fact,
    currentMedications: meds.fact,
    ageYears: migrateScalar(p.ageYears, 'years'),
    weightKg: migrateScalar(p.weightKg, 'kg'),
  };
  p.allergyItems = p.allergyItems || allergies.items;
  p.medicationItems = p.medicationItems || meds.items;
  p.factChangeLog = Array.isArray(p.factChangeLog) ? p.factChangeLog : [];
  return projectFromFacts(p);
}

function allergyStatus(patient) {
  const f = attachFacts(patient).facts.allergies;
  return f.status;
}

function allergyIsExplicitNone(patient) {
  return allergyStatus(patient) === 'none';
}

function allergyIsMissing(patient) {
  const st = allergyStatus(patient);
  return st === 'not_asked' || st === 'unknown';
}

function reportedAllergyNames(patient) {
  const p = attachFacts(patient);
  if (p.facts.allergies.status !== 'reported') return [];
  return (p.allergyItems || []).filter((i) => i.status === 'reported').map((i) => i.name);
}

function activeMedications(patient) {
  const p = attachFacts(patient);
  return (p.medicationItems || []).filter((i) => i.itemStatus === 'active');
}

function liverReportedTrue(patient) {
  const f = attachFacts(patient).facts.liverImpairment;
  return f.status === 'reported' && f.value === true;
}

function renalReportedTrue(patient) {
  const f = attachFacts(patient).facts.renalImpairment;
  return f.status === 'reported' && f.value === true;
}

function applyFactChange(patient, change, actor) {
  const p = attachFacts(patient);
  p.factChangeLog = Array.isArray(p.factChangeLog) ? p.factChangeLog : [];
  const now = new Date().toISOString();
  const entry = {
    changeId: change.changeId,
    kind: CHANGE_KINDS.includes(change.kind) ? change.kind : 'correct',
    fieldPath: change.fieldPath,
    oldValue: change.oldValue ?? null,
    newValue: change.newValue ?? null,
    status: 'pending_verification',
    requestedBy: String(actor.id),
    requestedRole: actor.role,
    requestedAt: now,
    reviewedBy: null,
    reviewedAt: null,
  };
  if (change.fieldPath === 'patient.facts.allergies' || change.fieldPath === 'allergies') {
    if (change.kind === 'add') {
      const name = String(change.newValue?.name || change.newValue || '').trim();
      if (name) {
        p.allergyItems = [...(p.allergyItems || []).filter((i) => i.name !== name), {
          name, status: 'reported', severity: change.newValue?.severity || 'unknown', source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1,
        }];
        p.facts.allergies = fact({
          status: 'reported', value: p.allergyItems.filter((i) => i.status === 'reported').map((i) => i.name),
          reportedBy: String(actor.id), reportedAt: now, source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1,
        });
      }
    } else if (change.kind === 'stop' || change.kind === 'correct') {
      const name = String(change.oldValue?.name || change.oldValue || change.newValue?.name || '').trim();
      p.allergyItems = (p.allergyItems || []).map((i) => (i.name === name ? { ...i, status: change.kind === 'stop' ? 'none' : 'reported', superseded: true, correctedTo: change.newValue || null } : i));
      if (change.kind === 'correct' && change.newValue) {
        const nextName = String(change.newValue.name || change.newValue);
        p.allergyItems.push({ name: nextName, status: 'reported', severity: 'unknown', source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1 });
      }
      const live = (p.allergyItems || []).filter((i) => i.status === 'reported' && !i.superseded);
      p.facts.allergies = fact({
        status: live.length ? 'reported' : (change.newStatus === 'none' ? 'none' : 'unknown'),
        value: live.map((i) => i.name),
        reportedBy: String(actor.id), reportedAt: now, source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1,
      });
    }
  } else if (change.fieldPath === 'patient.facts.currentMedications' || change.fieldPath === 'currentMedications') {
    if (change.kind === 'add') {
      const name = String(change.newValue?.name || change.newValue || '').trim();
      if (name) {
        p.medicationItems = [...(p.medicationItems || []).filter((i) => !(i.name === name && i.itemStatus === 'active')), {
          name,
          category: change.newValue?.category || null,
          dose: change.newValue?.dose || null,
          frequency: change.newValue?.frequency || null,
          itemStatus: 'active',
          startedAt: now,
          stoppedAt: null,
          source: 'patient_correction',
          version: 1,
        }];
      }
    } else if (change.kind === 'stop') {
      const name = String(change.oldValue?.name || change.oldValue || '').trim();
      p.medicationItems = (p.medicationItems || []).map((i) => (i.name === name && i.itemStatus === 'active'
        ? { ...i, itemStatus: 'stopped', stoppedAt: now, source: 'patient_correction' }
        : i));
    } else if (change.kind === 'correct') {
      const name = String(change.oldValue?.name || change.oldValue || '').trim();
      p.medicationItems = (p.medicationItems || []).map((i) => (i.name === name && i.itemStatus === 'active'
        ? { ...i, itemStatus: 'stopped', stoppedAt: now, superseded: true }
        : i));
      if (change.newValue) {
        p.medicationItems.push({
          name: String(change.newValue.name || change.newValue),
          category: change.newValue.category || null,
          dose: change.newValue.dose || null,
          frequency: change.newValue.frequency || null,
          itemStatus: 'active',
          startedAt: now,
          source: 'patient_correction',
          version: 1,
        });
      }
    }
    const active = (p.medicationItems || []).filter((i) => i.itemStatus === 'active');
    p.facts.currentMedications = fact({
      status: active.length ? 'reported' : 'unknown',
      value: active.map((i) => i.name),
      reportedBy: String(actor.id),
      reportedAt: now,
      source: 'patient_correction',
      version: (p.facts.currentMedications.version || 1) + 1,
    });
  } else if (change.fieldPath === 'patient.sex') {
    const coerced = coerceFactValue('patient.sex', change.newStatus || 'reported', change.newValue);
    p.sex = coerced.value || 'unknown';
    p.facts.sex = fact({
      status: coerced.status,
      value: coerced.value,
      reportedBy: String(actor.id),
      reportedAt: now,
      source: 'patient_correction',
      version: (p.facts.sex?.version || 1) + 1,
    });
  } else if (change.fieldPath?.startsWith('patient.facts.')) {
    const key = change.fieldPath.replace('patient.facts.', '');
    const incoming = (typeof change.newValue === 'object' && change.newValue && !Array.isArray(change.newValue) && change.newValue.status)
      ? change.newValue
      : { status: change.newStatus || 'reported', value: change.newValue };
    let status = incoming.status;
    if (status === 'verified' && actor.role === 'patient') status = 'reported';
    if (status === 'denied' && incoming.value == null && actor.role === 'patient') status = 'denied';
    const coerced = coerceFactValue(change.fieldPath, status, incoming.value);
    const prev = p.facts[key];
    const conflict = prev && ['reported', 'verified', 'conflicting'].includes(prev.status) && coerced.status === 'reported'
      && JSON.stringify(prev.value) !== JSON.stringify(coerced.value);
    p.facts[key] = fact({
      status: conflict && change.kind !== 'correct' ? 'conflicting' : coerced.status,
      value: coerced.value,
      unit: coerced.unit || prev?.unit || null,
      reportedBy: String(actor.id),
      reportedAt: now,
      source: incoming.sourceText ? 'patient_or_model_text' : 'patient_correction',
      sourceText: incoming.sourceText || null,
      fieldPath: change.fieldPath,
      contentVersion: change.contentVersion || null,
      previousValues: conflict ? [...(prev.previousValues || []), { value: prev.value, status: prev.status, source: prev.source, at: prev.reportedAt }] : prev?.previousValues,
      version: (prev?.version || 1) + 1,
    });
  }
  if (change.newStatus === 'none' && (change.fieldPath === 'patient.facts.allergies' || change.fieldPath === 'allergies')) {
    p.facts.allergies = fact({
      status: 'none', value: [], reportedBy: String(actor.id), reportedAt: now, source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1,
    });
  }
  projectFromFacts(p);
  p.factChangeLog.push(entry);
  return { patient: p, change: entry };
}

function verifyChange(patient, changeId, actor) {
  const p = attachFacts(patient);
  const row = (p.factChangeLog || []).find((x) => x.changeId === changeId);
  if (!row) return p;
  row.status = 'verified';
  row.reviewedBy = String(actor.id);
  row.reviewedAt = new Date().toISOString();
  return p;
}

const CLINICAL_FIELD_PATHS = new Set([
  'patient', 'prescription', 'prescriber', 'allergies', 'currentMedications', 'pregnancy', 'lactation',
  'liverImpairment', 'renalImpairment', 'ageYears', 'weightKg', 'facts', 'allergyItems', 'medicationItems',
]);

const NON_CLINICAL_FIELD_PATHS = new Set(['fulfillment', 'contactConfirmed', 'serviceChoices']);

module.exports = {
  FACT_STATUSES,
  MED_STATUSES,
  CHANGE_KINDS,
  FIELD_VALUE_SCHEMA,
  fact,
  attachFacts,
  allergyStatus,
  allergyIsExplicitNone,
  allergyIsMissing,
  reportedAllergyNames,
  activeMedications,
  liverReportedTrue,
  renalReportedTrue,
  applyFactChange,
  verifyChange,
  coerceFactValue,
  projectFromFacts,
  clinicalProjection,
  factLabel,
  CLINICAL_FIELD_PATHS,
  NON_CLINICAL_FIELD_PATHS,
};
