const crypto = require('crypto');

function hashScenario(scenario) {
  const stable = JSON.stringify(scenario, Object.keys(scenario).sort());
  return crypto.createHash('sha256').update(stable).digest('hex');
}

module.exports = { hashScenario };
