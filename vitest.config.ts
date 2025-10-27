import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration using the projects feature.
 * As of Vitest 3.2, the workspace file approach is deprecated.
 * Instead, we use the projects array to define all test packages.
 *
 * Each package in the monorepo is automatically treated as a separate project.
 * Individual packages can have their own vitest.config.ts to extend the shared config.
 */
export default defineConfig({
  test: {
    // Define all packages as projects
    // Vitest will automatically pick up any vitest.config.ts in these directories
    projects: [
      'packages/*',
      'apps/*',
    ],
  },
});
