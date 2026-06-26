/** 初始种子数据 — 对标连锁中药房全业务域 */

const HERBS = [
  { id: 1, name: '人参', pinyin: 'renshen', category: '补气药', nature: '甘微苦温', meridians: '脾、肺经', commonDosage: '3-9g', price: 120, unit: '克', functions: '大补元气，复脉固脱', contraindications: '实证、热病初起慎用', stock: 50, minStock: 30, supplier: '吉林参厂', expiryDate: '2026-12-31', batchNo: 'RS202501' },
  { id: 2, name: '当归', pinyin: 'danggui', category: '补血药', nature: '甘温', meridians: '肝、心、脾经', commonDosage: '6-15g', price: 50, unit: '克', functions: '补血活血，调经止痛', contraindications: '湿盛中满及大便溏泄者慎用', stock: 150, minStock: 50, supplier: '甘肃岷县', expiryDate: '2026-10-31', batchNo: 'DG202502' },
  { id: 3, name: '黄芪', pinyin: 'huangqi', category: '补气药', nature: '甘温', meridians: '肺、脾经', commonDosage: '10-30g', price: 30, unit: '克', functions: '补气升阳，益卫固表', contraindications: '表实邪盛者慎用', stock: 200, minStock: 80, supplier: '内蒙古', expiryDate: '2026-11-30', batchNo: 'HQ202503' },
  { id: 4, name: '六味地黄丸', pinyin: 'liuweidihuang', category: '丸剂', nature: '—', meridians: '—', commonDosage: '8丸/次', price: 35.5, unit: '瓶', functions: '滋阴补肾', contraindications: '脾虚便溏者慎用', stock: 1200, minStock: 500, supplier: '同仁堂', expiryDate: '2027-06-30', batchNo: 'LWD202504' },
  { id: 5, name: '板蓝根颗粒', pinyin: 'banlangen', category: '颗粒剂', nature: '—', meridians: '—', commonDosage: '1袋/次', price: 15.6, unit: '盒', functions: '清热解毒，凉血利咽', contraindications: '脾胃虚寒者慎用', stock: 2000, minStock: 800, supplier: '一方制药', expiryDate: '2027-03-31', batchNo: 'BLG202505' },
  { id: 6, name: '藿香正气水', pinyin: 'huoxiangzhengqi', category: '合剂', nature: '—', meridians: '—', commonDosage: '10ml/次', price: 22.8, unit: '瓶', functions: '解表化湿，理气和中', contraindications: '酒精过敏者禁用', stock: 35, minStock: 400, supplier: '广州白云山', expiryDate: '2026-08-31', batchNo: 'HXZ202506' },
  { id: 7, name: '复方丹参片', pinyin: 'fufangdanshen', category: '片剂', nature: '—', meridians: '—', commonDosage: '3片/次', price: 32.5, unit: '盒', functions: '活血化瘀，理气止痛', contraindications: '孕妇慎用', stock: 1500, minStock: 600, supplier: '天士力', expiryDate: '2027-01-31', batchNo: 'FFDS202507' },
  { id: 8, name: '川芎', pinyin: 'chuanxiong', category: '活血化瘀', nature: '辛温', meridians: '肝、胆、心包经', commonDosage: '3-9g', price: 45, unit: '克', functions: '活血行气，祛风止痛', contraindications: '孕妇慎用', stock: 90, minStock: 40, supplier: '四川都江堰', expiryDate: '2026-09-30', batchNo: 'CX202508' },
  { id: 9, name: '白芍', pinyin: 'baishao', category: '补血药', nature: '苦酸微寒', meridians: '肝、脾经', commonDosage: '6-15g', price: 38, unit: '克', functions: '养血敛阴，柔肝止痛', contraindications: '脾胃虚寒者慎用', stock: 120, minStock: 50, supplier: '浙江磐安', expiryDate: '2026-12-31', batchNo: 'BS202509' },
  { id: 10, name: '甘草', pinyin: 'gancao', category: '补气药', nature: '甘平', meridians: '心、肺、脾、胃经', commonDosage: '3-10g', price: 18, unit: '克', functions: '益气补中，调和诸药', contraindications: '水肿、高血压者慎用', stock: 300, minStock: 100, supplier: '内蒙古', expiryDate: '2027-02-28', batchNo: 'GC202510' },
];

function buildSeed() {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  return {
    meta: { version: 3, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    herbs: HERBS,
    inventory: HERBS.map(h => ({
      id: h.id, name: h.name, category: h.category, stock: h.stock, unit: h.unit,
      price: h.price, minStock: h.minStock, supplier: h.supplier,
      expiryDate: h.expiryDate, batchNo: h.batchNo, location: '主库-A区',
    })),
    customers: [
      { id: 1, name: '张三', gender: '男', age: 45, phone: '13812345678', address: '北京市朝阳区建国路88号', lastVisit: fmt(now), visits: 12, spending: 3560, memberLevel: '金卡', points: 1280 },
      { id: 2, name: '李四', gender: '女', age: 32, phone: '13987654321', address: '北京市海淀区中关村大街1号', lastVisit: '2025-06-20', visits: 5, spending: 780, memberLevel: '银卡', points: 420 },
      { id: 3, name: '王五', gender: '男', age: 65, phone: '13612345678', address: '北京市西城区西长安街3号', lastVisit: '2025-06-18', visits: 20, spending: 8200, memberLevel: '钻石', points: 5600 },
      { id: 4, name: '赵六', gender: '女', age: 28, phone: '13712345678', address: '北京市丰台区南四环', lastVisit: '2025-06-01', visits: 2, spending: 350, memberLevel: '普通', points: 80 },
    ],
    patients: [
      { id: 1, customerId: 1, name: '张三', gender: '男', age: 45, phone: '13812345678', address: '北京市朝阳区建国路88号', medicalHistory: ['高血压', '2型糖尿病'], allergies: ['青霉素'], recentVisits: fmt(now), prescriptionCount: 8, idCard: '110***1234' },
      { id: 2, customerId: 2, name: '李四', gender: '女', age: 32, phone: '13987654321', address: '北京市海淀区中关村大街1号', medicalHistory: ['过敏性鼻炎'], allergies: [], recentVisits: '2025-06-20', prescriptionCount: 3, idCard: '110***5678' },
      { id: 3, customerId: 3, name: '王五', gender: '男', age: 68, phone: '13612345678', address: '北京市西城区西长安街3号', medicalHistory: ['冠心病', '高血脂', '骨质疏松'], allergies: ['磺胺'], recentVisits: '2025-06-18', prescriptionCount: 12, idCard: '110***9012' },
    ],
    orders: [
      { id: 1, orderNo: 'ORD20250626001', customerId: 1, customerName: '张三', items: [{ herbId: 4, name: '六味地黄丸', quantity: 2, price: 35.5, unit: '瓶' }, { herbId: 2, name: '当归', quantity: 100, price: 50, unit: '克' }], subtotal: 571, discount: 0, total: 571, status: '已完成', paymentMethod: '微信支付', date: fmt(now), shippingAddress: '北京市朝阳区建国路88号', source: '收银台' },
      { id: 2, orderNo: 'ORD20250625002', customerId: 2, customerName: '李四', items: [{ herbId: 5, name: '板蓝根颗粒', quantity: 3, price: 15.6, unit: '盒' }], subtotal: 46.8, discount: 0, total: 46.8, status: '处理中', paymentMethod: '支付宝', date: '2025-06-25', shippingAddress: '北京市海淀区中关村大街1号', source: '线上' },
      { id: 3, orderNo: 'ORD20250624003', customerId: 3, customerName: '王五', items: [{ herbId: 1, name: '人参', quantity: 30, price: 120, unit: '克' }, { herbId: 3, name: '黄芪', quantity: 60, price: 30, unit: '克' }], subtotal: 5400, discount: 200, total: 5200, status: '待付款', paymentMethod: '银联', date: '2025-06-24', shippingAddress: '北京市西城区西长安街3号', source: '处方取药' },
    ],
    prescriptions: [
      { id: 1, patientId: 1, patientName: '张三', doctor: '赵医生', diagnosis: '气血两虚', date: fmt(now), herbs: [{ name: '黄芪', dosage: '15g' }, { name: '当归', dosage: '10g' }, { name: '白芍', dosage: '10g' }, { name: '川芎', dosage: '6g' }], status: '待取药', pickupCode: 'TCM128456', reviewer: '李药师', reviewScore: 92, warnings: [], timeline: [{ status: '待取药', at: now.toISOString(), actor: '李药师', note: '审方通过' }] },
      { id: 2, patientId: 2, patientName: '李四', doctor: '李医生', diagnosis: '风热感冒', date: '2025-06-20', herbs: [{ name: '板蓝根颗粒', dosage: '2盒' }], status: '待取药', pickupCode: 'TCM339812', reviewer: '王药师', reviewScore: 88, warnings: [], timeline: [] },
      { id: 3, patientId: 3, patientName: '王五', doctor: '张医生', diagnosis: '胸痹心痛', date: '2025-06-18', herbs: [{ name: '复方丹参片', dosage: '3盒' }, { name: '黄芪', dosage: '20g' }], status: '待审核', reviewer: null, reviewScore: null, warnings: ['三七剂量偏高，建议复核'], timeline: [] },
    ],
    prescriptionTemplates: [
      { id: 1, name: '四君子汤', category: '补气', indication: '脾胃气虚', herbs: ['人参', '白术', '茯苓', '甘草'], usage: '水煎服，日1剂', popularity: 95 },
      { id: 2, name: '四物汤', category: '补血', indication: '营血虚滞', herbs: ['当归', '川芎', '白芍', '熟地黄'], usage: '水煎服，日1剂', popularity: 88 },
      { id: 3, name: '银翘散', category: '解表', indication: '风热感冒', herbs: ['金银花', '连翘', '薄荷', '荆芥', '桔梗', '甘草'], usage: '水煎服，日1剂', popularity: 92 },
    ],
    bills: [
      { id: 1, billNo: 'BILL20250626001', orderId: 1, customerId: 1, customerName: '张三', amount: 571, paymentMethod: '微信支付', status: '已支付', cashier: '管理员', createdAt: now.toISOString(), items: [{ name: '六味地黄丸', quantity: 2, price: 35.5 }] },
    ],
    inventoryHistory: [],
    categories: [
      { id: 1, name: '丸剂', count: 15, popularity: '高' },
      { id: 2, name: '合剂', count: 8, popularity: '中' },
      { id: 3, name: '中药材', count: 50, popularity: '高' },
      { id: 4, name: '颗粒剂', count: 12, popularity: '高' },
      { id: 5, name: '片剂', count: 20, popularity: '中' },
    ],
    sales: {
      trends: [
        { month: '一月', sales: 52000 }, { month: '二月', sales: 62000 },
        { month: '三月', sales: 78000 }, { month: '四月', sales: 85000 },
        { month: '五月', sales: 91000 }, { month: '六月', sales: 105000 },
      ],
    },
    nextId: { inventory: 11, customer: 5, patient: 4, order: 4, prescription: 4, bill: 2, template: 4, herb: 11 },
  };
}

module.exports = { buildSeed, HERBS };
