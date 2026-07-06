#!/usr/bin/env node
/**
 * Stop dev servers on ports 3000 (frontend) and 3002 (API).
 * Usage: node scripts/stop-dev.js [--port 3002]
 */

const { execSync } = require('child_process');

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (!out) {
      console.log(`端口 ${port} 未被占用`);
      return;
    }
    const pids = out.split('\n').filter(Boolean);
    pids.forEach((pid) => {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`已结束进程 ${pid} (端口 ${port})`);
      } catch (e) {
        console.warn(`无法结束 PID ${pid}: ${e.message}`);
      }
    });
  } catch {
    console.log(`端口 ${port} 未被占用`);
  }
}

const portArg = process.argv.indexOf('--port');
const ports = portArg >= 0 ? [process.argv[portArg + 1]] : ['3000', '3002'];
ports.forEach(killPort);

if (process.argv.includes('--wait')) {
  const sec = Number(process.env.STOP_DEV_WAIT_MS || 400) / 1000;
  try {
    execSync(`sleep ${sec}`);
  } catch {
    /* ignore */
  }
}
