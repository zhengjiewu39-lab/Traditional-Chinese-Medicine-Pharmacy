const express = require('express');
const { getStore } = require('../data/store');
const { lookupTraceability, ensureTraceabilityData, hydrateTraceability } = require('../data/traceabilityGenerator');

const router = express.Router();

router.get('/', (req, res) => {
  const store = getStore();
  if (!store.traceability?.records?.length) {
    ensureTraceabilityData(store);
  }
  hydrateTraceability(store);
  const { q, limit = 50, offset = 0 } = req.query;
  let records = store.traceability?.records || [];
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
    sampleCodes: (store.traceability?.records || []).slice(0, 6).map((r) => ({
      traceCode: r.traceCode,
      name: r.name,
      batchNumber: r.batchNumber,
    })),
    records: slice,
  });
});

router.get('/lookup/:code', (req, res) => {
  const store = getStore();
  if (!store.traceability?.records?.length) {
    ensureTraceabilityData(store);
  }
  hydrateTraceability(store);
  const result = lookupTraceability(store, req.params.code);
  if (!result) {
    return res.status(404).json({ message: '未找到溯源信息', code: req.params.code });
  }
  res.json(result);
});

module.exports = router;
