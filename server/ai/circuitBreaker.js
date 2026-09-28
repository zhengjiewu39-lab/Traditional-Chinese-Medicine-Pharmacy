/**
 * In-process circuit breaker for the model provider.
 * Configuration errors (400/401/403/404) are never retried.
 */

const NO_RETRY = new Set([400, 401, 403, 404, 422]);
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function createCircuitBreaker({
  failureThreshold = 5,
  cooldownMs = 30000,
  maxRetries = 2,
  baseDelayMs = 200,
} = {}) {
  let failures = 0;
  let openedAt = 0;

  function isOpen() {
    if (!openedAt) return false;
    if (Date.now() - openedAt >= cooldownMs) {
      openedAt = 0;
      failures = 0;
      return false;
    }
    return true;
  }

  function recordSuccess() {
    failures = 0;
    openedAt = 0;
  }

  function recordFailure() {
    failures += 1;
    if (failures >= failureThreshold) openedAt = Date.now();
  }

  function shouldRetry(status) {
    if (status == null) return true;
    if (NO_RETRY.has(status)) return false;
    return RETRYABLE.has(status);
  }

  async function exec(fn) {
    if (isOpen()) {
      const err = new Error('circuit_open');
      err.code = 'circuit_open';
      throw err;
    }
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const out = await fn(attempt);
        recordSuccess();
        return out;
      } catch (err) {
        lastErr = err;
        const status = err.status || err.httpStatus;
        if (!shouldRetry(status) || attempt === maxRetries) {
          recordFailure();
          throw err;
        }
        const delay = baseDelayMs * (2 ** attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    recordFailure();
    throw lastErr;
  }

  function snapshot() {
    return { failures, open: isOpen(), openedAt: openedAt || null, cooldownMs, failureThreshold };
  }

  function reset() {
    failures = 0;
    openedAt = 0;
  }

  return { exec, snapshot, reset, isOpen, shouldRetry };
}

module.exports = { createCircuitBreaker, NO_RETRY, RETRYABLE };
