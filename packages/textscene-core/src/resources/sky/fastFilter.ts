/** The fast filter of a real-time sky (`octmap_filter.glsl:94-217`), Godot's precomputed taps per layer. */

import {
  FAST_FILTER_COEFFICIENTS,
  type FastFilterCoefficients,
} from '../../godot/skyFastFilterCoefficients.js';
import {
  FAST_FILTER_CHAIN_SIZES,
  REAL_TIME_RADIANCE_SIZE,
  REAL_TIME_ROUGHNESS_LAYERS,
  skyOctmapLayout,
} from '../../godot/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { FAST_FILTER_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { setUniforms, skyPass } from './skyPass.js';

type FastTaps = Record<keyof FastFilterCoefficients, Float32Array>;

/** Written only by `fastTapsOf`, the first time a level bakes. */
const fastTapsByLevel = new Map<number, FastTaps>();

const fastFilterPass = skyPass(FAST_FILTER_FRAGMENT_SHADER, [
  ...LAYER_FILTER_UNIFORMS,
  'tapX',
  'tapY',
  'tapZ',
  'tapLod',
  'tapWeight',
]);

/** Godot lays out a real-time sky at `REAL_TIME_SIZE` (`sky.h:248`), and its chain is 160 wide. */
export const fastFilter: LayerFilter = {
  layout: skyOctmapLayout(REAL_TIME_RADIANCE_SIZE),
  chainSizes: FAST_FILTER_CHAIN_SIZES,
  pass: fastFilterPass,
  /**
   * Layer `n` takes the table's level `n - 1`, as Godot filters layers 1 to 6 into its outputs 0 to
   * 5 (`sky.cpp:410-411`, `octmap_filter.glsl:80`). A layer past the last reads the last, as the
   * scene shader's array read clamps to the layers a real-time sky has.
   */
  selectLayer(layer) {
    const taps = fastTapsOf(Math.min(layer, REAL_TIME_ROUGHNESS_LAYERS - 1) - 1);
    setUniforms(fastFilterPass, {
      tapX: taps.frameX,
      tapY: taps.frameY,
      tapZ: taps.frameZ,
      tapLod: taps.lod,
      tapWeight: taps.weight,
    });
  },
};

/** Level `level` of Godot's table, flattened as the shader's `vec4` arrays read it. */
function fastTapsOf(level: number): FastTaps {
  let taps = fastTapsByLevel.get(level);
  if (taps) return taps;
  const coefficients = FAST_FILTER_COEFFICIENTS[level];
  if (!coefficients) throw new Error(`expected a level of the fast filter's table, got ${level}`);
  const { frameX, frameY, frameZ, lod, weight } = coefficients;
  taps = {
    frameX: Float32Array.from(frameX.flat()),
    frameY: Float32Array.from(frameY.flat()),
    frameZ: Float32Array.from(frameZ.flat()),
    lod: Float32Array.from(lod.flat()),
    weight: Float32Array.from(weight.flat()),
  };
  fastTapsByLevel.set(level, taps);
  return taps;
}
