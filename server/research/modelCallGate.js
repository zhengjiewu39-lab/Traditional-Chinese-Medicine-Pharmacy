/**
 * One gated entry before any research model or extract complete() call.
 * Quota is reserved only when a provider is actually invoked.
 */
const GATED_CODES = new Set(['cancelled', 'quota_paused', 'policy_paused']);

function gatedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function mergeSignals(outer, inner) {
  if (!outer && !inner) return undefined;
  if (!outer) return inner;
  if (!inner) return outer;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (outer.aborted || inner.aborted) controller.abort();
  else {
    outer.addEventListener('abort', onAbort, { once: true });
    inner.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

function wrapProvider(provider, {
  reserve,
  policyAllows,
  isCancelled,
  signal,
  onDispatched,
} = {}) {
  if (!provider || typeof provider.complete !== 'function') return null;
  if (provider.__gated) return provider;
  const gated = {
    ...provider,
    __gated: true,
    async complete(args = {}) {
      if (isCancelled?.() || signal?.aborted || args.signal?.aborted) {
        throw gatedError('cancelled', 'Research call cancelled before dispatch');
      }
      if (typeof policyAllows === 'function' && policyAllows() === false) {
        throw gatedError('policy_paused', 'Research call blocked by current policy');
      }
      if (typeof reserve === 'function' && reserve() === false) {
        throw gatedError('quota_paused', 'Research model-call quota exhausted');
      }
      const result = await provider.complete({
        ...args,
        signal: mergeSignals(signal, args.signal),
      });
      if (onDispatched) onDispatched({ usage: args.usage || null });
      return result;
    },
  };
  return gated;
}

function isGatedError(err) {
  return Boolean(err && GATED_CODES.has(err.code));
}

module.exports = {
  wrapProvider,
  mergeSignals,
  gatedError,
  isGatedError,
  GATED_CODES,
};
