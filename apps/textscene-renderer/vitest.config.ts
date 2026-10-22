import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the @textscene/renderer package: a node environment, since its tests
 * read the built bundle and the packed tarball.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-renderer',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.test.mjs'],
    },
  })
);
