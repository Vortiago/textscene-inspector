import type { GpuSpread } from './frameStats.js';

/**
 * The median and the 10th and 90th percentiles of `ms` by nearest rank, or null for no frames.
 * @canonical spread of frame times
 * `pnpm ref:godot --gpu-time` reports Godot's passes with it too, so the two compare.
 */
export function spreadOfMs(ms: readonly number[]): GpuSpread | null {
  if (ms.length === 0) return null;
  const sorted = [...ms].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.round(fraction * (sorted.length - 1))]!;
  return { medianMs: at(0.5), lowMs: at(0.1), highMs: at(0.9) };
}
