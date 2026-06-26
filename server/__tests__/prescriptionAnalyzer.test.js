const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzePrescription, parseHerbs, mapStatusToLabel } = require('../services/prescriptionAnalyzer');
const baselineNaive = require('../services/baselineAnalyzer');
const { loadRules } = require('../services/ruleLoader');

describe('parseHerbs', () => {
  it('parses Chinese comma-separated herbs with dosage', () => {
    const herbs = parseHerbs('黄芪15g，当归10g，甘草6g');
    assert.equal(herbs.length, 3);
    assert.equal(herbs[0].name, '黄芪');
    assert.equal(herbs[0].dosage, 15);
  });

  it('returns empty for blank input', () => {
    assert.deepEqual(parseHerbs(''), []);
  });
});

describe('rule engine v3', () => {
  it('flags 十八反 Gan Cao + Gan Sui', () => {
    const r = analyzePrescription({ prescription: '甘草10g，甘遂5g', diagnosis: '水肿', patientAge: 50, patientGender: '男' });
    assert.equal(r.label, 'needs_revision');
    assert.ok(r.warnings.some(w => w.message.includes('十八反')));
  });

  it('approves balanced Si Wu Tang style formula', () => {
    const r = analyzePrescription({
      prescription: '川芎6g，当归10g，白芍10g，熟地黄15g',
      diagnosis: '血虚', patientAge: 35, patientGender: '女',
    });
    assert.equal(r.label, 'approved');
  });

  it('flags licorice overdose PR-002', () => {
    const r = analyzePrescription({
      prescription: '黄芪15g，当归10g，甘草20g',
      diagnosis: '气血两虚', patientAge: 45, patientGender: '女',
    });
    assert.equal(r.label, 'needs_revision');
  });

  it('loads configurable rules from JSON', () => {
    const rules = loadRules();
    assert.ok(rules.herbRules['人参']);
    assert.ok(rules.eighteenIncompatible.length > 0);
  });

  it('maps status to label correctly', () => {
    assert.equal(mapStatusToLabel('已通过'), 'approved');
    assert.equal(mapStatusToLabel('需修改'), 'needs_revision');
  });
});

describe('baseline naive', () => {
  it('always approves non-empty text', () => {
    const r = baselineNaive.analyzePrescription({ prescription: '甘草10g，甘遂5g' });
    assert.equal(r.label, 'approved');
  });
});

describe('evaluation dataset integrity', () => {
  it('has 24 labeled cases with valid labels', () => {
    const ds = require('../../benchmarks/prescription-review-dataset.json');
    assert.equal(ds.cases.length, 24);
    const valid = new Set(['approved', 'review', 'needs_revision']);
    ds.cases.forEach(c => assert.ok(valid.has(c.expertLabel), c.id));
  });
});
