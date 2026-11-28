import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  renameSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { onHarnessExit } from './onHarnessExit.mjs';
import { REPO_ROOT } from './paths.mjs';

// A cold build and a full golden run fit within twenty minutes.
const DEFAULT_WAIT_MS = 20 * 60_000;
const POLL_MS = 1_000;
const UNREADABLE_GRACE_MS = 60_000;
// A new capture can retry a failed release before its waiting period starts.
const failedReleases = new Map();

function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
}

function processRuns(pid) {
  if (!pidExists(pid)) return false;
  if (process.platform !== 'linux') return true;
  try {
    // kill(pid, 0) still finds an exited child until its parent reaps it.
    return !/^State:\s*[ZX]\b/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'));
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'ENOENT') return pidExists(pid);
    if (error.code === 'EACCES' || error.code === 'EPERM') return true;
    throw error;
  }
}

export function buildLockState(text, ageMs, runs) {
  let owner;
  try {
    owner = JSON.parse(text);
  } catch {
    // A process can stop between creating the directory and writing its owner.
  }
  if (
    !Number.isInteger(owner?.pid) ||
    owner.pid <= 0 ||
    owner.pid > 0x7fffffff ||
    typeof owner.command !== 'string' ||
    !owner.command.trim() ||
    typeof owner.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(owner.startedAt))
  ) {
    return { state: ageMs > UNREADABLE_GRACE_MS ? 'stale' : 'unreadable' };
  }
  return { state: runs(owner.pid) ? 'held' : 'stale', owner };
}

function removeOwner(lock, file) {
  try {
    if (file) rmSync(join(lock, file), { force: true });
    // A competing waiter can already own this path. Only an empty directory is safe to remove.
    rmdirSync(lock);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
  }
}

function publishOwner(lock, file) {
  const owner = {
    pid: process.pid,
    command: process.argv.join(' ').replace(/[\r\n]+/g, ' '),
    startedAt: new Date().toISOString(),
  };
  const staging = join(lock, `${file}.tmp`);
  try {
    writeFileSync(staging, JSON.stringify(owner), { flag: 'wx' });
    // A waiter that read partial JSON can only remove the staging name, never the published record.
    renameSync(staging, join(lock, file));
  } finally {
    rmSync(staging, { force: true });
  }
}

function tryAcquire(lock, file) {
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  const release = releaseOnExit(lock, file);
  try {
    publishOwner(lock, file);
    // A waiter can remove an old empty directory between mkdir and the write. Verify sole ownership.
    const files = readdirSync(lock);
    if (files.length === 1 && files[0] === file) return release;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      release();
      throw error;
    }
  }
  release();
  return false;
}

function inspectLock(lock) {
  try {
    const files = readdirSync(lock);
    const file = files.find((name) => name.startsWith('harness-')) ?? files[0];
    const path = file ? join(lock, file) : lock;
    let text = '';
    if (file && !file.endsWith('.tmp')) {
      try {
        text = readFileSync(path, 'utf8');
      } catch (error) {
        if (error.code !== 'EACCES' && error.code !== 'EPERM') throw error;
      }
    }
    const ageMs = Date.now() - statSync(path).mtimeMs;
    return { file, ...buildLockState(text, ageMs, processRuns) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function pruneStaleOwners(lock) {
  for (;;) {
    const current = inspectLock(lock);
    if (current?.state !== 'stale') return current;
    removeOwner(lock, current.file);
  }
}

function releaseOnExit(lock, file) {
  let unregister = onHarnessExit(release);
  let retryTimer;
  function retry() {
    try {
      release();
    } catch {
      // The releasing caller received the error. Waiters still have their own deadline.
    }
  }
  function release() {
    if (!unregister) return;
    try {
      removeOwner(lock, file);
    } catch (error) {
      if (!retryTimer) {
        failedReleases.set(retry, lock);
        retryTimer = setInterval(retry, POLL_MS).unref();
      }
      throw error;
    }
    if (retryTimer) {
      clearInterval(retryTimer);
      failedReleases.delete(retry);
    }
    unregister();
    unregister = undefined;
    pruneStaleOwners(lock);
  }
  return Object.assign(release, { ownerPath: join(lock, file) });
}

/** @canonical Retain the parent harness's working-copy lock in a child process */
export function joinBuildLock(ownerPath) {
  const lock = dirname(ownerPath);
  const file = `${randomUUID()}.json`;
  const release = releaseOnExit(lock, file);
  try {
    publishOwner(lock, file);
    // A child spawned before a takeover can start after it. It must still see its own generation.
    statSync(ownerPath);
    return release;
  } catch (error) {
    release();
    throw error;
  }
}

/** @canonical Lock one working copy for a preview build and capture */
export async function acquireBuildLock({
  root = REPO_ROOT,
  portEnvName = 'VISUAL_PORT',
  log = console.log,
} = {}) {
  const waitMs = Number(process.env.HARNESS_LOCK_WAIT_MS ?? DEFAULT_WAIT_MS);
  if (!Number.isSafeInteger(waitMs) || waitMs < 0) {
    throw new Error('HARNESS_LOCK_WAIT_MS must be a non-negative integer in milliseconds');
  }
  const cache = join(root, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  const lock = join(cache, 'textscene-harness.lock');
  const file = `harness-${randomUUID()}.json`;
  const deadline = performance.now() + waitMs;
  let announced = false;
  for (;;) {
    for (const [retry, checkoutLock] of failedReleases) {
      if (checkoutLock === lock) retry();
    }
    const release = tryAcquire(lock, file);
    if (release) return release;
    const current = pruneStaleOwners(lock);
    if (!current) continue;
    const holder = current.owner;
    const description = holder
      ? `PID ${holder.pid} (${holder.command}, started ${holder.startedAt})`
      : 'an unreadable owner';
    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      throw new Error(
        `[preview] lock held by ${description}. Wait for it to finish, or run in a second working copy with its own ${portEnvName}.`
      );
    }
    if (holder && !announced) {
      log(`[preview] waiting for ${description} to release the working copy`);
      announced = true;
    }
    await delay(Math.min(POLL_MS, remaining));
  }
}
