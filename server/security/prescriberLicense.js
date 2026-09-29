/**
 * Prescriber license status comes from the signed account or the institution roster.
 * Workflow code must not invent licenseVerified: true.
 */
const { getUserById } = require('./auth');

function resolvePrescriberLicense(actor) {
  if (actor?.license && typeof actor.license.verified === 'boolean') {
    return {
      verified: actor.license.verified,
      source: actor.license.source || 'account_token',
      attestedAt: actor.license.attestedAt || null,
    };
  }
  const user = getUserById(actor?.id);
  if (user?.license && typeof user.license.verified === 'boolean') {
    return {
      verified: user.license.verified,
      source: user.license.source || 'institution_roster',
      attestedAt: user.license.attestedAt || null,
      synthetic: Boolean(user.license.synthetic),
    };
  }
  return { verified: false, source: 'not_on_file', attestedAt: null };
}

function prescriberFields(actor) {
  const license = resolvePrescriberLicense(actor);
  const fields = {
    name: actor?.name,
    userId: actor?.id != null ? String(actor.id) : undefined,
    licenseSource: license.source,
  };
  // Only write a boolean when the roster or token actually decided.
  // Unknown (not_on_file) must stay unset: ruleTrack treats false as an A3 source anomaly.
  if (license.source !== 'not_on_file') {
    fields.licenseVerified = license.verified;
  }
  return fields;
}

module.exports = { getUserById, resolvePrescriberLicense, prescriberFields };
