import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../vitest.shared';

/**
 * Vitest configuration for the repo-root build and CI scripts: plain Node ESM
 * with no build step, in the node environment, since they are CLI tools.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'scripts',
      environment: 'node',
      include: ['**/*.test.mjs'],
    },
  })
);
