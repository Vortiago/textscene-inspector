import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the tests that render through real Godot (`pnpm test:godot-ref`). No
 * project of the root configuration includes them, so the unit run is the same set on every host.
 */
export default defineConfig({
  test: {
    name: 'godot-ref',
    root: import.meta.dirname,
    environment: 'node',
    globals: true,
    include: ['**/*.engine.test.mjs'],
    globalSetup: ['engineTestSetup.mjs'],
  },
});
