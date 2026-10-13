/** What a sky's layer bake asks of a filter, so one bake runs either of Godot's two filters. */

import type { OctDirection } from '../../godot/octmap.js';
import { SKY_RADIANCE_SIZE_DEFAULT, skyOctmapLayout } from '../../godot/skyReflection.js';
import type { Octmap } from './octmapImage.js';

/**
 * The layout of the radiance octmap both filters' chains start from. Godot lays out a real-time sky
 * at `REAL_TIME_SIZE`, 256, and the layout depends on `Sky.radiance_size` only through the chain's
 * length, as the last mip is 10 texels wide at every size. So the default size stands for every sky.
 */
export const RADIANCE_LAYOUT = skyOctmapLayout(SKY_RADIANCE_SIZE_DEFAULT);

export interface LayerFilter {
  /** The width of each mip of the chain it reads, downsampled from the radiance. */
  chainSizes: readonly number[];
  /** Writes radiance layer `layer`'s colour at `normal` to `out`, read from `mips`, the chain. */
  texel(normal: OctDirection, mips: readonly Octmap[], layer: number, out: Float32Array): void;
}
