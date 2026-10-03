const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const catalog = require('../workflow/catalogAlign');

const router = express.Router();

function genOrderNo() {
  return `ORD${Date.now()}`;
}

router.get('/catalog', (req, res) => {
  const snap = catalog.snapshot();
  res.json({ herbs: snap.herbs, inventory: snap.inventory });
});

router.get('/', (req, res) => {
  const { status } = req.query;
  let orders = getStore().orders;
  if (status) orders = orders.filter((o) => o.status === status);
  res.json(orders);
});

router.get('/:id', (req, res) => {
  const o = getStore().orders.find((x) => x.id === +req.params.id);
  if (!o) return res.status(404).json({ message: '未找到' });
  res.json(o);
});

router.post('/', (req, res) => {
  let created;
  try {
    const items = req.body.items || [];
    if (!items.length) throw new Error('订单至少需要一味药品');
    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const inv = catalog.resolve({ id: item.herbId, name: item.name });
      if (!inv) throw new Error(`未找到药品：${item.name || item.herbId}。只能从仓库目录选择。`);
      const qty = Number(item.quantity) || 1;
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('数量必须为正数');
      const price = item.price ?? inv.price ?? 0;
      subtotal += price * qty;
      lineItems.push({
        herbId: inv.id,
        name: inv.name,
        quantity: qty,
        price,
        unit: inv.unit || item.unit,
        warehouseStock: inv.stock,
      });
    }

    if (req.body.receiveIntoStock) {
      for (const line of lineItems) {
        catalog.inbound(line, line.quantity, {
          reason: 'purchase',
          note: '采购入库',
          batchNo: req.body.batchNo,
          expiresAt: req.body.expiresAt,
        });
        line.warehouseStock = catalog.resolve(line).stock;
      }
    } else if (req.body.deductStock === true) {
      for (const line of lineItems) {
        catalog.outbound(line, line.quantity, { reason: 'sale', note: '订单出库' });
        line.warehouseStock = catalog.resolve(line).stock;
      }
    }

    const discount = req.body.discount || 0;
    updateStore((data) => {
      created = {
        id: nextId(data, 'order'),
        orderNo: genOrderNo(),
        date: new Date().toISOString().slice(0, 10),
        status: req.body.status || '待付款',
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        total: Math.round((subtotal - discount) * 100) / 100,
        source: req.body.source || '手动',
        orderType: req.body.receiveIntoStock ? '采购' : (req.body.orderType || '销售'),
        items: lineItems,
        customerName: req.body.customerName,
        customerId: req.body.customerId,
        shippingAddress: req.body.shippingAddress,
        paymentMethod: req.body.paymentMethod,
      };
      data.orders.unshift(created);

      if (created.customerId && created.status === '已完成') {
        const cust = data.customers.find((c) => c.id === created.customerId);
        if (cust) {
          cust.visits = (cust.visits || 0) + 1;
          cust.spending = (cust.spending || 0) + created.total;
          cust.lastVisit = created.date;
          cust.points = (cust.points || 0) + Math.floor(created.total / 10);
        }
      }
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  let updated;
  updateStore((data) => {
    const idx = data.orders.findIndex((o) => o.id === +req.params.id);
    if (idx === -1) return;
    const prev = data.orders[idx];
    data.orders[idx] = { ...prev, ...req.body, id: +req.params.id };
    updated = data.orders[idx];
    if (req.body.status === '已完成' && prev.status !== '已完成' && updated.customerId) {
      const cust = data.customers.find((c) => c.id === updated.customerId);
      if (cust) {
        cust.visits = (cust.visits || 0) + 1;
        cust.spending = (cust.spending || 0) + updated.total;
        cust.lastVisit = updated.date;
      }
    }
  });
  if (!updated) return res.status(404).json({ message: '未找到' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  updateStore((data) => {
    data.orders = data.orders.filter((o) => o.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
