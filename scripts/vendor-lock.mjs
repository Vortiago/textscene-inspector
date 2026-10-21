/**
 * A lock file that serialises the vendoring across processes, such as a test run and a dev server
 * started together. The file holds the holder's process id, so a lock left by a process that ended
 * is taken over.
 */

import { readFileSync, rmSync, writeFileSync } from 'node:fs';

/** How often a waiting process checks the lock again. A fetch takes seconds, so a finer poll gains nothing. */
const POLL_MS = 250;
const sleeper = new Int32Array(new SharedArrayBuffer(4));

/** Runs `work` while this process holds the lock at `path`, and returns what it returns. */
export function withLock(path, work) {
  acquire(path);
  try {
    return work();
  } finally {
    rmSync(path, { force: true });
  }
}

function acquire(path) {
  let announced = false;
  for (;;) {
    try {
      writeFileSync(path, String(process.pid), { flag: 'wx' });
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const holder = Number(readHolder(path));
    if (Number.isInteger(holder) && holder > 0 && !isRunning(holder)) {
      rmSync(path, { force: true });
      continue;
    }
    if (!announced) console.log(`[vendor-godot-demos] waiting for process ${holder} to finish vendoring`);
    announced = true;
    Atomics.wait(sleeper, 0, 0, POLL_MS);
  }
}

/** The lock's text, or nothing when the holder released it between the two reads. */
function readHolder(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** Whether a process with this id runs. EPERM means it runs under another user. */
function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}
