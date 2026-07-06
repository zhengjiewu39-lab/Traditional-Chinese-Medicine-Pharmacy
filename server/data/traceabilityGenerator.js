/**
 * TCM traceability records synced with herb catalog / inventory.
 */

const crypto = require('crypto');
const { CATALOG_HERBS } = require('./herbCatalog');

const ORIGIN_MAP = {
  人参: '吉林省集安市', 当归: '甘肃省定西市', 黄芪: '内蒙古自治区', 川芎: '四川省都江堰市',
  白芍: '浙江省磐安县', 甘草: '内蒙古自治区', 熟地黄: '河南省武陟县', 生地黄: '河南武陟',
  丹参: '四川省中江县', 茯苓: '云南省楚雄州', 白术: '浙江省于潜镇', 陈皮: '广东新会',
  半夏: '四川省南充市', 桂枝: '广西桂林', 麻黄: '内蒙古赤峰', 附子: '四川江油',
  黄连: '四川洪雅', 黄芩: '河北安国', 金银花: '山东平邑', 连翘: '山西运城',
  三七: '云南文山', 天麻: '云南昭通', 枸杞子: '宁夏中宁', 山药: '河南焦作',
};

const OPERATORS = {
  采收: ['张农民', '李农民', '王农民', '赵农民'],
  初加工: ['李加工', '王加工', '陈加工'],
  质检: ['王质检', '张质检', '刘质检'],
  入库: ['赵仓管', '钱仓管', '孙仓管'],
  销售: ['钱店长', '孙店长', '周店长'],
};

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

function fakeHash(seed, idx) {
  return `0x${crypto.createHash('sha256').update(`${seed}-${idx}`).digest('hex').slice(0, 40)}`;
}

function traceCodeForHerb(herb) {
  return `TR-${herb.batchNo || `H${String(herb.id).padStart(4, '0')}`}`;
}

function legacyCodeForHerb(herb) {
  return `2026${String(herb.id).padStart(5, '0')}`;
}

function buildBlocks(herb, rng) {
  const origin = ORIGIN_MAP[herb.name] || `${herb.supplier || '道地产区'}`;
  const harvest = herb.expiryDate
    ? `${parseInt(herb.expiryDate.slice(0, 4), 10) - 2}-${herb.expiryDate.slice(5, 7)}-15`
    : '2025-06-15';
  const steps = [
    { operation: '采收', location: origin, offsetDays: 0, data: `${herb.name}采收，质量良好，批次 ${herb.batchNo}` },
    { operation: '初加工', location: origin, offsetDays: 2, data: `${herb.name}清洗、切制、干燥、包装` },
    { operation: '质检', location: origin.replace(/市|县|州/g, '') + '质检中心', offsetDays: 10, data: `${herb.name}农残/重金属/含量检测，合格` },
    { operation: '入库', location: '北京市丰台区主库', offsetDays: 25, data: `${herb.name}入库，库位 ${herb.category?.includes('丸') ? 'B' : 'A'}-${herb.id}` },
    { operation: '销售', location: '北京市海淀区终端药房', offsetDays: 45, data: `${herb.name}进入连锁药房可售库存` },
  ];

  const base = new Date(harvest);
  return steps.map((s, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + s.offsetDays);
    const ts = d.toISOString().replace('T', ' ').slice(0, 19);
    return {
      timestamp: ts,
      location: s.location,
      operation: s.operation,
      operator: pick(rng, OPERATORS[s.operation] || ['系统']),
      data: s.data,
      hash: fakeHash(herb.id, i),
    };
  });
}

function buildTraceRecord(herb) {
  const rng = mulberry32(herb.id * 9973);
  const traceCode = traceCodeForHerb(herb);
  const origin = ORIGIN_MAP[herb.name] || '道地药材基地';
  const harvestDate = herb.expiryDate
    ? `${parseInt(herb.expiryDate.slice(0, 4), 10) - 2}-06-15`
    : '2025-06-15';

  return {
    traceCode,
    legacyCode: legacyCodeForHerb(herb),
    herbId: herb.id,
    id: traceCode,
    name: herb.name,
    category: herb.category,
    pinyin: herb.pinyin,
    batchNumber: herb.batchNo,
    origin,
    producer: herb.supplier || '道地药材供应',
    harvestDate,
    expiryDate: herb.expiryDate,
    testingResults: '合格',
    commonDosage: herb.commonDosage,
    functions: herb.functions,
    contraindications: herb.contraindications,
    inventoryStock: herb.stock,
    unit: herb.unit,
    price: herb.price,
    image: null,
    blocks: buildBlocks(herb, rng),
    demoTag: 'catalog-sync',
  };
}

function generateTraceabilityCatalog(herbs = CATALOG_HERBS) {
  const records = herbs.map(buildTraceRecord);
  const byCode = {};
  records.forEach((r) => {
    byCode[r.traceCode] = r;
    byCode[r.legacyCode] = r;
    byCode[r.batchNumber] = r;
    byCode[String(r.herbId)] = r;
    byCode[r.name] = r;
  });
  return { records, byCode };
}

function rebuildByCode(records) {
  const byCode = {};
  records.forEach((r) => {
    byCode[r.traceCode] = r;
    byCode[r.legacyCode] = r;
    byCode[r.batchNumber] = r;
    byCode[String(r.herbId)] = r;
    byCode[r.name] = r;
  });
  return byCode;
}

function ensureTraceabilityData(store) {
  const herbs = store.herbs || CATALOG_HERBS;
  const { records } = generateTraceabilityCatalog(herbs);
  const existing = store.traceability?.records?.length || 0;
  store.traceability = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    records,
  };
  return {
    added: Math.max(0, records.length - existing),
    total: records.length,
    sampleCodes: records.slice(0, 5).map((r) => r.traceCode),
  };
}

function hydrateTraceability(store) {
  if (!store.traceability?.records?.length) return store;
  store.traceability.byCode = rebuildByCode(store.traceability.records);
  return store;
}

function lookupTraceability(store, query) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (!store.traceability?.byCode) hydrateTraceability(store);
  const map = store.traceability?.byCode || {};
  if (map[q]) return map[q];
  const lower = q.toLowerCase();
  const hit = (store.traceability?.records || []).find((r) =>
    r.traceCode.toLowerCase() === lower
    || r.legacyCode === q
    || r.batchNumber?.toLowerCase() === lower
    || r.name === q
    || r.pinyin?.toLowerCase() === lower
  );
  return hit || null;
}

module.exports = {
  generateTraceabilityCatalog,
  ensureTraceabilityData,
  lookupTraceability,
  hydrateTraceability,
  rebuildByCode,
  traceCodeForHerb,
};
