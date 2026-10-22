import { getHeapStatistics } from 'node:v8';
import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

/**
 * A VM worker keeps every file's context until it passes `vmMemoryLimit`. The default limit is
 * 1 / maxWorkers of the machine's memory, which is above V8's heap limit of a worker thread on a
 * 16 GB, 4 CPU box (2240 MB against 5.3 GB). The worker then dies out of memory, with exit code 1,
 * before Vitest recycles it. 70% of the heap limit leaves room for the file that runs next.
 */
const WORKER_HEAP_SHARE_BEFORE_RECYCLE = 0.7;
const vmMemoryLimitMegabytes = Math.floor(
  (getHeapStatistics().heap_size_limit * WORKER_HEAP_SHARE_BEFORE_RECYCLE) / 1024 ** 2
);

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
      vmMemoryLimit: `${vmMemoryLimitMegabytes}MB`,
      setupFiles: ['./test-setup.ts'],
    },
  })
);
