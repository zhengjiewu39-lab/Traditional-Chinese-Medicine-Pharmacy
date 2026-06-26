const fs = require('fs');
const path = require('path');
const { buildSeed } = require('./seed');

const DATA_DIR = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) {
    const seed = buildSeed();
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if ((data.meta?.version || 0) < 3) {
      const seed = buildSeed();
      fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf8');
      return seed;
    }
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
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
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
