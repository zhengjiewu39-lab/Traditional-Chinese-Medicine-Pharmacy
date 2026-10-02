/**
 * FIFO simulation job queue. Each job runs in its own worker thread (simulationWorker.js) so the
 * HTTP event loop is never blocked; at most `concurrency` workers run at once. Cancellation sets a
 * shared flag checked by the engine once per simulated day; a queued job is cancelled immediately.
 */

/* global SharedArrayBuffer, Atomics */

const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_FILE = path.join(__dirname, 'simulationWorker.js');
const MAX_FINISHED_JOBS = 200;

class JobQueue {
  constructor({ concurrency = 1 } = {}) {
    this.concurrency = concurrency;
    this.jobs = new Map();
    this.pending = [];
    this.running = 0;
  }

  /**
   * @param {string} id
   * @param {{ policyIds: string[], scenario: Object, seeds: number[], policyParams?: Object }} spec
   * @param {(byPolicy: Object) => Object} onDone — persists results, returns fields merged into the job status
   */
  submit(id, spec, onDone, meta = {}) {
    const totalRuns = spec.policyIds.length * spec.seeds.length;
    const job = {
      id,
      status: 'queued',
      progress: { completedRuns: 0, totalRuns, pct: 0 },
      createdAt: new Date().toISOString(),
      ...meta,
      spec,
      onDone,
      cancelFlag: new SharedArrayBuffer(4),
      worker: null,
    };
    this.jobs.set(id, job);
    this.pending.push(id);
    this.pump();
    return this.status(id);
  }

  status(id) {
    const j = this.jobs.get(id);
    if (!j) return null;
    const { spec: _s, onDone: _d, cancelFlag: _c, worker: _w, ...pub } = j;
    return pub;
  }

  cancel(id) {
    const j = this.jobs.get(id);
    if (!j) return null;
    if (j.status === 'queued') {
      this.pending = this.pending.filter((x) => x !== id);
      j.status = 'cancelled';
      j.finishedAt = new Date().toISOString();
    } else if (j.status === 'running') {
      Atomics.store(new Int32Array(j.cancelFlag), 0, 1);
      j.status = 'cancelling';
    }
    return this.status(id);
  }

  pump() {
    while (this.running < this.concurrency && this.pending.length) {
      const id = this.pending.shift();
      const j = this.jobs.get(id);
      if (!j || j.status !== 'queued') continue;
      this.start(j);
    }
  }

  start(j) {
    this.running += 1;
    j.status = 'running';
    j.startedAt = new Date().toISOString();
    const worker = new Worker(WORKER_FILE, {
      workerData: {
        job: { policyIds: j.spec.policyIds, scenario: j.spec.scenario, seeds: j.spec.seeds, policyParams: j.spec.policyParams },
        cancelFlag: j.cancelFlag,
      },
    });
    j.worker = worker;
    let settled = false;
    const finish = (fields) => {
      if (settled) return;
      settled = true;
      Object.assign(j, fields, { finishedAt: new Date().toISOString(), worker: null });
      this.running -= 1;
      this.prune();
      this.pump();
    };
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        const pct = msg.totalRuns > 0 ? (100 * msg.completedRuns) / msg.totalRuns : 0;
        j.progress = { completedRuns: msg.completedRuns, totalRuns: msg.totalRuns, pct, policyId: msg.policyId, day: msg.day };
      } else if (msg.type === 'done') {
        try {
          finish({ status: 'completed', progress: { ...j.progress, pct: 100 }, ...j.onDone(msg.byPolicy) });
        } catch (e) {
          finish({ status: 'failed', error: e.message });
        }
      } else if (msg.type === 'cancelled') {
        finish({ status: 'cancelled' });
      } else if (msg.type === 'error') {
        finish({ status: 'failed', error: msg.message, errorName: msg.name });
      }
    });
    worker.on('error', (e) => finish({ status: 'failed', error: e.message }));
    worker.on('exit', (code) => {
      if (!settled) finish({ status: 'failed', error: `worker exited with code ${code} before reporting a result` });
    });
  }

  prune() {
    const finished = [...this.jobs.values()].filter((j) => ['completed', 'failed', 'cancelled'].includes(j.status));
    for (const j of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED_JOBS))) this.jobs.delete(j.id);
  }
}

module.exports = { JobQueue };
