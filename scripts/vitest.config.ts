import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../vitest.shared';

/**
 * Vitest configuration for the repo-root build/CI scripts (plain Node ESM,
 * no TypeScript build step). Pure node environment — these are CLI tools,
 * never DOM.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'scripts',
      environment: 'node',
      include: ['*.test.mjs'],
    },
  })
);
