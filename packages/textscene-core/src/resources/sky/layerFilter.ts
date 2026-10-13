/** What a sky's layer bake asks of a filter, so one bake runs either of Godot's two filters. */

import type { OctDirection } from '../../godot/octmap.js';
import type { SkyOctmapLayout } from '../../godot/skyReflection.js';
import type { Octmap } from './octmapImage.js';

export interface LayerFilter {
  /** The layout of the radiance octmap the chain starts from. */
  layout: SkyOctmapLayout;
  /** The width of each mip of the chain it reads, downsampled from the radiance. */
  chainSizes: readonly number[];
  /** Writes radiance layer `layer`'s colour at `normal` to `out`, read from `mips`, the chain. */
  texel(normal: OctDirection, mips: readonly Octmap[], layer: number, out: Float32Array): void;
}
