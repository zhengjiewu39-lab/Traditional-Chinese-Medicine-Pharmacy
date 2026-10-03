const express = require('express');
const { getStore, updateStore, nextId } = require('../data/store');
const { requirePermission } = require('../security/rbac');
const { appendTimeline } = require('../services/prescriptionWorkflow');

const router = express.Router();

function genBillNo() {
  return `BILL${Date.now()}`;
}

router.get('/', (req, res) => {
  res.json(getStore().bills || []);
});

router.post('/checkout', requirePermission('billing:checkout'), (req, res) => {
  const role = req.user?.role;
  if (!['admin', 'technician'].includes(role)) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Checkout requires admin or technician' } });
  }
  const { customerId, customerName, items, paymentMethod, discount, prescriptionId, caseId, cashier } = req.body;
  if (!items?.length) return res.status(400).json({ message: '购物车为空' });
  if (caseId) {
    return res.status(409).json({ error: { code: 'use_dispense_path', message: 'Case inventory is deducted at dispensing, not at checkout' } });
  }

  let bill;
  let order;
  try {
    updateStore(data => {
      let subtotal = 0;
      const lineItems = [];
      for (const item of items) {
        const inv = data.inventory.find(i => i.id === item.herbId || i.name === item.name);
        if (!inv) throw new Error(`未找到药品：${item.name}`);
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) throw new Error('数量必须为正数');
        if (inv.stock < qty) throw new Error(`${inv.name} 库存不足（剩余 ${inv.stock}${inv.unit}）`);
        subtotal += inv.price * qty;
        inv.stock -= qty;
        const herb = data.herbs.find(h => h.name === inv.name);
        if (herb) herb.stock = inv.stock;
        lineItems.push({ herbId: inv.id, name: inv.name, quantity: qty, price: inv.price, unit: inv.unit });
      }

      const disc = Number(discount || 0);
      if (disc < 0 || disc > subtotal) throw new Error('折扣不合法');
      const total = Math.round((subtotal - disc) * 100) / 100;
      if (total < 0) throw new Error('总价不能为负');
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
        cust.lastVisit = order.date;
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
