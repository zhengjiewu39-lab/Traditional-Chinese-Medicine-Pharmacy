/** 初始种子数据 — 对标连锁中药房全业务域 */

const { generateDemoPatients, DEMO_PATIENT_COUNT } = require('./patientGenerator');
const { generateDemoPrescriptions, syncPatientPrescriptionCounts } = require('./prescriptionGenerator');
const {
  CATALOG_HERBS,
  PRESCRIPTION_TEMPLATES,
  CATEGORIES,
  buildInventoryFromHerbs,
} = require('./herbCatalog');
const { generateTraceabilityCatalog } = require('./traceabilityGenerator');

function buildSeed() {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  const corePatients = [
    { id: 1, customerId: 1, name: '张三', gender: '男', age: 45, phone: '13812345678', address: '北京市朝阳区建国路88号', medicalHistory: ['高血压', '2型糖尿病'], allergies: ['青霉素'], recentVisits: fmt(now), prescriptionCount: 8, idCard: '110***1234' },
    { id: 2, customerId: 2, name: '李四', gender: '女', age: 32, phone: '13987654321', address: '北京市海淀区中关村大街1号', medicalHistory: ['过敏性鼻炎'], allergies: [], recentVisits: '2025-06-20', prescriptionCount: 3, idCard: '110***5678' },
    { id: 3, customerId: 3, name: '王五', gender: '男', age: 68, phone: '13612345678', address: '北京市西城区西长安街3号', medicalHistory: ['冠心病', '高血脂', '骨质疏松'], allergies: ['磺胺'], recentVisits: '2025-06-18', prescriptionCount: 12, idCard: '110***9012' },
  ];

  const coreCustomers = [
    { id: 1, name: '张三', gender: '男', age: 45, phone: '13812345678', address: '北京市朝阳区建国路88号', lastVisit: fmt(now), visits: 12, spending: 3560, memberLevel: '金卡', points: 1280, patientId: 1 },
    { id: 2, name: '李四', gender: '女', age: 32, phone: '13987654321', address: '北京市海淀区中关村大街1号', lastVisit: '2025-06-20', visits: 5, spending: 780, memberLevel: '银卡', points: 420, patientId: 2 },
    { id: 3, name: '王五', gender: '男', age: 65, phone: '13612345678', address: '北京市西城区西长安街3号', lastVisit: '2025-06-18', visits: 20, spending: 8200, memberLevel: '钻石', points: 5600, patientId: 3 },
    { id: 4, name: '赵六', gender: '女', age: 28, phone: '13712345678', address: '北京市丰台区南四环', lastVisit: '2025-06-01', visits: 2, spending: 350, memberLevel: '普通', points: 80 },
  ];

  const { patients, customers: synthCustomers, nextPatientId, nextCustomerId } = generateDemoPatients(
    DEMO_PATIENT_COUNT,
    { preserveExisting: corePatients, startCustomerId: 5, seed: 20260706 }
  );

  const { prescriptions, nextPrescriptionId } = generateDemoPrescriptions(patients, {
    startId: 1,
    perPatient: 1,
    seed: 20260707,
  });
  syncPatientPrescriptionCounts(patients, prescriptions);

  const { records: traceRecords } = generateTraceabilityCatalog(CATALOG_HERBS);

  return {
    meta: {
      version: 7,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      demoPatients: DEMO_PATIENT_COUNT,
      demoPrescriptions: prescriptions.length,
      catalogHerbs: CATALOG_HERBS.length,
      catalogTemplates: PRESCRIPTION_TEMPLATES.length,
      traceabilityRecords: traceRecords.length,
    },
    herbs: CATALOG_HERBS,
    inventory: buildInventoryFromHerbs(CATALOG_HERBS),
    customers: [...coreCustomers, ...synthCustomers],
    patients,
    orders: [
      { id: 1, orderNo: 'ORD20250626001', customerId: 1, customerName: '张三', items: [{ herbId: 4, name: '六味地黄丸', quantity: 2, price: 35.5, unit: '瓶' }, { herbId: 2, name: '当归', quantity: 100, price: 50, unit: '克' }], subtotal: 571, discount: 0, total: 571, status: '已完成', paymentMethod: '微信支付', date: fmt(now), shippingAddress: '北京市朝阳区建国路88号', source: '收银台' },
      { id: 2, orderNo: 'ORD20250625002', customerId: 2, customerName: '李四', items: [{ herbId: 5, name: '板蓝根颗粒', quantity: 3, price: 15.6, unit: '盒' }], subtotal: 46.8, discount: 0, total: 46.8, status: '处理中', paymentMethod: '支付宝', date: '2025-06-25', shippingAddress: '北京市海淀区中关村大街1号', source: '线上' },
      { id: 3, orderNo: 'ORD20250624003', customerId: 3, customerName: '王五', items: [{ herbId: 1, name: '人参', quantity: 30, price: 120, unit: '克' }, { herbId: 3, name: '黄芪', quantity: 60, price: 30, unit: '克' }], subtotal: 5400, discount: 200, total: 5200, status: '待付款', paymentMethod: '银联', date: '2025-06-24', shippingAddress: '北京市西城区西长安街3号', source: '处方取药' },
    ],
    prescriptions,
    prescriptionTemplates: PRESCRIPTION_TEMPLATES,
    traceability: {
      version: '1.0.0',
      updatedAt: now.toISOString(),
      records: traceRecords,
    },
    bills: [
      { id: 1, billNo: 'BILL20250626001', orderId: 1, customerId: 1, customerName: '张三', amount: 571, paymentMethod: '微信支付', status: '已支付', cashier: '管理员', createdAt: now.toISOString(), items: [{ name: '六味地黄丸', quantity: 2, price: 35.5 }] },
    ],
    inventoryHistory: [],
    categories: CATEGORIES,
    sales: {
      trends: [
        { month: '一月', sales: 52000 }, { month: '二月', sales: 62000 },
        { month: '三月', sales: 78000 }, { month: '四月', sales: 85000 },
        { month: '五月', sales: 91000 }, { month: '六月', sales: 105000 },
      ],
    },
    nextId: {
      inventory: CATALOG_HERBS.length + 1,
      customer: nextCustomerId,
      patient: nextPatientId,
      order: 4,
      prescription: nextPrescriptionId,
      bill: 2,
      template: PRESCRIPTION_TEMPLATES.length + 1,
      herb: CATALOG_HERBS.length + 1,
    },
  };
}

module.exports = { buildSeed, CATALOG_HERBS };
