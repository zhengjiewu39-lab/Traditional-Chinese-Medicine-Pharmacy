const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');

const { logInventoryHistory } = require('../services/stats');
const { appendTimeline } = require('../services/prescriptionWorkflow');

const router = express.Router();

function genBillNo() {
  return `BILL${Date.now()}`;
}

router.get('/', (req, res) => {
  res.json(getStore().bills || []);
});

router.post('/checkout', (req, res) => {
  const { customerId, customerName, items, paymentMethod, discount, prescriptionId, cashier } = req.body;
  if (!items?.length) return res.status(400).json({ message: '购物车为空' });

  let bill;
  let order;
  try {
    updateStore(data => {
      let subtotal = 0;
      const lineItems = [];
      for (const item of items) {
        const inv = data.inventory.find(i => i.id === item.herbId || i.name === item.name);
        if (!inv) throw new Error(`未找到药品：${item.name}`);
        const qty = item.quantity || 1;
        if (inv.stock < qty) throw new Error(`${inv.name} 库存不足（剩余 ${inv.stock}${inv.unit}）`);
        subtotal += inv.price * qty;
        inv.stock -= qty;
        const herb = data.herbs.find(h => h.name === inv.name);
        if (herb) herb.stock = inv.stock;
        lineItems.push({ herbId: inv.id, name: inv.name, quantity: qty, price: inv.price, unit: inv.unit });
      }

      const disc = discount || 0;
      const total = Math.round((subtotal - disc) * 100) / 100;
      const cust = customerId ? data.customers.find(c => c.id === customerId) : null;
      const name = customerName || cust?.name || '散客';

      order = {
        id: nextId(data, 'order'),
        orderNo: `ORD${Date.now()}`,
        customerId: customerId || null,
        customerName: name,
        items: lineItems,
        subtotal, discount: disc, total,
        status: '已完成',
        paymentMethod: paymentMethod || '现金',
        date: new Date().toISOString().slice(0, 10),
        source: '收银台',
        prescriptionId: prescriptionId || null,
      };
      data.orders.unshift(order);

      bill = {
        id: nextId(data, 'bill'),
        billNo: genBillNo(),
        orderId: order.id,
        customerId: customerId || null,
        customerName: name,
        amount: total,
        paymentMethod: order.paymentMethod,
        status: '已支付',
        cashier: cashier || '管理员',
        createdAt: new Date().toISOString(),
        items: lineItems,
      };
      data.bills = data.bills || [];
      data.bills.unshift(bill);

      if (cust) {
        cust.visits = (cust.visits || 0) + 1;
        cust.spending = (cust.spending || 0) + total;
        cust.lastVisit = order.date;
        cust.points = (cust.points || 0) + Math.floor(total / 10);
      }

      if (prescriptionId) {
        const rxIdx = data.prescriptions.findIndex(p => p.id === +prescriptionId);
        if (rxIdx >= 0) {
          const rx = data.prescriptions[rxIdx];
          data.prescriptions[rxIdx] = {
            ...rx,
            status: '已完成',
            orderId: order.id,
            billId: bill.id,
            completedAt: new Date().toISOString(),
            timeline: appendTimeline(rx, '已完成', cashier || '收银员', `取药完成 · 小票 ${bill.billNo}`),
          };
        }
      }
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }

  res.status(201).json({ bill, order, message: '结算成功' });
});

module.exports = router;
