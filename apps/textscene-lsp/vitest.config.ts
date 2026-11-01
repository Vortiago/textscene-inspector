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
      // server.e2e and package.e2e each rebuild the one dist the other reads (the server bundle,
      // the tarball, the metafile), so their builds never overlap a reader.
      fileParallelism: false,
    },
  })
);
