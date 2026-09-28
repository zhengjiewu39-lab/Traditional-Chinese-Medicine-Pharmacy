const { createJsonFileStore } = require('../common/jsonFileStore');

/**
 * Case documents. History arrays (transitions, analyses, decisions, confirmations, feedback)
 * are only ever appended to by workflowService; nothing here removes entries.
 */
const INITIAL = {
  cases: {}, tokens: {}, proposals: {}, purchaseDrafts: [], settings: {},
  drafts: {}, suggestions: {}, pickupTokens: {}, pickupFailures: {},
  learningExports: [], datasets: {}, modelRegistry: {}, samplingLog: [],
};

const store = createJsonFileStore('cases.json', INITIAL);

function data() {
  const d = store.read();
  for (const k of Object.keys(INITIAL)) {
    if (d[k] == null) d[k] = structuredClone(INITIAL[k]);
  }
  return d;
}

function getCase(caseId) {
  return data().cases[caseId] || null;
}

function listCases(filter = {}) {
  let list = Object.values(data().cases);
  if (filter.state) list = list.filter((c) => c.state === filter.state);
  if (filter.riskTier) list = list.filter((c) => c.analyses?.at(-1)?.output?.riskTier === filter.riskTier);
  if (filter.createdById) list = list.filter((c) => c.createdBy?.id === String(filter.createdById));
  if (filter.queue === 'priority') {
    list = list.filter((c) => c.state === 'pharmacist_review_required');
  }
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function saveCase(c) {
  store.update((d) => { d.cases[c.caseId] = c; });
  return c;
}

function tokens() {
  return {
    get: (hash) => data().tokens[hash] || null,
    put: (hash, rec) => store.update((d) => { d.tokens[hash] = rec; }),
  };
}

function proposals() {
  return {
    get: (id) => data().proposals[id] || null,
    put: (p) => store.update((d) => { d.proposals[p.proposalId] = p; }),
    list: () => Object.values(data().proposals).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  };
}

function addPurchaseDraft(doc) {
  store.update((d) => { d.purchaseDrafts.push(doc); });
  return doc;
}

function purchaseDrafts() {
  return data().purchaseDrafts || [];
}

function settings() {
  return {
    get: () => data().settings || {},
    set: (patch) => store.update((d) => { d.settings = { ...d.settings, ...patch }; }),
  };
}

function getDraft(id) {
  return data().drafts[id] || null;
}

function listDrafts(filter = {}) {
  let list = Object.values(data().drafts);
  if (filter.createdById) list = list.filter((d) => d.createdBy?.id === String(filter.createdById));
  if (filter.status) list = list.filter((d) => d.status === filter.status);
  return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function saveDraft(draft) {
  store.update((d) => { d.drafts[draft.draftId] = draft; });
  return draft;
}

function getSuggestion(id) {
  return data().suggestions[id] || null;
}

function listSuggestions(filter = {}) {
  let list = Object.values(data().suggestions);
  if (filter.draftId) list = list.filter((s) => s.draftId === filter.draftId);
  if (filter.caseId) list = list.filter((s) => s.caseId === filter.caseId);
  if (filter.status) list = list.filter((s) => s.status === filter.status);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function saveSuggestion(s) {
  store.update((d) => { d.suggestions[s.suggestionId] = s; });
  return s;
}

function pickupTokens() {
  return {
    get: (hash) => data().pickupTokens[hash] || null,
    put: (hash, rec) => store.update((d) => { d.pickupTokens[hash] = rec; }),
    list: () => Object.values(data().pickupTokens),
  };
}

function pickupFailures() {
  return {
    get: (key) => data().pickupFailures[key] || { count: 0, lockedUntil: null },
    put: (key, rec) => store.update((d) => { d.pickupFailures[key] = rec; }),
  };
}

function learning() {
  return {
    listExports: () => data().learningExports,
    addExport: (row) => store.update((d) => { d.learningExports.push(row); }),
    getDataset: (id) => data().datasets[id] || null,
    putDataset: (ds) => store.update((d) => { d.datasets[ds.datasetId] = ds; }),
    listDatasets: () => Object.values(data().datasets),
    getModel: (id) => data().modelRegistry[id] || null,
    putModel: (m) => store.update((d) => { d.modelRegistry[m.modelId] = m; }),
    listModels: () => Object.values(data().modelRegistry),
    addSample: (row) => store.update((d) => { d.samplingLog.push(row); }),
    samples: () => data().samplingLog,
  };
}

module.exports = {
  getCase, listCases, saveCase, tokens, proposals, addPurchaseDraft, purchaseDrafts, settings,
  getDraft, listDrafts, saveDraft, getSuggestion, listSuggestions, saveSuggestion,
  pickupTokens, pickupFailures, learning, _store: store,
};
