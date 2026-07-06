const { describe, it } = require('node:test');
const assert = require('node:assert');
const { generateDemoPrescriptions, herbsToText } = require('../data/prescriptionGenerator');

describe('demo prescription generator', () => {
  it('generates linked prescriptions with text and cdss fields', () => {
    const patients = [
      { id: 1, name: '测试甲', gender: '男', age: 45, primaryDiagnosis: '气血两虚' },
      { id: 2, name: '测试乙', gender: '女', age: 32 },
    ];
    const { prescriptions } = generateDemoPrescriptions(patients, { seed: 1, perPatient: 1 });
    assert.strictEqual(prescriptions.length, 2);
    assert.strictEqual(prescriptions[0].patientId, 1);
    assert.ok(prescriptions[0].prescriptionText);
    assert.ok(Array.isArray(prescriptions[0].herbs));
    assert.ok(prescriptions[0].reviewScore != null);
    assert.ok(prescriptions[0].cdssStatus);
  });

  it('herbsToText formats correctly', () => {
    const t = herbsToText([{ name: '黄芪', dosage: '15g' }, { name: '当归', dosage: '10g' }]);
    assert.ok(t.includes('黄芪15g'));
  });
});
