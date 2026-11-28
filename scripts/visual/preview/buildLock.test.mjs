import { expect, it, onTestFinished, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireBuildLock, buildLockState } from './buildLock.mjs';

it('waits for the first harness to release the same working copy', async () => {
  const { root } = checkout();
  const release = await acquireBuildLock({ root });
  onTestFinished(release);
  const log = vi.fn();
  const entered = vi.fn();
  const next = acquireBuildLock({ root, log }).then((unlock) => {
    entered();
    unlock();
  });
  expect(log).toHaveBeenCalledOnce();
  expect(entered).not.toHaveBeenCalled();
  release();
  await next;
  expect(entered).toHaveBeenCalledOnce();
});

const owner = { pid: process.pid, command: 'node capture.mjs', startedAt: new Date().toISOString() };

function checkout() {
  const root = mkdtempSync(join(tmpdir(), 'preview-lock-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  return { root, lock: join(root, 'node_modules', '.cache', 'textscene-harness.lock') };
}

it.each([
  [JSON.stringify(owner), 120_000, true, 'held'],
  [JSON.stringify(owner), 0, false, 'stale'],
  ['{', 0, true, 'unreadable'],
  ['null', 60_000, true, 'unreadable'],
  ['{', 60_001, true, 'stale'],
  [JSON.stringify({ ...owner, pid: -1 }), 0, true, 'unreadable'],
  [JSON.stringify({ ...owner, command: [] }), 0, true, 'unreadable'],
])('classifies %s at %d ms with process running %s as %s', (text, ageMs, runs, expected) => {
  expect(buildLockState(text, ageMs, () => runs).state).toBe(expected);
});

it('can use another checkout while the first holds a lock', async () => {
  const first = checkout();
  const second = checkout();
  onTestFinished(await acquireBuildLock(first));
  onTestFinished(await acquireBuildLock(second));
  expect(existsSync(first.lock) && existsSync(second.lock)).toBe(true);
});

it('names the live holder and both ways to continue at a zero wait limit', async () => {
  const { root, lock } = checkout();
  const release = await acquireBuildLock({ root });
  onTestFinished(release);
  vi.stubEnv('HARNESS_LOCK_WAIT_MS', '0');
  onTestFinished(() => vi.unstubAllEnvs());
  await expect(acquireBuildLock({ root, portEnvName: 'PARITY_PORT' })).rejects.toThrow(
    new RegExp(`PID ${process.pid}.*Wait.*second working copy.*PARITY_PORT`)
  );
  const [file] = readdirSync(lock);
  expect(JSON.parse(readFileSync(join(lock, file), 'utf8'))).toMatchObject({ pid: process.pid });
});

it('recovers a partial record only after one minute', async () => {
  const { root, lock } = checkout();
  vi.stubEnv('HARNESS_LOCK_WAIT_MS', '0');
  onTestFinished(() => vi.unstubAllEnvs());
  mkdirSync(lock, { recursive: true });
  const file = join(lock, 'partial.json');
  writeFileSync(file, '{');
  await expect(acquireBuildLock({ root })).rejects.toThrow(/unreadable/);
  const old = new Date(Date.now() - 61_000);
  utimesSync(file, old, old);
  utimesSync(lock, old, old);
  const release = await acquireBuildLock({ root });
  release();
  expect(existsSync(lock)).toBe(false);
});

async function childHolder(root) {
  const module = new URL('./buildLock.mjs', import.meta.url).href;
  const program = `
    import { acquireBuildLock } from ${JSON.stringify(module)};
    await acquireBuildLock({ root: process.argv[1] });
    process.send('holding');
    process.on('message', () => process.exit(0));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program, root], {
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const exited = once(child, 'exit');
  onTestFinished(async () => {
    child.kill();
    await exited;
  });
  await Promise.race([
    once(child, 'message'),
    exited.then(() => {
      throw new Error('holder exited before it acquired the lock');
    }),
  ]);
  return { child, exited };
}

it.each(['SIGINT', 'SIGTERM'])('releases the working copy on %s', async (signal) => {
  const { root, lock } = checkout();
  const { child, exited } = await childHolder(root);
  child.kill(signal);
  await exited;
  expect(existsSync(lock)).toBe(false);
});

it('takes over a dead process without releasing the next holder', async () => {
  const { root, lock } = checkout();
  const { child, exited } = await childHolder(root);
  child.kill('SIGKILL');
  await exited;
  expect(existsSync(lock)).toBe(true);
  const first = await acquireBuildLock({ root });
  first();
  const second = await acquireBuildLock({ root });
  onTestFinished(second);
  first();
  expect(existsSync(lock)).toBe(true);
});

it('admits one process at a time after simultaneous stale lock reads', async () => {
  const { root, lock } = checkout();
  const { child, exited } = await childHolder(root);
  child.kill('SIGKILL');
  await exited;
  const module = new URL('./buildLock.mjs', import.meta.url).href;
  const program = `
    import { writeFileSync, unlinkSync } from 'node:fs';
    import { setTimeout } from 'node:timers/promises';
    import { acquireBuildLock } from ${JSON.stringify(module)};
    const root = process.argv[1];
    const release = await acquireBuildLock({ root });
    const marker = root + '/active';
    writeFileSync(marker, '', { flag: 'wx' });
    await setTimeout(50);
    unlinkSync(marker);
    release();
  `;
  const results = await Promise.all(
    Array.from({ length: 4 }, () => {
      const waiter = spawn(process.execPath, ['--input-type=module', '-e', program, root], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      onTestFinished(() => waiter.kill());
      return once(waiter, 'exit');
    })
  );
  expect(results).toEqual(Array(4).fill([0, null]));
  expect(existsSync(lock)).toBe(false);
}, 15_000);
