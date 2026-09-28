const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeResilienceMetrics, CONSECUTIVE_RECOVERY_DAYS } = require('../metricsEngine');

function dailySeries(values, startDay = 0) {
  return values.map((dailyEssentialFillRate, i) => ({ day: startDay + i, dailyEssentialFillRate }));
}

const shockScenario = {
  simulationDays: 120,
  events: [{ type: 'demandSurge', startDay: 30, durationDays: 30, magnitude: 1.5, targetRegions: ['urban'] }],
};

describe('recovery time definition', () => {
  it('does not count threshold crossings during the shock as post-shock recovery', () => {
    const ef = Array(120).fill(0.95);
    for (let d = 30; d < 60; d += 1) ef[d] = 0.98;
    for (let d = 60; d < 120; d += 1) ef[d] = 0.70;
    const res = computeResilienceMetrics(dailySeries(ef), shockScenario);
    assert.equal(res.timeToRecovery95, null);
    assert.equal(res.recoveredWithinHorizon.timeToRecovery95, false);
    assert.equal(res.restrictedRecoveryTime95, 60);
  });

  it('records recovery only after sustained post-shock fill', () => {
    const ef = Array(120).fill(0.95);
    for (let d = 30; d < 65; d += 1) ef[d] = 0.50;
    for (let d = 65; d < 120; d += 1) ef[d] = 0.95;
    const res = computeResilienceMetrics(dailySeries(ef), shockScenario);
    assert.ok(res.timeToRecovery95 != null);
    assert.equal(res.recoveredWithinHorizon.timeToRecovery95, true);
    assert.ok(res.timeToRecovery95 >= CONSECUTIVE_RECOVERY_DAYS - 1);
  });

  it('rejects a brief post-shock threshold blip without 7-day sustainment', () => {
    const ef = Array(120).fill(0.95);
    for (let d = 30; d < 70; d += 1) ef[d] = 0.50;
    for (let d = 70; d < 73; d += 1) ef[d] = 0.96;
    for (let d = 73; d < 120; d += 1) ef[d] = 0.55;
    const res = computeResilienceMetrics(dailySeries(ef), shockScenario);
    assert.equal(res.timeToRecovery95, null);
    assert.equal(res.restrictedRecoveryTime95, 60);
  });

  it('keeps non-recovered runs right-censored (not day-zero recovery)', () => {
    const ef = Array(120).fill(0.95);
    for (let d = 30; d < 120; d += 1) ef[d] = 0.40;
    const res = computeResilienceMetrics(dailySeries(ef), shockScenario);
    assert.equal(res.timeToRecovery95, null);
    assert.equal(res.restrictedRecoveryTime95, 60);
  });
});
