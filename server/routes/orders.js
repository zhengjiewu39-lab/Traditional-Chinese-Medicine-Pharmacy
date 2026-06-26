const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { logInventoryHistory } = require('../services/stats');

const router = express.Router();

function genOrderNo() {
  return `ORD${Date.now()}`;
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let orders = getStore().orders;
  if (status) orders = orders.filter(o => o.status === status);
  res.json(orders);
});

router.get('/:id', (req, res) => {
  const o = getStore().orders.find(x => x.id === +req.params.id);
  if (!o) return res.status(404).json({ message: '未找到' });
  res.json(o);
});

router.post('/', (req, res) => {
  let created;
  try {
    updateStore(data => {
      const items = req.body.items || [];
      let subtotal = 0;
      const lineItems = items.map(item => {
        const inv = data.inventory.find(i => i.id === item.herbId || i.name === item.name);
        const price = item.price ?? inv?.price ?? 0;
        const qty = item.quantity || 1;
        subtotal += price * qty;
        if (inv && req.body.deductStock !== false) {
          if (inv.stock < qty) throw new Error(`${inv.name} 库存不足（剩余 ${inv.stock}${inv.unit}）`);
          inv.stock -= qty;
          logInventoryHistory(data, inv.id, 'sale', qty, `订单出库`);
          const herb = data.herbs.find(h => h.name === inv.name);
          if (herb) herb.stock = inv.stock;
        }
        return { herbId: inv?.id, name: item.name || inv?.name, quantity: qty, price, unit: inv?.unit || item.unit };
      });

      const discount = req.body.discount || 0;
      created = {
        id: nextId(data, 'order'),
        orderNo: genOrderNo(),
        date: new Date().toISOString().slice(0, 10),
        status: req.body.status || '待付款',
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        total: Math.round((subtotal - discount) * 100) / 100,
        source: req.body.source || '手动',
        items: lineItems,
        ...req.body,
      };
      data.orders.unshift(created);

      if (created.customerId && created.status === '已完成') {
        const cust = data.customers.find(c => c.id === created.customerId);
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
  updateStore(data => {
    const idx = data.orders.findIndex(o => o.id === +req.params.id);
    if (idx === -1) return;
    const prev = data.orders[idx];
    data.orders[idx] = { ...prev, ...req.body, id: +req.params.id };
    updated = data.orders[idx];
    if (req.body.status === '已完成' && prev.status !== '已完成' && updated.customerId) {
      const cust = data.customers.find(c => c.id === updated.customerId);
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
  updateStore(data => {
    data.orders = data.orders.filter(o => o.id !== +req.params.id);
  });
  res.json({ success: true });
});

module.exports = router;
