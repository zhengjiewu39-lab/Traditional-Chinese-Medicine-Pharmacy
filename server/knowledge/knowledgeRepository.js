const { loadRegistry } = require('./sourceRegistry');

/** Read access to usable knowledge only: approved status and a verified hash. */
function getUsable(sourceId) {
  const e = loadRegistry().entries.find((x) => x.sourceId === sourceId);
  return e && e.usable ? e : null;
}

function exists(sourceId) {
  return Boolean(getUsable(sourceId));
}

function usableEntries() {
  return loadRegistry().entries.filter((e) => e.usable);
}

function integrityReport() {
  const entries = loadRegistry().entries;
  return {
    total: entries.length,
    usable: entries.filter((e) => e.usable).length,
    notApproved: entries.filter((e) => e.reviewStatus !== 'approved').map((e) => e.sourceId),
    integrityFailed: entries.filter((e) => !e.integrityOk).map((e) => e.sourceId),
  };
}

module.exports = { getUsable, exists, usableEntries, integrityReport };
