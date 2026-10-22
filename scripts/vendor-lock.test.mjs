/**
 * The vendoring runs under a lock file, so a second process waits instead of writing into the same
 * corpora.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withLock } from './vendor-lock.mjs';

/** A process id no process holds: above Linux's default pid_max and Windows' usual range. */
const DEAD_PID = 2 ** 30;

let dir;
let lock;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'with-lock-'));
  lock = join(dir, '.lock');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('withLock', () => {
  it('holds the lock with this process id while the work runs, and removes it after', () => {
    const holder = withLock(lock, () => readFileSync(lock, 'utf8'));
    expect(holder).toBe(String(process.pid));
    expect(existsSync(lock)).toBe(false);
  });

  it('removes the lock when the work throws', () => {
    expect(() =>
      withLock(lock, () => {
        throw new Error('fetch failed');
      })
    ).toThrow('fetch failed');
    expect(existsSync(lock)).toBe(false);
  });

  it('takes over a lock whose process has ended (edge case)', () => {
    writeFileSync(lock, String(DEAD_PID));
    expect(withLock(lock, () => 'ran')).toBe('ran');
  });
});
