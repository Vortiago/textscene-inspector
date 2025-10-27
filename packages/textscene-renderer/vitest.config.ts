import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * Vitest configuration for tscn-renderer package
 * Extends the shared configuration from the root
 * Uses happy-dom environment for DOM API support (canvas, WebGL, etc.)
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'tscn-renderer',
      environment: 'happy-dom',
    },
  })
);
