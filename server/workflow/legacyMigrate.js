/**
 * One-shot migration of historical store.json prescriptions into unified cases.
 * Does not delete existing records; it links them via migratedToCaseId.
 */
const { getStore, updateStore } = require('../data/store');
const { createCase, analyze } = require('./workflowService');
const repo = require('./workflowRepository');

function alreadyLinked(p) {
  return Boolean(p.caseId || p.migratedToCaseId);
}

async function migrateLegacyPrescriptions(actor = { role: 'system', id: 'migrate', name: 'migration' }, { analyzeAfter = false } = {}) {
  const prescriptions = getStore().prescriptions || [];
  const results = { total: prescriptions.length, migrated: 0, skipped: 0, errors: [] };
  for (const p of prescriptions) {
    if (alreadyLinked(p)) {
      results.skipped += 1;
      continue;
    }
    const existing = repo.listCases().find((c) => c.legacyPrescriptionId === p.id);
    if (existing) {
      updateStore((data) => {
        const row = data.prescriptions.find((x) => x.id === p.id);
        if (row) row.migratedToCaseId = existing.caseId;
      });
      results.skipped += 1;
      continue;
    }
    try {
      const sex = { 男: 'male', 女: 'female' }[p.patientGender] || 'unknown';
      const created = createCase({
        source: { channel: 'legacy_migration', rawText: p.prescriptionText || '' },
        patient: { name: p.patientName, ageYears: p.patientAge, sex, legacyPatientId: p.patientId },
        prescriber: { name: p.doctor || '未登记医师' },
        prescription: {
          herbs: (p.herbs || []).map((h) => ({ name: h.name, dosage: parseFloat(String(h.dosage)) || null, unit: 'g' })),
          diagnosisText: p.diagnosis,
        },
        fromPrescriptionId: undefined,
        legacyPrescriptionId: p.id,
      }, actor);
      if (analyzeAfter) await analyze(created.caseId);
      updateStore((data) => {
        const row = data.prescriptions.find((x) => x.id === p.id);
        if (row) {
          row.migratedToCaseId = created.caseId;
          row.caseId = created.caseId;
        }
      });
      results.migrated += 1;
    } catch (err) {
      results.errors.push({ id: p.id, message: err.message });
    }
  }
  return results;
}

module.exports = { migrateLegacyPrescriptions };
