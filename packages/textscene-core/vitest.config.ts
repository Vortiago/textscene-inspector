import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for textscene-core: the shared root configuration under happy-dom, which
 * supplies the DOM APIs.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'textscene-core',
      environment: 'happy-dom',
      setupFiles: ['./test-setup.ts'],
    },
  })
);
