const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const COMMIT_RE = /^[0-9a-f]{7,64}$/i;

/**
 * Source revision of the running code: SOURCE_COMMIT (for builds without a .git directory, e.g.
 * release tarballs or containers), then `git rev-parse HEAD`, else 'unknown'.
 */
function getGitCommitHash() {
  const env = process.env.SOURCE_COMMIT?.trim();
  if (env) return COMMIT_RE.test(env) ? env.toLowerCase() : 'invalid-SOURCE_COMMIT';
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

function getCommitSource() {
  if (process.env.SOURCE_COMMIT?.trim()) return 'env:SOURCE_COMMIT';
  return fs.existsSync(path.join(ROOT, '.git')) ? 'git' : 'unknown';
}

function getPackageLockHash() {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'package-lock.json'))).digest('hex');
  } catch {
    return 'unknown';
  }
}

module.exports = { getGitCommitHash, getCommitSource, getPackageLockHash };
