import { availableParallelism } from 'node:os';
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
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/test/**',
        '**/__tests__/**',
      ],
    },
    include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    exclude: ['node_modules/', 'dist/', 'build/'],
    // Cap at 16 on big dev boxes, but never oversubscribe the host: GitHub
    // runners have 4 vCPUs, and a hardcoded 16 workers there starved the
    // heavy full-shell mount tests past testing-library's waitFor timeout
    // (CI failed for a week while local runs stayed green).
    maxWorkers: Math.min(16, Math.max(1, availableParallelism() - 1)),
    fileParallelism: true,
    maxConcurrency: 15,
  },
});
