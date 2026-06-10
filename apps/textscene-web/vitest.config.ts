import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
