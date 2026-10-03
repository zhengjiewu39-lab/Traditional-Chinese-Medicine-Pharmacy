/**
 * One synthetic store patient ↔ one patient-mode identity.
 * Store id 1 is always P1, id 2 is P2, and so on.
 */
const { getStore, updateStore } = require('../data/store');
const facts = require('./clinicalFacts');
const repo = require('./workflowRepository');
const { ServiceError } = require('./errors');

function refForStorePatient(p) {
  if (!p) return null;
  if (p.patientRef) return String(p.patientRef);
  if (p.id != null && p.id !== '') return `P${p.id}`;
  return null;
}

function parsePatientRef(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^patient[-_]?P?(\d+)$/i) || s.match(/^P(\d+)$/i);
  if (m) return `P${m[1]}`;
  if (/^P[A-Za-z0-9_-]{1,20}$/.test(s)) return s;
  return null;
}

function findStorePatient(ref) {
  const want = parsePatientRef(ref) || String(ref || '').trim();
  if (!want) return null;
  const patients = getStore().patients || [];
  const byRef = patients.find((p) => p.patientRef && String(p.patientRef) === want);
  if (byRef) return byRef;
  const n = want.startsWith('P') ? Number(want.slice(1)) : Number(want);
  if (Number.isInteger(n)) return patients.find((p) => Number(p.id) === n) || null;
  return null;
}

function storeToWorkflow(p) {
  if (!p) return {};
  const sex = { 男: 'male', 女: 'female' }[p.gender] || p.sex || 'unknown';
  return {
    patientRef: refForStorePatient(p),
    legacyPatientId: p.id != null ? String(p.id) : undefined,
    name: p.name || undefined,
    phone: p.phone || undefined,
    ageYears: typeof p.age === 'number' ? p.age : undefined,
    sex,
    allergies: Array.isArray(p.allergies) ? p.allergies : undefined,
  };
}

function normalizePatientIdentity(patient) {
  const incoming = patient && typeof patient === 'object' ? patient : {};
  const fromLegacy = incoming.legacyPatientId || incoming.id;
  const ref = parsePatientRef(incoming.patientRef)
    || (fromLegacy != null && fromLegacy !== '' ? `P${fromLegacy}` : null);
  const store = ref ? findStorePatient(ref) : null;
  return {
    ...(store ? storeToWorkflow(store) : {}),
    ...incoming,
    patientRef: ref || incoming.patientRef || undefined,
    name: (store && store.name) || incoming.name,
    phone: incoming.phone || (store && store.phone) || undefined,
  };
}

function listDemoPatients({ q = '', limit = 40, offset = 0 } = {}) {
  const term = String(q || '').trim().toLowerCase();
  const all = (getStore().patients || []).map((p) => ({
    patientRef: refForStorePatient(p),
    id: p.id,
    name: p.name,
    age: p.age ?? null,
    sex: { 男: 'male', 女: 'female' }[p.gender] || 'unknown',
    gender: p.gender || null,
    allergyCount: Array.isArray(p.allergies) ? p.allergies.length : 0,
  }));
  const filtered = term
    ? all.filter((p) => String(p.name || '').toLowerCase().includes(term) || String(p.patientRef || '').toLowerCase().includes(term))
    : all;
  return {
    total: filtered.length,
    patients: filtered.slice(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 40)),
  };
}

function parseList(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
  return undefined;
}

function sanitizePatientPatch(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  if (typeof body.name === 'string' && body.name.trim()) out.name = body.name.trim().slice(0, 40);
  if (body.gender === '男' || body.gender === '女') out.gender = body.gender;
  if (body.age != null && body.age !== '') {
    const n = Number(body.age);
    if (Number.isFinite(n) && n >= 0 && n <= 120) out.age = Math.round(n);
  }
  if (typeof body.phone === 'string') out.phone = body.phone.trim().slice(0, 24);
  if (typeof body.address === 'string') out.address = body.address.trim().slice(0, 160);
  if (body.medicalHistory != null) out.medicalHistory = parseList(body.medicalHistory) || [];
  if (body.allergies != null) out.allergies = parseList(body.allergies) || [];
  return out;
}

function overlayStoreOnWorkflowPatient(existing, storePt) {
  const wf = storeToWorkflow(storePt);
  const next = {
    ...(existing && typeof existing === 'object' ? existing : {}),
    ...wf,
    patientRef: refForStorePatient(storePt),
    legacyPatientId: storePt.id != null ? String(storePt.id) : existing?.legacyPatientId,
    name: storePt.name,
    phone: storePt.phone,
    ageYears: typeof storePt.age === 'number' ? storePt.age : existing?.ageYears,
    sex: wf.sex,
    allergies: Array.isArray(storePt.allergies) ? storePt.allergies : [],
    medicalHistory: Array.isArray(storePt.medicalHistory) ? storePt.medicalHistory : [],
  };
  if (next.facts && typeof next.facts === 'object') {
    next.facts = { ...next.facts };
    const names = next.allergies;
    next.facts.allergies = names.length
      ? facts.fact({ status: 'reported', value: names, source: 'store_sync' })
      : facts.fact({ status: 'none', value: [], source: 'store_sync' });
    next.allergyItems = names.map((name) => ({ name, status: 'reported', severity: 'unknown', source: 'store_sync', version: 1 }));
    if (typeof storePt.age === 'number') {
      next.facts.ageYears = facts.fact({ status: 'reported', value: storePt.age, unit: 'years', source: 'store_sync' });
    }
    if (wf.sex && wf.sex !== 'unknown') {
      next.facts.sex = facts.fact({ status: 'reported', value: wf.sex, source: 'store_sync' });
    }
  }
  return facts.attachFacts(next);
}

function syncLinkedStoreRows(data, next, patch) {
  const touchCustomer = (cust) => {
    if (!cust) return false;
    if (patch.name) cust.name = next.name;
    if (patch.gender) cust.gender = next.gender;
    if (patch.age != null) cust.age = next.age;
    if (patch.phone != null) cust.phone = next.phone;
    if (patch.address != null) cust.address = next.address;
    return true;
  };
  let customer = false;
  if (next.customerId) customer = touchCustomer((data.customers || []).find((c) => c.id === next.customerId)) || customer;
  customer = touchCustomer((data.customers || []).find((c) => c.patientId === next.id)) || customer;
  for (const pr of data.prescriptions || []) {
    if (pr.patientId === next.id && patch.name) pr.patientName = next.name;
  }
  for (const order of data.orders || []) {
    if (next.customerId && order.customerId === next.customerId && patch.name) order.customerName = next.name;
  }
  for (const bill of data.bills || []) {
    if (next.customerId && bill.customerId === next.customerId && patch.name) bill.customerName = next.name;
  }
  return { customer };
}

function syncPatientRecord(id, body) {
  const patch = sanitizePatientPatch(body);
  if (!Object.keys(patch).length) throw new ServiceError(400, 'empty_patch', 'No editable patient fields');
  let updated;
  let linked = { customer: false };
  updateStore((data) => {
    const idx = (data.patients || []).findIndex((p) => Number(p.id) === Number(id));
    if (idx === -1) return;
    const prev = data.patients[idx];
    const next = {
      ...prev,
      ...patch,
      id: prev.id,
      customerId: prev.customerId,
      patientRef: refForStorePatient(prev),
    };
    data.patients[idx] = next;
    updated = next;
    linked = syncLinkedStoreRows(data, next, patch);
  });
  if (!updated) throw new ServiceError(404, 'patient_not_found', 'Patient not found');

  const ref = refForStorePatient(updated);
  const wf = storeToWorkflow(updated);
  repo.upsertPatient({
    patientRef: ref,
    name: updated.name,
    phone: updated.phone,
    sex: wf.sex,
    ageYears: updated.age,
    allergies: updated.allergies || [],
    medicalHistory: updated.medicalHistory || [],
    legacyPatientId: String(updated.id),
    legacyCustomerId: updated.customerId != null ? String(updated.customerId) : null,
    version: Date.now(),
  });

  let cases = 0;
  for (const c of repo.listCases()) {
    const sameRef = c.patient?.patientRef === ref;
    const sameLegacy = Number(c.patient?.legacyPatientId) === Number(updated.id);
    if (!sameRef && !sameLegacy) continue;
    c.patient = overlayStoreOnWorkflowPatient(c.patient, updated);
    c.updatedAt = new Date().toISOString();
    repo.saveCase(c);
    cases += 1;
  }

  return {
    patient: { ...updated, patientRef: ref },
    synced: { cases, customer: linked.customer },
  };
}

function bindDemoPatient(ref) {
  const parsed = parsePatientRef(ref) || String(ref || '').trim();
  if (!parsed) return null;
  const store = findStorePatient(parsed);
  const identity = store ? storeToWorkflow(store) : { patientRef: parsed };
  if (!identity.patientRef) return null;
  return {
    patientRef: identity.patientRef,
    name: identity.name || identity.patientRef,
    legacyPatientId: identity.legacyPatientId || null,
  };
}

function staffPatientDisplay(c) {
  const ref = c?.patient?.patientRef || null;
  const store = ref ? findStorePatient(ref) : null;
  const name = (store && store.name) || c?.patient?.name || null;
  return {
    patientName: name || null,
    patientRef: ref || null,
    patientLabel: [name, ref].filter(Boolean).join(' · ') || '未登记',
  };
}

module.exports = {
  refForStorePatient,
  parsePatientRef,
  findStorePatient,
  storeToWorkflow,
  normalizePatientIdentity,
  listDemoPatients,
  bindDemoPatient,
  sanitizePatientPatch,
  overlayStoreOnWorkflowPatient,
  syncPatientRecord,
  staffPatientDisplay,
};
