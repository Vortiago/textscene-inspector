import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * Tests resolve `@textscene/core` to its TypeScript source through the `@textscene/source` export
 * condition, so a fresh checkout runs `pnpm test` without building `dist/`. Production `vite build`
 * never sets the condition. Apps with a standalone config spread `sourceResolve`, and core and the
 * linter inherit it through the default export.
 */
const SOURCE_CONDITION = '@textscene/source';
// Both resolvers carry the condition: a node project resolves through `ssr.resolve.conditions`,
// and a happy-dom or jsdom project pre-bundles through the client's `resolve.conditions`. Each
// array replaces Vite's defaults, so `module`, `node` or `browser` and `development|production`
// are listed again. Vite always applies `import` and `default`.
export const sourceResolve = {
  resolve: {
    conditions: [SOURCE_CONDITION, 'module', 'browser', 'development|production'],
  },
  ssr: {
    resolve: {
      conditions: [SOURCE_CONDITION, 'module', 'node', 'development|production'],
    },
  },
};

/**
 * Shared Vitest configuration for all packages.
 * This config is used across the monorepo to ensure consistent testing behavior.
 * Individual packages can extend this config using mergeConfig from vitest/config.
 */
export default defineConfig({
  ...sourceResolve,
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
        // Test-only sources that are neither: helpers a suite imports rather
        // than a suite itself. The tsconfig excludes exactly these two shapes
        // from the build, so a list keyed only on the `.test.` infix counts
        // them in the denominator while nothing ships them.
        '**/*.testkit.ts',
        'src/**/testing/**',
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
