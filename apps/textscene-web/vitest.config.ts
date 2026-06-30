import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
import { sourceResolve } from '../../vitest.shared';

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
    // Must match vitest.shared.ts — vitest 4 rejects workspace projects
    // with differing maxWorkers unless they get distinct groupOrders.
    maxWorkers: Math.min(16, Math.max(1, availableParallelism() - 1)),
    fileParallelism: true,
    maxConcurrency: 15,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/test-setup.ts']
    }
  }
});
