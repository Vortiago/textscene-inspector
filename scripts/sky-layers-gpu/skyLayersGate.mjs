#!/usr/bin/env node
/** `pnpm test:gpu`: bakes the sky's layers with the real passes in headless Chromium and checks what they wrote. */
import { runGpuGate } from '../gpuGate.mjs';
import { skyLayerFailures } from './skyLayerChecks.mjs';

await runGpuGate({
  name: 'sky-layers-gpu',
  harness: 'skyLayersGpu',
  root: import.meta.dirname,
  entry: 'skyLayerSamples',
  failuresOf: skyLayerFailures,
});
