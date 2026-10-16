import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration: each package, app and `scripts` is one project, and a project's own
 * `vitest.config.ts` extends the shared config. `projects` replaces the workspace file, which
 * Vitest 3.2 deprecates. The global setup runs once per run, before every project, and vendors the
 * demo corpora many tests read.
 */
export default defineConfig({
  test: {
    globalSetup: ['scripts/vendor-godot-demos/vitestGlobalSetup.mjs'],
    projects: ['packages/*', 'apps/*', 'scripts'],
  },
});
