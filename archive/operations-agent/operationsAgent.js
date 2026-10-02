/**
 * Operations agent (autonomy A1): reads inventory and prescription demand, drafts proposals.
 * It has no write access to inventory; an approved proposal only creates a draft purchase or
 * transfer document for staff to execute through the normal inventory workflow.
 */
const { getStore } = require('../data/store');
const { randomId } = require('../common/hash');

const NEAR_EXPIRY_DAYS = 90;
const TREND_WINDOW_DAYS = 30;
const ESSENTIAL_CATEGORIES = new Set(['补气药', '补血药', '清热药', '解表药']);

function daysUntil(date, now) {
  return Math.floor((Date.parse(date) - now.getTime()) / 86400000);
}

/** Per-herb dispensing counts in the last window vs the window before, from the synthetic prescription store. */
function demandTrend(store, now) {
  const end = now.getTime();
  const recent = new Map();
  const prior = new Map();
  for (const p of store.prescriptions || []) {
    const t = Date.parse(p.date);
    if (Number.isNaN(t)) continue;
    const ageDays = (end - t) / 86400000;
    const bucket = ageDays >= 0 && ageDays < TREND_WINDOW_DAYS ? recent : ageDays >= TREND_WINDOW_DAYS && ageDays < 2 * TREND_WINDOW_DAYS ? prior : null;
    if (!bucket) continue;
    for (const h of p.herbs || []) bucket.set(h.name, (bucket.get(h.name) || 0) + 1);
  }
  return { recent, prior };
}

function analyzeOperations({ now = new Date() } = {}) {
  const store = getStore();
  let refDate = now;
  const latestRx = (store.prescriptions || []).map((p) => Date.parse(p.date)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (latestRx && latestRx < now.getTime() - TREND_WINDOW_DAYS * 86400000) refDate = new Date(latestRx);
  const { recent, prior } = demandTrend(store, refDate);
  const items = (store.inventory || []).map((i) => {
    const r = recent.get(i.name) || 0;
    const q = prior.get(i.name) || 0;
    const expiresIn = i.expiryDate ? daysUntil(i.expiryDate, now) : null;
    return {
      inventoryId: i.id,
      name: i.name,
      category: i.category,
      supplier: i.supplier,
      stock: i.stock,
      minStock: i.minStock,
      unit: i.unit,
      location: i.location,
      expiryDate: i.expiryDate,
      expiresInDays: expiresIn,
      lowStock: i.stock < i.minStock,
      nearMin: i.stock < i.minStock * 1.5,
      nearExpiry: expiresIn != null && expiresIn <= NEAR_EXPIRY_DAYS,
      demandRecent: r,
      demandPrior: q,
      demandGrowth: q ? (r - q) / q : (r ? 1 : 0),
      essential: ESSENTIAL_CATEGORIES.has(i.category),
    };
  });
  const bySupplier = new Map();
  for (const it of items) {
    const s = bySupplier.get(it.supplier) || { supplier: it.supplier, items: 0, atRisk: 0 };
    s.items += 1;
    if (it.nearMin) s.atRisk += 1;
    bySupplier.set(it.supplier, s);
  }
  const shortageRisk = items
    .filter((it) => it.lowStock || (it.nearMin && it.demandGrowth > 0.2))
    .sort((a, b) => Number(b.essential) - Number(a.essential) || a.stock / a.minStock - b.stock / b.minStock);
  return {
    generatedAt: now.toISOString(),
    trendReferenceDate: refDate.toISOString().slice(0, 10),
    label: '合成演示数据，不代表真实药房；AI生成的运营建议需药师或管理员确认',
    summary: {
      skuCount: items.length,
      lowStock: items.filter((i) => i.lowStock).length,
      nearMin: items.filter((i) => i.nearMin).length,
      nearExpiry: items.filter((i) => i.nearExpiry).length,
      risingDemand: items.filter((i) => i.demandGrowth > 0.2 && i.demandRecent >= 3).length,
      essentialAtRisk: shortageRisk.filter((i) => i.essential).length,
    },
    shortageRisk: shortageRisk.slice(0, 20),
    nearExpiry: items.filter((i) => i.nearExpiry).sort((a, b) => a.expiresInDays - b.expiresInDays).slice(0, 20),
    risingDemand: items.filter((i) => i.demandGrowth > 0.2 && i.demandRecent >= 3).sort((a, b) => b.demandGrowth - a.demandGrowth).slice(0, 20),
    supplierConcentration: [...bySupplier.values()].sort((a, b) => b.atRisk - a.atRisk || b.items - a.items).slice(0, 10),
  };
}

const ACTIONS = ['purchase', 'transfer', 'expedite', 'hold'];

/**
 * Draft a proposal. `action` and `inventoryIds` come from staff input or from the analysis;
 * quantities are computed deterministically (top up to 2× minStock).
 */
function draftProposal({ action, inventoryIds, note }, analysis = analyzeOperations()) {
  if (!ACTIONS.includes(action)) throw new Error(`action must be one of ${ACTIONS.join(', ')}`);
  const store = getStore();
  const inv = new Map((store.inventory || []).map((i) => [i.id, i]));
  const chosen = (inventoryIds?.length ? inventoryIds : analysis.shortageRisk.map((i) => i.inventoryId)).slice(0, 20);
  const items = chosen.map((id) => inv.get(id)).filter(Boolean).map((i) => ({
    inventoryId: i.id,
    name: i.name,
    currentStock: i.stock,
    minStock: i.minStock,
    unit: i.unit,
    supplier: i.supplier,
    quantity: action === 'hold' ? 0 : Math.max(0, i.minStock * 2 - i.stock),
  }));
  const reasons = {
    purchase: '库存低于或接近最低库存且需求上升，建议补货',
    transfer: '部分库位库存不足，建议在库位间调拨',
    expedite: '在途/待到货品种供应紧张，建议催办供应商',
    hold: '需求平稳或临近效期，建议暂缓采购以免积压',
  };
  return {
    proposalId: randomId('prop'),
    action,
    items,
    reason: note ? `${reasons[action]}；${note}` : reasons[action],
    expectedBenefit: action === 'hold' ? '减少近效期积压（合成估计）' : '降低缺药风险（以数字孪生合成情景评估为准）',
    risk: action === 'purchase' ? '可能增加资金占用与近效期风险' : action === 'hold' ? '需求突增时可能缺药' : '执行成本与时效不确定',
    digitalTwinEvaluation: null,
    requiresApproval: true,
    status: 'draft',
    createdAt: new Date().toISOString(),
    synthetic: true,
    label: 'AI生成，需药师或管理员确认；不会自动修改库存',
  };
}

module.exports = { analyzeOperations, draftProposal, ACTIONS };
