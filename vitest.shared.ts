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
  },
});
