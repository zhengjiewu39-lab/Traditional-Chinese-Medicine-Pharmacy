const { describe, it } = require('node:test');
const assert = require('node:assert');
const { generateTraceabilityCatalog, lookupTraceability, traceCodeForHerb } = require('../data/traceabilityGenerator');
const { CATALOG_HERBS } = require('../data/herbCatalog');

describe('traceability generator', () => {
  it('generates one record per catalog herb', () => {
    const { records } = generateTraceabilityCatalog(CATALOG_HERBS.slice(0, 5));
    assert.strictEqual(records.length, 5);
    assert.ok(records[0].traceCode.startsWith('TR-'));
    assert.strictEqual(records[0].blocks.length, 5);
  });

  it('lookup by trace code, batch and name', () => {
    const store = { herbs: CATALOG_HERBS.slice(0, 3) };
    const { byCode } = generateTraceabilityCatalog(store.herbs);
    store.traceability = { records: Object.values(byCode).filter((v, i, a) => a.findIndex(x => x.traceCode === v.traceCode) === i), byCode };
    const herb = CATALOG_HERBS[1];
    assert.ok(lookupTraceability(store, traceCodeForHerb(herb)));
    assert.ok(lookupTraceability(store, herb.name));
    assert.ok(lookupTraceability(store, herb.batchNo));
  });
});
