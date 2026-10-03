const express = require('express');
const { updateStore } = require('../data/store');
const catalog = require('../workflow/catalogAlign');
const { buildTraceRecord } = require('../data/traceabilityGenerator');

const router = express.Router();

function filterHerbs(list, { q, category, query } = {}) {
  const term = String(q || query || '').toLowerCase();
  let herbs = list;
  if (term) {
    herbs = herbs.filter((h) => h.name.includes(q || query) || h.pinyin?.includes(term) || h.category?.includes(q || query));
  }
  if (category) herbs = herbs.filter((h) => h.category === category);
  return herbs;
}

router.get('/', (req, res) => {
  res.json(filterHerbs(catalog.snapshot().herbs, req.query));
});

router.get('/search', (req, res) => {
  res.json(filterHerbs(catalog.snapshot().herbs, { q: req.query.query || req.query.q || '' }));
});

router.get('/:id', (req, res) => {
  const h = catalog.snapshot().herbs.find((x) => x.id === +req.params.id);
  if (!h) return res.status(404).json({ message: '未找到' });
  res.json(h);
});

router.post('/', (req, res) => {
  let created;
  const opening = Number(req.body.stock) || 0;
  updateStore((data) => {
    const id = catalog.nextSharedId(data);
    created = { minStock: 10, ...req.body, id, stock: 0 };
    data.herbs.push(created);
    if (!data.inventory.some((i) => i.id === id || i.name === created.name)) {
      data.inventory.push({
        id,
        name: created.name,
        category: created.category,
        stock: created.stock,
        unit: created.unit,
        price: created.price,
        minStock: created.minStock,
        supplier: created.supplier || '—',
        expiryDate: created.expiryDate,
        batchNo: created.batchNo || `H${String(id).padStart(4, '0')}`,
        location: '主库-A区',
      });
    }
    data.traceability = data.traceability || { records: [] };
    if (!data.traceability.records.some((r) => r.herbId === id || r.name === created.name)) {
      data.traceability.records.push(buildTraceRecord(created));
    }
  });
  if (opening > 0) {
    catalog.inbound(created, opening, {
      reason: 'create',
      note: '新增目录',
      batchNo: created.batchNo,
      expiresAt: created.expiryDate,
    });
  }
  res.status(201).json(catalog.snapshot().herbs.find((h) => h.id === created.id));
});

router.put('/:id', (req, res) => {
  const id = +req.params.id;
  const before = catalog.snapshot().herbs.find((h) => h.id === id);
  if (!before) return res.status(404).json({ message: '未找到' });
  const nextStock = req.body.stock != null ? Number(req.body.stock) : before.stock;
  updateStore((data) => {
    const idx = data.herbs.findIndex((h) => h.id === id);
    if (idx === -1) return;
    const { stock, ...rest } = req.body;
    data.herbs[idx] = { ...data.herbs[idx], ...rest, id };
    const inv = data.inventory.find((i) => i.id === id || i.name === data.herbs[idx].name);
    if (inv) Object.assign(inv, { price: data.herbs[idx].price, category: data.herbs[idx].category, name: data.herbs[idx].name });
  });
  if (Number.isFinite(nextStock) && nextStock !== before.stock) {
    catalog.setUsableQty({ id }, nextStock);
  }
  res.json(catalog.snapshot().herbs.find((h) => h.id === id));
});

router.delete('/:id', (req, res) => {
  const id = +req.params.id;
  updateStore((data) => {
    const herb = data.herbs.find((h) => h.id === id);
    data.herbs = data.herbs.filter((h) => h.id !== id);
    data.inventory = data.inventory.filter((i) => i.id !== id && (!herb || i.name !== herb.name));
    if (data.traceability?.records) {
      data.traceability.records = data.traceability.records.filter((r) => r.herbId !== id && (!herb || r.name !== herb.name));
    }
  });
  res.json({ success: true });
});

module.exports = router;
