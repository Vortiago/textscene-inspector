import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'textscene-inspector',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/test/integration/**/*.{test,spec}.ts'],
    // Use threads pool with single thread to prevent OOM
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 1,
      },
    },
    fileParallelism: false,
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/test-setup.ts']
    }
  }
});
