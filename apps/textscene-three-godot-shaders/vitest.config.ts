import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the @textscene/three-godot-shaders package: a node environment, since
 * its tests read the built bundle and the packed tarball.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-three-godot-shaders',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.test.mjs'],
    },
  })
);
