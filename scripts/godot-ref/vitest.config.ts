import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the tests that render through real Godot (`pnpm test:godot-ref`). No
 * project of the root configuration includes them, so the unit run is the same set on every host.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'godot-ref',
      root: import.meta.dirname,
      include: ['**/*.engine.test.mjs'],
      globalSetup: ['engineTestSetup.mjs'],
    },
  })
);
