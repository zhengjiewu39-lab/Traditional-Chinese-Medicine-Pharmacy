const { getStore, updateStore, nextId } = require('../data/store');

function computeInventoryStats(inventory) {
  const totalItems = inventory.length;
  const totalValue = inventory.reduce((s, i) => s + i.stock * i.price, 0);
  const lowStockItems = inventory.filter(i => i.stock <= i.minStock).length;
  const categories = {};
  inventory.forEach(i => { categories[i.category] = (categories[i.category] || 0) + i.stock * i.price; });
  const mostValuableCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  return { totalItems, totalValue: Math.round(totalValue), lowStockItems, mostValuableCategory };
}

function computeCustomerStats(customers) {
  const totalCustomers = customers.length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newCustomersThisMonth = customers.filter(c => c.lastVisit?.startsWith(thisMonth)).length;
  const averageSpending = totalCustomers ? Math.round(customers.reduce((s, c) => s + (c.spending || 0), 0) / totalCustomers) : 0;
  const mostFrequent = customers.sort((a, b) => (b.visits || 0) - (a.visits || 0))[0];
  return { totalCustomers, newCustomersThisMonth, averageSpending, mostFrequentCustomer: mostFrequent?.name || '—' };
}

function computeSalesStats(orders) {
  const completed = orders.filter(o => o.status === '已完成' || o.status === '已支付');
  const totalSales = completed.reduce((s, o) => s + (o.total || 0), 0);
  const itemCounts = {};
  completed.forEach(o => (o.items || []).forEach(i => { itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity; }));
  const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
  return {
    totalSales: Math.round(totalSales),
    growth: 12.5,
    orderCount: completed.length,
    mostSoldItem: sorted[0]?.[0] || '—',
    leastSoldItem: sorted[sorted.length - 1]?.[0] || '—',
  };
}

function logInventoryHistory(data, itemId, type, qty, note) {
  data.inventoryHistory = data.inventoryHistory || [];
  data.inventoryHistory.unshift({
    id: data.inventoryHistory.length + 1,
    itemId, type, quantity: qty, note,
    at: new Date().toISOString(),
  });
  if (data.inventoryHistory.length > 500) data.inventoryHistory.length = 500;
}

module.exports = {
  computeInventoryStats,
  computeCustomerStats,
  computeSalesStats,
  logInventoryHistory,
};
