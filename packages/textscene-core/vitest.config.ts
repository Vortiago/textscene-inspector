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
      // vmThreads builds happy-dom once per worker and keeps each file in its own VM context.
      // The default forks pool builds it once per file, which took 42% of the core run.
      pool: 'vmThreads',
      setupFiles: ['./test-setup.ts'],
    },
  })
);
