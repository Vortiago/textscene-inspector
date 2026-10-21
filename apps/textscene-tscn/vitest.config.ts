import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the @textscene/tscn parser: a node environment, with no DOM.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-tscn',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  })
);
