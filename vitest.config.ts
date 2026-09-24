import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration: each package, app and `scripts` is one project, and a project's own
 * `vitest.config.ts` extends the shared config. `projects` replaces the workspace file, which
 * Vitest 3.2 deprecates.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/*',
      'scripts',
    ],
  },
});
