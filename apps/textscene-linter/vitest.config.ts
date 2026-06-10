import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for the TSCN linter CLI.
 * Pure node environment - no DOM needed for CLI testing.
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
