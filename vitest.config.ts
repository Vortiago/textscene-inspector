import { defineConfig } from 'vitest/config';
import { vmMemoryLimit } from './vitest.shared';

/**
 * Root Vitest configuration: each package, app and `scripts` is one project, and a project's own
 * `vitest.config.ts` extends the shared config. `projects` replaces the workspace file, which
 * Vitest 3.2 deprecates. The global setups run once per run, before every project: one builds core
 * before the tests read its dist, and one vendors the demo corpora many tests read and writes the untracked fixture manifest.
 */
export default defineConfig({
  test: {
    vmMemoryLimit,
    globalSetup: [
      'scripts/build-core-dist/vitestGlobalSetup.mjs',
      'scripts/generate-fixtures/vitestGlobalSetup.mjs',
    ],
    projects: ['packages/*', 'apps/*', 'scripts'],
  },
});
