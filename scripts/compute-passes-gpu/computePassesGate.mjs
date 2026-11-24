#!/usr/bin/env node
import { runGpuGate } from '../gpuGate.mjs';
import { computePassFailures } from './computePassChecks.mjs';

await runGpuGate({
  name: 'compute-passes-gpu',
  harness: 'computePassesGpu',
  root: import.meta.dirname,
  entry: 'computePassSamples',
  failuresOf: computePassFailures,
});
