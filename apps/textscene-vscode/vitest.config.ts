import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // Extension code runs in Node (webview tests override with @vitest-environment)
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/test/integration/**/*.{test,spec}.ts'], // Integration tests run separately with @vscode/test-electron
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test-setup.ts'
      ]
    }
  }
});
