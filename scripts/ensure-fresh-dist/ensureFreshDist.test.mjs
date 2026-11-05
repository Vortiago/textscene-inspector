/**
 * The pre-run build, from synthetic package roots with dictated mtimes: the rebuild itself is a
 * counter, so no test moves the repo's own dist.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ensureFreshDist } from './ensureFreshDist.mjs';

const OLD = 1_600_000_000;
const NEW = 1_700_000_000;

const scratch = [];

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

/** A core root whose compiled source is dated `sourceAt` and whose build stamp is dated `OLD`. */
function coreWithSourceAt(sourceAt) {
  const root = mkdtempSync(join(tmpdir(), 'ensure-fresh-dist-'));
  scratch.push(root);
  const files = {
    'dist/index.js': OLD,
    'tsconfig.tsbuildinfo': OLD,
    'src/index.ts': sourceAt,
  };
  for (const [rel, mtime] of Object.entries(files)) {
    const path = join(root, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, rel === 'tsconfig.tsbuildinfo' ? '{"fileNames":[]}' : '');
    utimesSync(path, mtime, mtime);
  }
  return root;
}

/** A build step that counts its runs and dates the stamp, as a real build does. */
function countingBuild(core, stampAt) {
  const build = () => {
    build.runs += 1;
    utimesSync(join(core, 'tsconfig.tsbuildinfo'), stampAt, stampAt);
  };
  build.runs = 0;
  return build;
}

describe('ensureFreshDist', () => {
  it('rebuilds a stale dist once, before any reader or sibling build starts', () => {
    const core = coreWithSourceAt(NEW);
    const build = countingBuild(core, NEW + 10);
    ensureFreshDist(core, build);
    expect(build.runs).toBe(1);
  });

  it('leaves a current dist alone, so the later nested builds write nothing', () => {
    const core = coreWithSourceAt(OLD - 10);
    const build = countingBuild(core, NEW);
    ensureFreshDist(core, build);
    expect(build.runs).toBe(0);
  });

  it('names the stale build when the rebuild leaves dist stale', () => {
    const core = coreWithSourceAt(NEW);
    const build = countingBuild(core, OLD);
    expect(() => ensureFreshDist(core, build)).toThrow(/dist predates src\/index\.ts/);
  });
});

describe('the root vitest config', () => {
  it('builds core before the demo corpora vendor and before any project runs', async () => {
    const { default: config } = await import('../../vitest.config.ts');
    expect(config.test.globalSetup[0]).toBe('scripts/ensure-fresh-dist/vitestGlobalSetup.mjs');
  });
});
