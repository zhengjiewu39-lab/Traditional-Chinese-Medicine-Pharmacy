/**
 * Demand forecasts available to policies on day t use only demand realized on days ≤ t
 * plus the configured planning prior (never future draws).
 *
 * Exponentially weighted mean and variance (EWMA):
 *   m_t = m_{t-1} + α (d_t − m_{t-1})
 *   v_t = (1 − α) (v_{t-1} + α (d_t − m_{t-1})²)
 */

const { baselineDailyDemand } = require('./scenarioGenerator');

const DEFAULT_ALPHA = 0.3;

function initForecasts(instance) {
  const { pharmacies, drugs, scenario } = instance;
  const out = {};
  for (const ph of pharmacies) {
    const vol = scenario.regions[ph.regionType].demandVolatility ?? 0.2;
    out[ph.id] = {};
    for (const drug of drugs) {
      const prior = baselineDailyDemand(ph, drug, scenario);
      const priorSigma = Math.max(0.5, prior * vol);
      out[ph.id][drug.id] = {
        prior,
        priorSigma,
        mean: prior,
        variance: priorSigma * priorSigma,
        observations: 0,
      };
    }
  }
  return out;
}

function updateForecast(f, demand, alpha = DEFAULT_ALPHA) {
  const err = demand - f.mean;
  f.mean += alpha * err;
  f.variance = (1 - alpha) * (f.variance + alpha * err * err);
  f.observations += 1;
}

/** Forecast used by a policy: adaptive (EWMA) or static (planning prior only). */
function forecastFor(forecasts, phId, drugId, adaptive = true) {
  const f = forecasts[phId][drugId];
  if (!adaptive) return { mean: f.prior, sigma: f.priorSigma };
  return { mean: Math.max(0, f.mean), sigma: Math.max(0.5, Math.sqrt(f.variance)) };
}

module.exports = { initForecasts, updateForecast, forecastFor, DEFAULT_ALPHA };
