const express = require('express');
const { getStore } = require('../data/store');

const router = express.Router();

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')));
  return lines.join('\n');
}

router.get('/inventory', (req, res) => {
  const data = getStore().inventory;
  const csv = toCsv(data, ['id', 'name', 'category', 'stock', 'unit', 'price', 'minStock', 'supplier', 'expiryDate']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
  res.send('\uFEFF' + csv);
});

router.get('/customers', (req, res) => {
  const csv = toCsv(getStore().customers, ['id', 'name', 'phone', 'address', 'visits', 'spending', 'memberLevel']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
  res.send('\uFEFF' + csv);
});

router.get('/sales', (req, res) => {
  const csv = toCsv(getStore().orders, ['id', 'orderNo', 'customerName', 'total', 'status', 'date', 'paymentMethod']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=sales.csv');
  res.send('\uFEFF' + csv);
});

module.exports = router;
