import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration for all packages.
 * This config is used across the monorepo to ensure consistent testing behavior.
 * Individual packages can extend this config using mergeConfig from vitest/config.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
        '**/__tests__/**',
      ],
    },
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules/', 'dist/', 'build/'],
    // Use threads pool with limited workers to prevent OOM
    // Forks pool causes timeout issues on Windows
    pool: 'threads',
    poolOptions: {
      threads: {
        // Single worker to prevent OOM during pre-commit hooks
        minThreads: 1,
        maxThreads: 1,
      },
    },
    // Run tests sequentially to reduce memory pressure
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
