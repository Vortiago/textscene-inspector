/** The fast filter of a real-time sky (`octmap_filter.glsl:94-217`), Godot's precomputed taps per layer. */

import {
  FAST_FILTER_COEFFICIENTS,
  type FastFilterCoefficients,
} from '../../godot/rendering/environment/skyFastFilterCoefficients.js';
import {
  FAST_FILTER_CHAIN_SIZES,
  REAL_TIME_RADIANCE_SIZE,
  REAL_TIME_ROUGHNESS_LAYERS,
  skyOctmapLayout,
} from '../../godot/rendering/environment/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { FAST_FILTER_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { skyPass } from './skyPass.js';
import { perRenderer } from '../../r3f/perRenderer.js';

/** Each level of Godot's table, its parts flattened as the shader's `vec4` arrays of the same names read them. */
const tapsByLevel = FAST_FILTER_COEFFICIENTS.map(
  (level) =>
    Object.fromEntries(
      Object.entries(level).map(([part, values]) => [part, Float32Array.from((values as number[][]).flat())])
    ) as Record<keyof FastFilterCoefficients, Float32Array>
);

const fastFilterPassFor = perRenderer(() =>
  skyPass(FAST_FILTER_FRAGMENT_SHADER, [
    ...LAYER_FILTER_UNIFORMS,
    'frameX',
    'frameY',
    'frameZ',
    'lod',
    'weight',
  ])
);

export const fastFilter: LayerFilter = {
  /** Godot lays out a real-time sky at `REAL_TIME_SIZE` (`sky.h:248`), and its chain is 160 wide. */
  layout: skyOctmapLayout(REAL_TIME_RADIANCE_SIZE),
  chainSizes: FAST_FILTER_CHAIN_SIZES,
  passFor: fastFilterPassFor,
  /**
   * Layer `n` takes the table's level `n - 1`, as Godot filters layers 1 to 6 into its outputs 0 to
   * 5 (`sky.cpp:410-411`, `octmap_filter.glsl:80`). A layer past the last reads the last, as the
   * scene shader's array read clamps to the layers a real-time sky has.
   */
  layerUniforms(layer) {
    const level = Math.min(layer, REAL_TIME_ROUGHNESS_LAYERS - 1) - 1;
    const taps = tapsByLevel[level];
    if (!taps) throw new Error(`expected a level of the fast filter's table, got ${level}`);
    return taps;
  },
};
