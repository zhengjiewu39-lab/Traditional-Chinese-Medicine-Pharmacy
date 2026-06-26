const express = require('express');
const { getStore } = require('../data/store');
const { computeSalesStats } = require('../services/stats');

const router = express.Router();

router.get('/prescription-trends', (req, res) => {
  const data = getStore();
  const months = ['一月', '二月', '三月', '四月', '五月', '六月'];
  res.json(months.map((m, i) => ({ month: m, count: Math.floor(data.prescriptions.length * (0.5 + i * 0.1)) })));
});

router.get('/herb-usage', (req, res) => {
  const counts = {};
  getStore().prescriptions.forEach(p => {
    (p.herbs || []).forEach(h => {
      const name = typeof h === 'string' ? h : h.name;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  res.json(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
});

router.get('/diagnosis', (req, res) => {
  const counts = {};
  getStore().prescriptions.forEach(p => {
    if (p.diagnosis) counts[p.diagnosis] = (counts[p.diagnosis] || 0) + 1;
  });
  res.json(Object.entries(counts).map(([diagnosis, count]) => ({ diagnosis, count })));
});

router.get('/top-templates', (req, res) => {
  res.json((getStore().prescriptionTemplates || []).sort((a, b) => b.popularity - a.popularity));
});

module.exports = router;
