const { PRIORITY_WEIGHT } = require('./simulationConstants');
const { transportCostPerUnit } = require('./distributionEngine');

const POLICIES = {
  'fixed-allocation': {
    id: 'fixed-allocation',
    name: 'Fixed allocation baseline',
    version: '2.0.0',
    algorithm: 'Population-proportional target stock replenishment on fixed review days',
    params: {},
  },
  'reorder-point': {
    id: 'reorder-point',
    name: 'Reorder point (s, Q) baseline',
    version: '2.0.0',
    algorithm: 'Classic (s, Q) inventory control',
    params: { s: 80, Q: 200 },
  },
  'cost-first': {
    id: 'cost-first',
    name: 'Cost-first greedy heuristic',
    version: '2.0.0',
    algorithm: 'Greedy ranking by (expected stockout penalty reduction − marginal logistics cost) per candidate line',
    params: {},
  },
  'equity-aware': {
    id: 'equity-aware',
    name: 'Equity-aware heuristic',
    version: '2.0.0',
    algorithm: 'Greedy ranking by weighted marginal score (stockout, wait proxy, regional inequity signal − cost); not a global optimizer',
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

function stockoutPenaltyPerUnit(drug, scenario) {
  return drug.stockoutPenalty ?? scenario.metricsWeights?.stockoutPenaltyByPriority?.[drug.priority] ?? 15;
}

function buildCandidates({
  policyId,
  day,
  instance,
  pharmacyStates,
  regionalStockoutRate,
}) {
  const canonical = resolvePolicyId(policyId);
  const { pharmacies, drugs, scenario } = instance;
  const totalPop = pharmacies.reduce((s, p) => s + p.population, 0);
  const phMap = Object.fromEntries(pharmacies.map((p) => [p.id, p]));
  const candidates = [];

  for (const ph of pharmacies) {
    const phState = pharmacyStates.find((p) => p.id === ph.id);
    if (!phState) continue;
    for (const drug of drugs) {
      const onHand = phState.onHand[drug.id] || 0;
      const backlog = phState.backlog[drug.id] || 0;
      let orderQty = 0;

      if (canonical === 'fixed-allocation') {
        const target = Math.round((ph.population / totalPop) * 400 * (drug.priority === 'essential' ? 1.3 : 1));
        if (day % 3 === 0 && onHand + backlog < target) orderQty = target - onHand - backlog;
      } else if (canonical === 'reorder-point') {
        const { s, Q } = POLICIES['reorder-point'].params;
        if (onHand + backlog <= s) orderQty = Q;
      } else if (canonical === 'cost-first' || canonical === 'equity-aware') {
        const target = Math.max(0, 120 - onHand - backlog);
        orderQty = target;
      }

      if (orderQty <= 0) continue;

      const transport = transportCostPerUnit(ph, scenario);
      const procurement = drug.unitProcurementCost ?? 2;
      const holding = drug.holdingCostPerUnitDay ?? 0.02;
      const penalty = stockoutPenaltyPerUnit(drug, scenario);
      const pw = PRIORITY_WEIGHT[drug.priority] ?? 1;
      const expectedStockoutReduction = Math.min(orderQty, backlog + 30);
      const marginalCost = orderQty * (procurement + transport + holding * 3);

      let score;
      let selectedReason;
      const w = scenario.policyWeights?.equityAware ?? {
        stockout: 1,
        wait: 0.5,
        inequity: 1,
        cost: 0.01,
      };

      if (canonical === 'cost-first') {
        score = expectedStockoutReduction * penalty * pw - marginalCost;
        selectedReason = 'cost-first: max penalty reduction minus marginal cost';
      } else if (canonical === 'equity-aware') {
        const rtRate = regionalStockoutRate[ph.regionType] ?? 0;
        const maxRate = Math.max(...Object.values(regionalStockoutRate), 0.001);
        const inequitySignal = maxRate - rtRate;
        const waitProxy = (ph.vulnerabilityWeight ?? 1) * backlog;
        score = expectedStockoutReduction * pw * w.stockout
          + waitProxy * w.wait
          + inequitySignal * 100 * w.inequity
          - marginalCost * w.cost;
        selectedReason = 'equity-aware heuristic marginal score';
      } else {
        score = orderQty;
        selectedReason = `${canonical} rule`;
      }

      candidates.push({
        pharmacyId: ph.id,
        warehouseId: ph.warehouseId,
        drugId: drug.id,
        qty: orderQty,
        regionType: ph.regionType,
        priority: drug.priority,
        score,
        marginalCost,
        expectedStockoutReduction,
        selectedReason,
        policyId: canonical,
      });
    }
  }

  if (canonical === 'cost-first' || canonical === 'equity-aware') {
    candidates.sort((a, b) => b.score - a.score);
  }

  return candidates;
}

function decideReplenishment(ctx) {
  const candidates = buildCandidates(ctx);
  const decisions = [];
  const orders = [];

  for (const c of candidates) {
    const wh = ctx.warehouseStates.find((w) => w.id === c.warehouseId);
    const available = wh?.onHand[c.drugId] ?? 0;
    const requestQty = c.qty;
    const decision = {
      ...c,
      requestQty,
      warehouseAvailable: available,
      selected: requestQty > 0,
      qty: requestQty,
      notSelectedReason: requestQty <= 0 ? 'zero_request' : null,
    };
    decisions.push(decision);
    if (requestQty > 0) {
      orders.push({
        pharmacyId: c.pharmacyId,
        warehouseId: c.warehouseId,
        drugId: c.drugId,
        qty: requestQty,
        regionType: c.regionType,
        requestQty,
      });
    }
  }

  return { orders, decisions };
}

module.exports = {
  POLICIES,
  POLICY_ALIASES,
  resolvePolicyId,
  listPolicies,
  getPolicy,
  decideReplenishment,
  buildCandidates,
};
