import { availableParallelism, totalmem, freemem } from 'node:os';
import { getHeapStatistics } from 'node:v8';
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
 * Vitest recycles a VM worker once its heap passes `vmMemoryLimit`. The default, 1 / maxWorkers of
 * machine memory, is above V8's worker heap limit (4.8 GB against 2.2 GB on 16 GB and 4 CPUs), so
 * the worker dies first. 70% leaves room for the next file. A multi-project run reads the limit
 * from the root config only.
 */
const WORKER_HEAP_SHARE_BEFORE_RECYCLE = 0.7;
export const vmMemoryLimit = `${Math.floor(
  (getHeapStatistics().heap_size_limit * WORKER_HEAP_SHARE_BEFORE_RECYCLE) / 1024 ** 2
)}MB`;

/**
 * Per-worker memory budget used to cap concurrency. Measured on a 12-core / 31 GB dev box: a full
 * textscene-core run with 11 workers peaked at ~22.5 GB of node RSS (~2 GB per worker average),
 * which tripped the kernel OOM killer while other desktop apps were running. CI runners are small
 * and idle, so the CPU cap below still dominates there.
 */
const WORKER_MEMORY_BUDGET_BYTES = 2 * 1024 ** 3;
/** Keep this much memory free for the OS and other apps (browser, editor, a parallel tsc). */
const MEMORY_RESERVE_BYTES = 4 * 1024 ** 3;

/**
 * Worker count from both CPUs and memory, so a loaded big desktop does not overcommit.
 * Extracted as a pure function so vitest.shared.test.ts can cover the arithmetic without
 * spawning workers. `total`/`free` are injected; pass os.totalmem()/freemem() in production.
 */
export function maxWorkersFor(total: number, free: number, cpus: number): number {
  const cpuCap = Math.max(1, cpus - 1);
  const memCap = Math.max(1, Math.floor((Math.max(0, total - MEMORY_RESERVE_BYTES) - (total - free)) / WORKER_MEMORY_BUDGET_BYTES));
  return Math.min(16, cpuCap, memCap);
}

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
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['default'],
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
    // (CI failed for a week while local runs stayed green). Memory adds a
    // second cap so a loaded desktop (browser + editor + parallel tsc) does
    // not push 11 workers x ~2 GB past the kernel OOM killer.
    maxWorkers: maxWorkersFor(totalmem(), freemem(), availableParallelism()),
    fileParallelism: true,
    maxConcurrency: 15,
    vmMemoryLimit,
    // Keeps each module's transform in node_modules/.vitest-cache, so the next run skips it.
    fsModuleCache: true,
  },
});
