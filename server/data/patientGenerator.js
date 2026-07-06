/**
 * Synthetic demo patients for HAR-CDSS / pharmacy workflow testing.
 * All data is fictional — no real PHI.
 */

const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高',
  '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕', '苏', '卢', '蒋', '蔡', '贾',
  '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
];

const GIVEN_MALE = [
  '伟', '强', '磊', '洋', '勇', '军', '杰', '涛', '明', '超', '鹏', '辉', '刚', '平', '华',
  '建国', '志强', '文博', '浩然', '子轩', '俊杰', '天宇', '嘉豪', '宇航', '晨阳',
];

const GIVEN_FEMALE = [
  '芳', '娜', '敏', '静', '丽', '艳', '娟', '秀英', '桂英', '玉兰', '雪梅', '慧', '琳',
  '婷婷', '欣怡', '雨萱', '思涵', '佳琪', '梦瑶', '诗涵', '雅婷', '晓彤', '佳慧', '婉清',
];

const CITIES = [
  { city: '北京', districts: ['朝阳区', '海淀区', '西城区', '东城区', '丰台区', '通州区'] },
  { city: '上海', districts: ['浦东新区', '徐汇区', '静安区', '黄浦区', '杨浦区', '闵行区'] },
  { city: '广州', districts: ['天河区', '越秀区', '海珠区', '荔湾区', '白云区', '番禺区'] },
  { city: '深圳', districts: ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区', '龙华区'] },
  { city: '成都', districts: ['武侯区', '锦江区', '青羊区', '金牛区', '成华区', '高新区'] },
  { city: '杭州', districts: ['西湖区', '上城区', '拱墅区', '滨江区', '余杭区', '萧山区'] },
  { city: '武汉', districts: ['武昌区', '江汉区', '洪山区', '汉阳区', '硚口区', '青山区'] },
  { city: '南京', districts: ['鼓楼区', '玄武区', '秦淮区', '建邺区', '栖霞区', '雨花台区'] },
];

const STREETS = [
  '人民路', '解放路', '中山路', '建设路', '文化路', '和平路', '新华路', '长安街', '康复路', '健康路',
  '友谊大道', '学府路', '科技路', '花园路', '滨河路', '东风路', '西湖路', '朝阳路', '金陵路', '长江路',
];

const MEDICAL_HISTORIES = [
  '高血压', '2型糖尿病', '冠心病', '高血脂', '失眠', '慢性胃炎', '过敏性鼻炎', '骨质疏松',
  '颈椎病', '腰腿痛', '月经不调', '更年期综合征', '哮喘', '慢性肝炎', '痛风', '便秘',
  '心悸', '眩晕', '慢性咳嗽', '脾胃虚弱', '气血不足', '肝郁气滞', '肾阳虚', '阴虚火旺',
];

const ALLERGIES_POOL = [
  [], [], [], ['青霉素'], ['磺胺'], ['阿司匹林'], ['海鲜'], ['花粉'], ['芒果'],
  ['青霉素', '海鲜'], ['磺胺', '花粉'], ['头孢类抗生素'],
];

const MEMBER_LEVELS = ['普通', '银卡', '金卡', '钻石'];

const DIAGNOSES = [
  '气血两虚', '风热感冒', '脾胃虚寒', '肝郁气滞', '失眠多梦', '头痛眩晕',
  '咳嗽痰多', '月经不调', '腰膝酸软', '水肿', '胸痹心痛', '消化不良',
];

function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randomPhone(rng, used) {
  const prefixes = ['138', '139', '150', '151', '152', '156', '158', '186', '187', '188', '189'];
  let phone;
  do {
    phone = pick(rng, prefixes) + String(Math.floor(10000000 + rng() * 89999999));
  } while (used.has(phone));
  used.add(phone);
  return phone;
}

function randomName(rng, gender) {
  const surname = pick(rng, SURNAMES);
  const given = pick(rng, gender === '女' ? GIVEN_FEMALE : GIVEN_MALE);
  return surname + given;
}

function randomAddress(rng) {
  const loc = pick(rng, CITIES);
  const district = pick(rng, loc.districts);
  const street = pick(rng, STREETS);
  const no = 1 + Math.floor(rng() * 200);
  return `${loc.city}市${district}${street}${no}号`;
}

function randomAge(rng) {
  const bucket = rng();
  if (bucket < 0.08) return 3 + Math.floor(rng() * 10);
  if (bucket < 0.15) return 13 + Math.floor(rng() * 18);
  if (bucket < 0.55) return 31 + Math.floor(rng() * 29);
  if (bucket < 0.85) return 60 + Math.floor(rng() * 15);
  return 75 + Math.floor(rng() * 20);
}

function randomDateInPastYear(rng) {
  const daysAgo = Math.floor(rng() * 365);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function randomMedicalHistory(rng) {
  const n = rng() < 0.15 ? 0 : 1 + Math.floor(rng() * 3);
  const items = [];
  while (items.length < n) {
    const h = pick(rng, MEDICAL_HISTORIES);
    if (!items.includes(h)) items.push(h);
  }
  return items;
}

function maskIdCard(rng) {
  const prefix = ['110', '310', '440', '330', '510', '420', '320'][Math.floor(rng() * 7)];
  return `${prefix}***${String(Math.floor(1000 + rng() * 8999))}`;
}

function generateDemoPatients(count, options = {}) {
  const {
    startCustomerId = 1,
    seed = 20260706,
    preserveExisting = [],
  } = options;

  const rng = mulberry32(seed);
  const usedPhones = new Set(preserveExisting.map((p) => p.phone).filter(Boolean));
  const usedNames = new Set(preserveExisting.map((p) => p.name).filter(Boolean));

  const patients = [...preserveExisting];
  const customers = [];
  let patientId = preserveExisting.length
    ? Math.max(...preserveExisting.map((p) => p.id)) + 1
    : 1;
  let customerId = startCustomerId;

  const toGenerate = Math.max(0, count - preserveExisting.length);

  for (let i = 0; i < toGenerate; i++) {
    const gender = rng() > 0.48 ? '男' : '女';
    let name;
    do { name = randomName(rng, gender); } while (usedNames.has(name));
    usedNames.add(name);

    const age = randomAge(rng);
    const phone = randomPhone(rng, usedPhones);
    const address = randomAddress(rng);
    const recentVisits = randomDateInPastYear(rng);
    const prescriptionCount = Math.floor(rng() * 16);
    const medicalHistory = randomMedicalHistory(rng);
    const allergies = pick(rng, ALLERGIES_POOL);

    const customer = {
      id: customerId,
      name,
      gender,
      age,
      phone,
      address,
      lastVisit: recentVisits,
      visits: prescriptionCount + Math.floor(rng() * 5),
      spending: Math.round((200 + rng() * 8000) * 10) / 10,
      memberLevel: pick(rng, MEMBER_LEVELS),
      points: Math.floor(rng() * 6000),
      patientId,
    };
    customers.push(customer);

    patients.push({
      id: patientId,
      customerId,
      name,
      gender,
      age,
      phone,
      address,
      medicalHistory,
      allergies: [...allergies],
      recentVisits,
      prescriptionCount,
      idCard: maskIdCard(rng),
      demoTag: 'synthetic',
      primaryDiagnosis: pick(rng, DIAGNOSES),
    });

    patientId += 1;
    customerId += 1;
  }

  return {
    patients,
    customers,
    nextPatientId: patientId,
    nextCustomerId: customerId,
  };
}

function ensureDemoPatients(store, targetCount = 500) {
  const existing = store.patients || [];
  if (existing.length >= targetCount) {
    return { added: 0, total: existing.length, patients: existing };
  }

  const maxCustomerId = (store.customers || []).reduce((m, c) => Math.max(m, c.id), 0);
  const { patients, customers, nextPatientId, nextCustomerId } = generateDemoPatients(
    targetCount,
    {
      preserveExisting: existing,
      startCustomerId: maxCustomerId + 1,
    }
  );

  store.patients = patients;
  store.customers = store.customers || [];
  const existingCustomerIds = new Set(store.customers.map((c) => c.id));
  customers.forEach((c) => {
    if (!existingCustomerIds.has(c.id)) store.customers.push(c);
  });

  store.nextId = store.nextId || {};
  store.nextId.patient = Math.max(store.nextId.patient || 1, nextPatientId);
  store.nextId.customer = Math.max(store.nextId.customer || 1, nextCustomerId);

  return {
    added: patients.length - existing.length,
    total: patients.length,
    patients,
  };
}

module.exports = {
  generateDemoPatients,
  ensureDemoPatients,
  DEMO_PATIENT_COUNT: 500,
};
