const { createJsonFileStore } = require('../common/jsonFileStore');

/**
 * Case documents. History arrays (transitions, analyses, decisions, confirmations, feedback)
 * are only ever appended to by workflowService; nothing here removes entries.
 */
const store = createJsonFileStore('cases.json', { cases: {}, tokens: {}, proposals: {}, purchaseDrafts: [], settings: {} });

function getCase(caseId) {
  return store.read().cases[caseId] || null;
}

function listCases(filter = {}) {
  let list = Object.values(store.read().cases);
  if (filter.state) list = list.filter((c) => c.state === filter.state);
  if (filter.riskTier) list = list.filter((c) => c.analyses?.at(-1)?.output?.riskTier === filter.riskTier);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function saveCase(c) {
  store.update((d) => { d.cases[c.caseId] = c; });
  return c;
}

function tokens() {
  return {
    get: (hash) => store.read().tokens[hash] || null,
    put: (hash, rec) => store.update((d) => { d.tokens[hash] = rec; }),
  };
}

function proposals() {
  return {
    get: (id) => store.read().proposals[id] || null,
    put: (p) => store.update((d) => { d.proposals[p.proposalId] = p; }),
    list: () => Object.values(store.read().proposals).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  };
}

function addPurchaseDraft(doc) {
  store.update((d) => { d.purchaseDrafts.push(doc); });
  return doc;
}

function purchaseDrafts() {
  return store.read().purchaseDrafts;
}

function settings() {
  return {
    get: () => store.read().settings,
    set: (patch) => store.update((d) => { d.settings = { ...d.settings, ...patch }; }),
  };
}

module.exports = {
  getCase, listCases, saveCase, tokens, proposals, addPurchaseDraft, purchaseDrafts, settings, _store: store,
};
