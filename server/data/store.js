const fs = require('fs');
const path = require('path');
const { buildSeed } = require('./seed');
const { ensureDemoPatients, DEMO_PATIENT_COUNT } = require('./patientGenerator');
const { ensureDemoPrescriptions } = require('./prescriptionGenerator');
const { ensureCatalogData } = require('./herbCatalog');
const { ensureTraceabilityData, hydrateTraceability } = require('./traceabilityGenerator');

function storeDir() {
  return process.env.STORE_DIR || process.env.AI_DATA_DIR || path.join(__dirname, '../../data');
}

function storeFile() {
  return path.join(storeDir(), 'store.json');
}

const STORE_FILE = storeFile();

function ensureDir() {
  const dir = storeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(storeFile())) {
    const seed = buildSeed();
    fs.writeFileSync(storeFile(), JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    if ((data.meta?.version || 0) < 3) {
      const seed = buildSeed();
      fs.writeFileSync(storeFile(), JSON.stringify(seed, null, 2), 'utf8');
      return seed;
    }
    let migrated = false;
    if ((data.meta?.version || 0) < 4 && (data.patients?.length || 0) < DEMO_PATIENT_COUNT) {
      ensureDemoPatients(data, DEMO_PATIENT_COUNT);
      data.meta.version = 4;
      data.meta.demoPatients = DEMO_PATIENT_COUNT;
      migrated = true;
    }
    if ((data.meta?.version || 0) < 5 && (data.patients?.length || 0) > 0) {
      ensureDemoPrescriptions(data, 1);
      data.meta.version = 5;
      data.meta.demoPrescriptions = data.prescriptions?.length || 0;
      migrated = true;
    }
    if ((data.meta?.version || 0) < 6) {
      const catalog = ensureCatalogData(data);
      data.meta.version = 6;
      data.meta.catalogHerbs = catalog.herbTotal;
      data.meta.catalogTemplates = catalog.templateTotal;
      migrated = true;
    }
    if ((data.meta?.version || 0) < 7) {
      const trace = ensureTraceabilityData(data);
      data.meta.version = 7;
      data.meta.traceabilityRecords = trace.total;
      migrated = true;
    }
    hydrateTraceability(data);
    if (data.traceability?.byCode) {
      delete data.traceability.byCode;
      migrated = true;
    }
    if (migrated) save(data);
    return data;
  } catch {
    const seed = buildSeed();
    save(seed);
    return seed;
  }
}

function save(data) {
  ensureDir();
  data.meta = data.meta || {};
  data.meta.updatedAt = new Date().toISOString();
  if (data.traceability?.byCode) delete data.traceability.byCode;
  fs.writeFileSync(storeFile(), JSON.stringify(data, null, 2), 'utf8');
}

function nextId(data, key) {
  data.nextId = data.nextId || {};
  const id = (data.nextId[key] || 1);
  data.nextId[key] = id + 1;
  return id;
}

function getStore() {
  return load();
}

function updateStore(mutator) {
  const data = load();
  mutator(data);
  save(data);
  return data;
}

module.exports = { getStore, updateStore, nextId, save, load, STORE_FILE };
