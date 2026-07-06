const { describe, it } = require('node:test');
const assert = require('node:assert');
const cdss = require('../services/cdssEngine');

describe('CDSS dual-track engine', () => {
  it('flags 十八反 via rule track and elevates joint decision', () => {
    const r = cdss.analyzePrescription({
      prescription: '甘草10g，甘遂5g',
      diagnosis: '水肿',
      patientAge: 50,
      patientGender: '男',
    });
    assert.ok(r.tracks.ruleEngine);
    assert.ok(r.tracks.ml);
    assert.ok(r.joint);
    assert.strictEqual(r.tracks.ruleEngine.deterministicAlerts.some((a) => a.type === '十八反'), true);
    assert.strictEqual(r.joint.status, '需修改');
    assert.strictEqual(r.label, 'needs_revision');
  });

  it('returns ML feature attributions on overdose case', () => {
    const r = cdss.analyzePrescription({
      prescription: '甘草30g，白芍10g，川芎6g',
      diagnosis: '气血两虚',
      patientAge: 40,
      patientGender: '女',
    });
    assert.ok(Array.isArray(r.tracks.ml.featureAttributions));
    assert.ok(r.tracks.ml.probabilities);
  });

  it('passes safe formula with joint approved/review status', () => {
    const r = cdss.analyzePrescription({
      prescription: '黄芪15g，当归10g，白芍10g，川芎6g，甘草6g',
      diagnosis: '气血两虚',
      patientAge: 45,
      patientGender: '男',
    });
    assert.ok(['已通过', '建议复核'].includes(r.joint.status));
    assert.ok(r.score >= 0);
  });

  it('returns ADR prevention report with taxonomy categories', () => {
    const r = cdss.analyzePrescription({
      prescription: '甘草10g，甘遂5g',
      diagnosis: '水肿',
      patientAge: 50,
      patientGender: '男',
    });
    assert.ok(r.adrPrevention);
    assert.ok(typeof r.adrPrevention.adrRiskScore === 'number');
    assert.ok(r.adrPrevention.riskLevel);
    assert.ok(Array.isArray(r.adrPrevention.preventionActions));
    assert.ok(r.adrPrevention.categories.some((c) => c.id === 'ADR-C1'));
  });
});
