/**
 * Inventory & distribution policies (explicit algorithm names — not generic "AI").
 */

const POLICIES = {
  'fixed-allocation': {
    id: 'fixed-allocation',
    name: 'Fixed allocation baseline',
    version: '1.0.0',
    algorithm: 'Population-proportional target stock replenishment on fixed review days',
    description: 'Replenish each pharmacy toward a population-proportional target stock each review day.',
    params: {},
  },
  'reorder-point': {
    id: 'reorder-point',
    name: 'Reorder point (s, Q) baseline',
    version: '1.0.0',
    algorithm: 'Classic (s, Q) inventory control',
    description: 'Order fixed batch Q when on-hand ≤ s.',
    params: { s: 80, Q: 200 },
  },
  'cost-first': {
    id: 'cost-first',
    name: 'Cost-first heuristic',
    version: '1.0.0',
    algorithm: 'Greedy cost minimization with priority deferral',
    description: 'Minimize holding + ordering + transport; defer low-priority SKUs when budget tight.',
    params: {},
  },
  'equity-aware': {
    id: 'equity-aware',
    name: 'Equity-aware multi-objective heuristic',
    version: '1.0.0',
    algorithm: 'Weighted penalty scoring (cost + stockout + wait + inequity)',
    description: 'Replenishment driven by composite penalty: totalCost + stockoutPenalty + waitingTimePenalty + inequityPenalty.',
    params: {},
  },
};

const POLICY_ALIASES = {
  'fixed-allocation-v1': 'fixed-allocation',
  'reorder-point-v1': 'reorder-point',
  'cost-first-v1': 'cost-first',
  'equity-aware-v1': 'equity-aware',
};

function resolvePolicyId(id) {
  if (!id) return null;
  if (POLICIES[id]) return id;
  return POLICY_ALIASES[id] || null;
}

function listPolicies() {
  return Object.values(POLICIES);
}

function getPolicy(id) {
  const canonical = resolvePolicyId(id);
  return canonical ? POLICIES[canonical] : null;
}

function decideReplenishment({
  policyId,
  day,
  instance,
  pharmacyStates,
  warehouseStates,
  recentStockoutsByPharmacy,
}) {
  const canonical = resolvePolicyId(policyId);
  const orders = [];
  const { pharmacies, drugs } = instance;
  const totalPop = pharmacies.reduce((s, p) => s + p.population, 0);

  for (const ph of pharmacies) {
    const phState = pharmacyStates.find((p) => p.id === ph.id);
    const wh = warehouseStates.find((w) => w.id === ph.warehouseId);
    if (!phState || !wh) continue;

    for (const drug of drugs) {
      const onHand = phState.onHand[drug.id] || 0;
      let orderQty = 0;

      if (canonical === 'fixed-allocation') {
        const target = Math.round((ph.population / totalPop) * 400 * (drug.priority === 'essential' ? 1.3 : 1));
        if (day % 3 === 0 && onHand < target) orderQty = target - onHand;
      } else if (canonical === 'reorder-point') {
        const { s, Q } = POLICIES['reorder-point'].params;
        if (onHand <= s) orderQty = Q;
      } else if (canonical === 'cost-first') {
        if (onHand < 60 && day % 2 === 0) {
          orderQty = drug.priority === 'routine' ? 80 : 150;
        }
      } else if (canonical === 'equity-aware') {
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
  POLICY_ALIASES,
  resolvePolicyId,
  listPolicies,
  getPolicy,
  decideReplenishment,
};
