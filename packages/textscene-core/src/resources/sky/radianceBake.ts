import type { SkyBake } from './types';

/** Each doubling costs four times the bake. Metal balls under a 512 sky stay within 0.07/255 of Godot's. */
const LARGEST_RADIANCE_SIZE = 256;

/** The bake the previewer runs: an importance-sampled sky above `LARGEST_RADIANCE_SIZE` bakes at it. */
export function cappedBake(bake: SkyBake): SkyBake {
  if (bake.radianceFilter === 'fast') return bake;
  return {
    radianceFilter: 'importance-sample',
    radianceSize: Math.min(bake.radianceSize, LARGEST_RADIANCE_SIZE),
  };
}
