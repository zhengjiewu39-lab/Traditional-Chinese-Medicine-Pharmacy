const express = require('express');
const { getStore } = require('../data/store');
const { computeInventoryStats, computeCustomerStats, computeSalesStats } = require('../services/stats');

const router = express.Router();

router.get('/overview', (req, res) => {
  const data = getStore();
  const lowStock = data.inventory.filter(i => i.stock <= i.minStock);
  const pendingPrescriptions = data.prescriptions.filter(p => p.status === '待审核');
  const awaitingPickup = data.prescriptions.filter(p => ['待取药', '配药中', '已审核'].includes(p.status));
  const pendingOrders = data.orders.filter(o => o.status === '待付款' || o.status === '处理中');
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = data.orders
    .filter(o => o.date === today && (o.status === '已完成' || o.status === '已支付'))
    .reduce((s, o) => s + o.total, 0);

  res.json({
    inventory: computeInventoryStats(data.inventory),
    customers: computeCustomerStats(data.customers),
    sales: computeSalesStats(data.orders),
    salesTrends: data.sales?.trends || [],
    alerts: {
      lowStock: lowStock.length,
      pendingPrescriptions: pendingPrescriptions.length,
      awaitingPickup: awaitingPickup.length,
      pendingOrders: pendingOrders.length,
    },
    todaySales: Math.round(todaySales),
    recentOrders: data.orders.slice(0, 5),
    lowStockItems: lowStock.slice(0, 5),
    pendingPrescriptions: pendingPrescriptions.slice(0, 5),
    pickupQueue: awaitingPickup.slice(0, 8),
  });
});

router.get('/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ herbs: [], customers: [], patients: [], orders: [] });
  const data = getStore();
  res.json({
    herbs: data.herbs.filter(h => h.name.includes(q) || h.pinyin?.includes(q)).slice(0, 8),
    customers: data.customers.filter(c => c.name.includes(q) || c.phone.includes(q)).slice(0, 5),
    patients: data.patients.filter(p => p.name.includes(q) || p.phone.includes(q)).slice(0, 5),
    orders: data.orders.filter(o => o.orderNo?.includes(q) || o.customerName?.includes(q)).slice(0, 5),
  });
});

module.exports = router;
