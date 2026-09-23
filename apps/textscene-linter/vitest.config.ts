import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the linter CLI: a node environment, with no DOM.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-linter',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  })
);
