const path = require('path');
const { getDataMode } = require('../config/dataMode');

function aiDataDir() {
  if (process.env.AI_DATA_DIR) return process.env.AI_DATA_DIR;
  const mode = getDataMode();
  return path.join(__dirname, '../../data/ai', mode);
}

module.exports = { aiDataDir };
