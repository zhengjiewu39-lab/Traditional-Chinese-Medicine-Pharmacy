const { describe, it } = require('node:test');
const assert = require('node:assert');
const { generateDemoPatients, ensureDemoPatients, stampPatientRefs, DEMO_PATIENT_COUNT } = require('../data/patientGenerator');

describe('demo patient generator', () => {
  it('generates requested count with unique phones', () => {
    const { patients } = generateDemoPatients(500, { seed: 42 });
    assert.strictEqual(patients.length, 500);
    const phones = new Set(patients.map((p) => p.phone));
    assert.strictEqual(phones.size, 500);
  });

  it('preserves core patients when expanding', () => {
    const core = [{ id: 1, name: '张三', phone: '13800000001', gender: '男', age: 45 }];
    const { patients } = generateDemoPatients(10, { preserveExisting: core, seed: 42 });
    assert.strictEqual(patients.length, 10);
    assert.strictEqual(patients[0].name, '张三');
    assert.ok(patients.slice(1).every((p) => p.phone && p.address));
  });

  it('ensureDemoPatients fills store to target', () => {
    const store = { patients: [{ id: 1, name: 'A', phone: '13800000001' }], customers: [], nextId: {} };
    const r = ensureDemoPatients(store, 500);
    assert.strictEqual(r.total, 500);
    assert.strictEqual(store.patients.length, 500);
    assert.strictEqual(DEMO_PATIENT_COUNT, 500);
  });

  it('stamps P1–P500 one-to-one on existing rows without changing ids', () => {
    const store = {
      patients: [
        { id: 1, name: '张三' },
        { id: 2, name: '李四', patientRef: 'P2' },
        { id: 500, name: '末位' },
      ],
    };
    const stamped = stampPatientRefs(store);
    assert.strictEqual(stamped, 2);
    assert.deepStrictEqual(store.patients.map((p) => p.patientRef), ['P1', 'P2', 'P500']);
    const full = generateDemoPatients(500, { seed: 42 });
    assert.strictEqual(full.patients.length, 500);
    assert.ok(full.patients.every((p, i) => p.id === i + 1 && p.patientRef === `P${p.id}`));
  });
});
