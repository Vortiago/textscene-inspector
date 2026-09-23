import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the dev-only test-helper package, in node: the helpers walk the
 * filesystem.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-dev-kit',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  })
);
