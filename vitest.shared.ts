import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * Resolve `@textscene/core` to its TypeScript SOURCE during tests via the
 * package's `@textscene/source` export condition, so a fresh checkout runs
 * `pnpm test` WITHOUT first building core's `dist/`. Production `vite build`
 * never sets this condition, so it falls through to `dist`.
 *
 * We set the condition in BOTH places because the right one depends on the
 * project's test `environment`:
 *   - node env  → Vite's SSR pipeline → `ssr.resolve.conditions`
 *   - happy-dom / jsdom → browser-like → Vite pre-bundles via the CLIENT
 *     resolver → `resolve.conditions` (verified: ssr-only left the happy-dom
 *     web project unable to resolve the package entry).
 * Each conditions array REPLACES Vite's defaults, so the relevant defaults
 * (`module` + `node`/`browser` + `development|production`) are re-listed;
 * `import`/`default` are always applied automatically. Apps with a standalone
 * config spread this directly; core/linter inherit it via the default export.
 */
const SOURCE_CONDITION = '@textscene/source';
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
