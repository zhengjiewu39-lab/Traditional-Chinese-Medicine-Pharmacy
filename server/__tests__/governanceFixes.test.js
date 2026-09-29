const { describe, it } = require('node:test');
const assert = require('node:assert');
const { computeLiveMetrics } = require('../../scripts/ai/liveMetrics');
const { stratifiedSample } = require('../workflow/sampling');
const { resolvePrescriberLicense, prescriberFields } = require('../security/prescriberLicense');
const { minimiseCaseForModel } = require('../ai/redaction');
const { ENTRY_SCHEMA } = require('../knowledge/sourceRegistry');
const { check } = require('../common/schema');

describe('live metrics conflict rate', () => {
  it('is not a constant zero when disagreements exist', () => {
    const results = [
      { semanticStatus: 'ok', disagreements: [{ type: 'hard_rule_conflict' }] },
      { semanticStatus: 'ok', disagreements: [] },
      { semanticStatus: 'schema_invalid', disagreements: [{ type: 'hard_rule_conflict' }] },
    ];
    const m = computeLiveMetrics(results);
    assert.strictEqual(m.conflictCount, 1);
    assert.strictEqual(m.modelOkCount, 2);
    assert.strictEqual(m.ruleModelConflictRate, 0.5);
  });
});

describe('stratified sampling', () => {
  it('is reproducible for a fixed seed and not prefix-of-sorted-id', () => {
    const items = [
      { caseId: 'a1', state: 'completed' },
      { caseId: 'a2', state: 'completed' },
      { caseId: 'b1', state: 'pharmacist_approved' },
      { caseId: 'b2', state: 'pharmacist_approved' },
    ];
    const first = stratifiedSample(items, { rate: 0.5, seed: 'fixed-seed', keyFn: (x) => x.state });
    const second = stratifiedSample(items, { rate: 0.5, seed: 'fixed-seed', keyFn: (x) => x.state });
    assert.deepStrictEqual(first.map((x) => x.caseId), second.map((x) => x.caseId));
    const byId = [...items].sort((a, b) => a.caseId.localeCompare(b.caseId)).slice(0, 2).map((x) => x.caseId);
    assert.ok(first.length >= 2);
    assert.notDeepStrictEqual(first.map((x) => x.caseId), byId);
  });
});

describe('prescriber license roster', () => {
  it('does not invent a verified license when the account is missing', () => {
    const r = resolvePrescriberLicense({ id: 'no-such-user', name: '未知' });
    assert.strictEqual(r.verified, false);
    assert.strictEqual(r.source, 'not_on_file');
    const fields = prescriberFields({ id: 'no-such-user', name: '未知' });
    assert.strictEqual(fields.licenseSource, 'not_on_file');
    assert.strictEqual(fields.licenseVerified, undefined);
  });

  it('reads the demo roster instead of hardcoding true in workflow', () => {
    const r = resolvePrescriberLicense({ id: 7, name: '周医师', role: 'prescriber' });
    assert.strictEqual(r.verified, true);
    assert.strictEqual(r.source, 'demo_institution_roster');
  });
});

describe('model payload clinical fields', () => {
  it('includes diagnosis, weight, allergy severity, processing, decoction and notes', () => {
    const m = minimiseCaseForModel({
      caseId: 'c1',
      patient: { ageYears: 40, weightKg: 62.4, sex: 'female', allergies: ['青霉素'], allergySeverity: 'severe' },
      clinical: { diagnosisText: '气虚', notes: '近日乏力' },
      prescription: {
        herbs: [{ name: '黄芪', dosage: 15, unit: 'g', processing: '蜜炙', decoctionTiming: '先煎' }],
        decoctionNotes: '先煎黄芪',
        diagnosisText: '气虚',
      },
    });
    assert.strictEqual(m.diagnosisText, '气虚');
    assert.strictEqual(m.patient.weightKg, 62);
    assert.strictEqual(m.patient.allergySeverity, 'severe');
    assert.strictEqual(m.prescription.herbs[0].processing, '蜜炙');
    assert.strictEqual(m.prescription.herbs[0].decoctionTiming, '先煎');
    assert.strictEqual(m.prescription.decoctionNotes, '先煎黄芪');
    assert.strictEqual(m.clinicalNotes, '近日乏力');
    assert.ok(!JSON.stringify(m).includes('confidence'));
  });
});

describe('knowledge entry schema', () => {
  it('allows validFrom, validTo and issuingAuthority', () => {
    const { valid } = check(ENTRY_SCHEMA, {
      sourceId: 'KS-TEST-1',
      title: 't',
      authority: '合成',
      version: '1',
      effectiveDate: '2020-01-01',
      scope: { herbs: [], topics: [] },
      content: 'c',
      reviewStatus: 'approved',
      reviewedBy: 'x',
      reviewedAt: '2020-01-01T00:00:00.000Z',
      hash: 'a'.repeat(64),
      validFrom: '2020-01-01',
      validTo: '2030-01-01',
      issuingAuthority: '合成药事委员会',
    });
    assert.strictEqual(valid, true);
  });
});
