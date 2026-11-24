import { availableParallelism, totalmem, freemem } from 'node:os';
import { defineConfig } from 'vitest/config';
import { maxWorkersFor, sourceResolve } from '../../vitest.shared';

export default defineConfig({
  // Resolve @textscene/core to its TS source so a fresh checkout tests without
  // building core's dist first. See vitest.shared.ts (sourceResolve).
  ...sourceResolve,
  test: {
    name: 'textscene-inspector',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    // The mocha suites that run inside VS Code.
    exclude: ['src/test/**/*.{test,spec}.ts'],
    // Same formula as vitest.shared.ts: vitest 4 rejects workspace projects with differing
    // maxWorkers unless they get distinct groupOrders.
    maxWorkers: maxWorkersFor(totalmem(), freemem(), availableParallelism()),
    fileParallelism: true,
    maxConcurrency: 15,
    // Same formula as vitest.shared.ts: keeps each module's transform between runs.
    fsModuleCache: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // The setup file and its `*.testkit.ts` modules are test scaffolding, which
      // would otherwise report as uncovered production source.
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.testkit.ts', 'src/test-setup.ts'],
    },
  },
});
