#!/usr/bin/env node
/** `pnpm test:gpu`: draws decals through the real scene decals and programs in headless Chromium and checks the pixels. */
import { runGpuGate } from '../gpuGate.mjs';
import { decalFailures } from './decalChecks.mjs';

await runGpuGate({
  name: 'decal-gpu',
  harness: 'decalGpu',
  root: import.meta.dirname,
  entry: 'decalSamples',
  failuresOf: decalFailures,
});
