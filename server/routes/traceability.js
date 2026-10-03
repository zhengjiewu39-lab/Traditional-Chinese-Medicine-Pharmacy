const express = require('express');
const { getStore } = require('../data/store');
const { lookupTraceability, ensureTraceabilityData, hydrateTraceability } = require('../data/traceabilityGenerator');
const catalog = require('../workflow/catalogAlign');

const router = express.Router();

function liveRecords() {
  catalog.alignKinds();
  const store = getStore();
  if (!store.traceability?.records?.length) ensureTraceabilityData(store);
  hydrateTraceability(store);
  return catalog.snapshot().records;
}

router.get('/', (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query;
  let records = liveRecords();
  if (q) {
    const term = q.toLowerCase();
    records = records.filter((r) =>
      r.name.includes(q)
      || r.traceCode.toLowerCase().includes(term)
      || r.batchNumber?.toLowerCase().includes(term)
      || r.pinyin?.includes(term)
      || r.category?.includes(q)
    );
  }
  const slice = records.slice(+offset, +offset + +limit);
  res.json({
    total: records.length,
    offset: +offset,
    limit: +limit,
    sampleCodes: (catalog.snapshot().records || []).slice(0, 6).map((r) => ({
      traceCode: r.traceCode,
      name: r.name,
      batchNumber: r.batchNumber,
      inventoryStock: r.inventoryStock,
    })),
    records: slice,
  });
});

router.get('/lookup/:code', (req, res) => {
  const store = getStore();
  catalog.alignKinds();
  if (!store.traceability?.records?.length) ensureTraceabilityData(store);
  hydrateTraceability(store);
  const result = lookupTraceability(store, req.params.code);
  if (!result) {
    return res.status(404).json({ message: '未找到溯源信息', code: req.params.code });
  }
  const live = catalog.snapshot().records.find((r) => r.traceCode === result.traceCode || r.name === result.name);
  res.json(live || result);
});

module.exports = router;
