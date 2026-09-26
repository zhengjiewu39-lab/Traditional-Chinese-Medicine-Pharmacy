const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function getGitCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getPackageLockHash() {
  const lockPath = path.join(__dirname, '../../package-lock.json');
  try {
    const buf = fs.readFileSync(lockPath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return 'unknown';
  }
}

module.exports = { getGitCommitHash, getPackageLockHash };
