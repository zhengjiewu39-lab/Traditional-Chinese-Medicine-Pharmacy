/**
 * Worker thread: runs one simulation job off the HTTP thread.
 * workerData = { job: { policyIds, scenario, seeds, logLevelSingle }, cancelFlag: SharedArrayBuffer(Int32[1]) }
 * Posts { type: 'progress', completedRuns, totalRuns, policyId, day } and finally
 * { type: 'done', byPolicy: { [policyId]: results[] } } | { type: 'cancelled' } | { type: 'error', message }.
 */

/* global Atomics */

const { parentPort, workerData } = require('worker_threads');
const { runSimulation } = require('./simulationEngine');

const { job, cancelFlag } = workerData;
const flag = new Int32Array(cancelFlag);
const shouldCancel = () => Atomics.load(flag, 0) === 1;

try {
  const totalRuns = job.policyIds.length * job.seeds.length;
  const single = job.seeds.length === 1;
  const progress = { completedRuns: 0, lastPost: 0, policyId: null };
  const onDay = ({ day }) => {
    const now = Date.now();
    if (now - progress.lastPost > 200) {
      progress.lastPost = now;
      parentPort.postMessage({ type: 'progress', completedRuns: progress.completedRuns, totalRuns, policyId: progress.policyId, day });
    }
  };
  const byPolicy = {};
  let cancelled = false;
  outer: for (const policyId of job.policyIds) {
    byPolicy[policyId] = [];
    progress.policyId = policyId;
    for (let i = 0; i < job.seeds.length; i += 1) {
      const seed = job.seeds[i];
      const r = runSimulation({
        scenario: { ...job.scenario, randomSeed: seed },
        policyId,
        policyParams: job.policyParams?.[policyId],
        logLevel: single ? 'full' : 'summary',
        shouldCancel,
        onProgress: single ? onDay : undefined,
      });
      if (r.cancelled) { cancelled = true; break outer; }
      byPolicy[policyId].push({
        replicateIndex: i,
        seed,
        metrics: r.metrics,
        runLog: single || i === 0 ? r.runLog : null,
      });
      progress.completedRuns += 1;
      parentPort.postMessage({ type: 'progress', completedRuns: progress.completedRuns, totalRuns, policyId });
      if (shouldCancel()) { cancelled = true; break outer; }
    }
  }
  parentPort.postMessage(cancelled ? { type: 'cancelled', completedRuns: progress.completedRuns, totalRuns } : { type: 'done', byPolicy });
} catch (e) {
  parentPort.postMessage({ type: 'error', message: e.message, name: e.name });
}
