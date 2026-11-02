import { availableParallelism, totalmem, freemem } from 'node:os';
import { defineConfig } from 'vitest/config';
import { maxWorkersFor, sourceResolve } from '../../vitest.shared';

export default defineConfig({
  // Resolve @textscene/core to its TS source so a fresh checkout tests without
  // building core's dist first. See vitest.shared.ts (sourceResolve).
  ...sourceResolve,
  test: {
    name: '@textscene/web-previewer',
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Same formula as vitest.shared.ts: vitest 4 rejects workspace projects with differing maxWorkers
    // unless they get distinct groupOrders; keep these three in sync.
    maxWorkers: maxWorkersFor(totalmem(), freemem(), availableParallelism()),
    fileParallelism: true,
    maxConcurrency: 15,
    // Same formula as vitest.shared.ts: keeps each module's transform between runs.
    fsModuleCache: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/test-setup.ts'],
    },
  },
});
