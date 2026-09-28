const fs = require('fs');
const path = require('path');

function aiDataDir() {
  return process.env.AI_DATA_DIR || path.join(__dirname, '../../data/ai');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Small file-backed JSON document with atomic replace-on-write. */
function createJsonFileStore(fileName, initial) {
  let cache = null;
  let cachedFor = null;
  const filePath = () => path.join(aiDataDir(), fileName);

  function read() {
    const p = filePath();
    if (cache && cachedFor === p) return cache;
    ensureDir(path.dirname(p));
    cache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : structuredClone(initial);
    cachedFor = p;
    return cache;
  }

  function write(data) {
    const p = filePath();
    ensureDir(path.dirname(p));
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, p);
    cache = data;
    cachedFor = p;
  }

  function update(mutator) {
    const data = read();
    const result = mutator(data);
    write(data);
    return result;
  }

  function reset() {
    cache = null;
    cachedFor = null;
  }

  return { read, write, update, reset, filePath };
}

module.exports = { createJsonFileStore, aiDataDir, ensureDir };
