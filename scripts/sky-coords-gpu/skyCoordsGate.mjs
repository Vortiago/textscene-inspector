#!/usr/bin/env node
/** `pnpm test:gpu`: evaluates the sky's `SKY_COORDS` GLSL in headless Chromium and checks it against Godot's formulas. */
import { runGpuGate } from '../gpuGate.mjs';
import { skyCoordsFailures } from './skyCoordsChecks.mjs';

await runGpuGate({
  name: 'sky-coords-gpu',
  harness: 'skyCoordsGpu',
  root: import.meta.dirname,
  entry: 'skyCoordsSamples',
  failuresOf: skyCoordsFailures,
});
