/**
 * Inventory & distribution policies (explicit names — not "AI").
 */

const POLICIES = {
  'fixed-allocation-v1': {
    id: 'fixed-allocation-v1',
    name: 'Fixed allocation baseline',
    version: '1.0.0',
    description: 'Replenish each pharmacy to a population-proportional target stock each review day.',
  },
  'reorder-point-v1': {
    id: 'reorder-point-v1',
    name: 'Reorder point (s, Q) baseline',
    version: '1.0.0',
    description: 'Classic (s, Q): order fixed batch Q when on-hand ≤ s.',
    params: { s: 80, Q: 200 },
  },
  'cost-first-v1': {
    id: 'cost-first-v1',
    name: 'Cost-first heuristic',
    version: '1.0.0',
    description: 'Minimize holding + ordering + transport; defer low-priority SKUs when budget tight.',
  },
  'equity-aware-v1': {
    id: 'equity-aware-v1',
    name: 'Equity-aware multi-objective',
    version: '1.0.0',
    description: 'Score = cost + stockout + waiting + inequity penalties (see metricsEngine).',
  },
};

function listPolicies() {
  return Object.values(POLICIES);
}

function getPolicy(id) {
  return POLICIES[id] || null;
}

function decideReplenishment({
  policyId,
  day,
  instance,
  pharmacyStates,
  warehouseStates,
  recentStockoutsByPharmacy,
}) {
  const orders = [];
  const { pharmacies, drugs, scenario } = instance;
  const totalPop = pharmacies.reduce((s, p) => s + p.population, 0);

  for (const ph of pharmacies) {
    const phState = pharmacyStates.find((p) => p.id === ph.id);
    const wh = warehouseStates.find((w) => w.id === ph.warehouseId);
    if (!phState || !wh) continue;

    for (const drug of drugs) {
      const onHand = phState.onHand[drug.id] || 0;
      let orderQty = 0;

      if (policyId === 'fixed-allocation-v1') {
        const target = Math.round((ph.population / totalPop) * 400 * (drug.priority === 'essential' ? 1.3 : 1));
        if (day % 3 === 0 && onHand < target) orderQty = target - onHand;
      } else if (policyId === 'reorder-point-v1') {
        const { s, Q } = POLICIES['reorder-point-v1'].params;
        if (onHand <= s) orderQty = Q;
      } else if (policyId === 'cost-first-v1') {
        if (onHand < 60 && day % 2 === 0) {
          orderQty = drug.priority === 'routine' ? 80 : 150;
        }
      } else if (policyId === 'equity-aware-v1') {
        const stockouts = recentStockoutsByPharmacy[ph.id] || 0;
        const vuln = ph.vulnerabilityWeight;
        const target = Math.round(120 * vuln + stockouts * 10);
        if (onHand < target) orderQty = target - onHand;
        if (drug.priority === 'essential') orderQty = Math.round(orderQty * 1.25);
      }

      if (orderQty > 0) {
        const available = wh.onHand[drug.id] || 0;
        const qty = Math.min(orderQty, available);
        if (qty > 0) {
          wh.onHand[drug.id] = available - qty;
          orders.push({
            pharmacyId: ph.id,
            warehouseId: wh.id,
            drugId: drug.id,
            qty,
            regionType: ph.regionType,
          });
        }
      }
    }
  }

  return orders;
}

module.exports = {
  POLICIES,
  listPolicies,
  getPolicy,
  decideReplenishment,
};
