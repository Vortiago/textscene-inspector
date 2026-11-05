/** The pre-run core build: its step and its place in the root config. */

import { describe, expect, it, vi } from 'vitest';

const execSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execSync }));

describe('the core build global setup', () => {
  it('runs the build that the staleness messages name, from the repo root', async () => {
    const { BUILD } = await import('../distFreshness.mjs');
    const { REPO_ROOT } = await import('../repoRoot.mjs');
    const { setup } = await import('./vitestGlobalSetup.mjs');
    setup();
    expect(execSync).toHaveBeenCalledWith(BUILD, { cwd: REPO_ROOT, stdio: 'inherit' });
  });

  it('runs first in the root config, before the corpora vendor and any project starts', async () => {
    const { default: config } = await import('../../vitest.config.ts');
    expect(config.test.globalSetup[0]).toBe('scripts/build-core-dist/vitestGlobalSetup.mjs');
  });
});
