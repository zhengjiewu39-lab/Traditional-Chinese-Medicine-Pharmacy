/**
 * Clinical facts: false / [] is not "explicitly none".
 * Legacy booleans and empty arrays migrate to unknown.
 */
const FACT_STATUSES = ['not_asked', 'unknown', 'none', 'reported', 'not_applicable'];
const MED_STATUSES = ['active', 'stopped', 'unknown'];
const CHANGE_KINDS = ['add', 'stop', 'correct'];

function fact({
  status = 'not_asked', value = null, unit = null,
  reportedBy = null, reportedAt = null, verifiedBy = null, verifiedAt = null,
  source = 'legacy_unknown', version = 1,
} = {}) {
  const st = FACT_STATUSES.includes(status) ? status : 'unknown';
  return {
    status: st,
    value: st === 'reported' || st === 'none' ? value : (st === 'unknown' || st === 'not_asked' ? null : value),
    unit,
    reportedBy,
    reportedAt,
    verifiedBy,
    verifiedAt,
    source,
    version,
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

function migrateAllergyList(list) {
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
    if (p.pregnancy === 'yes' && p.facts.pregnancy?.status !== 'reported') {
      p.facts.pregnancy = migrateTri('yes');
    } else if (p.pregnancy === 'no' && factIsUnset(p.facts.pregnancy)) {
      p.facts.pregnancy = migrateTri('no');
    }
    return p;
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
  return p;
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
  } else if (change.fieldPath?.startsWith('patient.facts.')) {
    const key = change.fieldPath.replace('patient.facts.', '');
    if (p.facts[key]) {
      p.facts[key] = fact({
        ...(typeof change.newValue === 'object' && change.newValue?.status ? change.newValue : { status: change.newStatus || 'reported', value: change.newValue }),
        reportedBy: String(actor.id),
        reportedAt: now,
        source: 'patient_correction',
        version: (p.facts[key].version || 1) + 1,
      });
      if (key === 'pregnancy') {
        p.pregnancy = p.facts.pregnancy.status === 'reported' ? p.facts.pregnancy.value
          : p.facts.pregnancy.status === 'none' ? 'no' : 'unknown';
      }
    }
  }
  if (change.newStatus === 'none' && (change.fieldPath === 'patient.facts.allergies' || change.fieldPath === 'allergies')) {
    p.facts.allergies = fact({
      status: 'none', value: [], reportedBy: String(actor.id), reportedAt: now, source: 'patient_correction', version: (p.facts.allergies.version || 1) + 1,
    });
  }
  p.allergies = p.facts.allergies.status === 'reported' ? reportedAllergyNames(p) : (p.facts.allergies.status === 'none' ? [] : null);
  p.currentMedications = p.facts.currentMedications.status === 'reported' ? activeMedications(p).map((i) => i.name) : (p.facts.currentMedications.status === 'none' ? [] : null);
  p.liverImpairment = liverReportedTrue(p) ? true : undefined;
  p.renalImpairment = renalReportedTrue(p) ? true : undefined;
  if (p.facts.pregnancy.status === 'reported') p.pregnancy = p.facts.pregnancy.value;
  else if (p.facts.pregnancy.status === 'none') p.pregnancy = 'no';
  else p.pregnancy = 'unknown';
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
  CLINICAL_FIELD_PATHS,
  NON_CLINICAL_FIELD_PATHS,
};
