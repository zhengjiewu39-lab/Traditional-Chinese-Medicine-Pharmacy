const express = require('express');
const { getStore } = require('../data/store');

const router = express.Router();

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')));
  return lines.join('\n');
}

function maskName(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return `${s.slice(0, 1)}**`;
}

function maskPhone(value) {
  const s = String(value || '');
  if (s.length < 4) return '****';
  return `${s.slice(0, 3)}****`;
}

router.get('/inventory', (req, res) => {
  const data = getStore().inventory;
  const csv = toCsv(data, ['id', 'name', 'category', 'stock', 'unit', 'price', 'minStock', 'supplier', 'expiryDate']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
  res.send('\uFEFF' + csv);
});

router.get('/customers', (req, res) => {
  const rows = getStore().customers.map((c) => ({
    id: c.id,
    name: maskName(c.name),
    phone: maskPhone(c.phone),
    address: c.address ? 'REDACTED' : '',
    visits: c.visits,
    spending: c.spending,
    memberLevel: c.memberLevel,
  }));
  const csv = toCsv(rows, ['id', 'name', 'phone', 'address', 'visits', 'spending', 'memberLevel']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=customers-deidentified.csv');
  res.send('\uFEFF' + csv);
});

router.get('/sales', (req, res) => {
  const rows = getStore().orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    customerName: maskName(o.customerName),
    total: o.total,
    status: o.status,
    date: o.date,
    paymentMethod: o.paymentMethod,
  }));
  const csv = toCsv(rows, ['id', 'orderNo', 'customerName', 'total', 'status', 'date', 'paymentMethod']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-deidentified.csv');
  res.send('\uFEFF' + csv);
});

module.exports = router;
