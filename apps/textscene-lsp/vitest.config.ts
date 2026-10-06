import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the tscn-lsp language server: a node environment, with no DOM.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-lsp',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  })
);
