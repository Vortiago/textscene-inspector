/**
 * Godot's fast filter, which bakes a real-time sky's layers (`octmap_filter.glsl`): eight taps
 * from a coefficient table, in each of up to three frames around the direction, blended by how near
 * the direction lies to each frame's axis. Godot's texture-array path runs it, with no lod offset.
 */

import { vec3ToOctWithBorder, type OctDirection } from '../../godot/octmap.js';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/skyFastFilterCoefficients.js';
import {
  FAST_FILTER_CHAIN_SIZES,
  FAST_FILTER_FRAMES,
  FAST_FILTER_FRAME_LOWER_BOUND,
  FAST_FILTER_SUB_TAPS,
  FAST_FILTER_SUPER_TAPS_PER_FRAME,
  REAL_TIME_ROUGHNESS_LAYERS,
} from '../../godot/skyReflection.js';
import { frameAround } from './frame.js';
import { RADIANCE_LAYOUT, type LayerFilter } from './layerFilter.js';
import { addTrilinear, type Octmap } from './octmapImage.js';

const { abs, max, min } = Math;

/** Scratch, written only by `texel`: the frame's axes, and the UV of the tap it reads next. */
const frameX = new Float64Array(3);
const frameY = new Float64Array(3);
const tapUv = new Float64Array(2);

export const fastFilter: LayerFilter = {
  chainSizes: FAST_FILTER_CHAIN_SIZES,
  texel,
};

/**
 * Writes layer `layer` at `normal`. A layer past the last reads the last, as the scene shader's
 * array read clamps to the layers a real-time sky has. Layer `n` takes the table's level `n - 1`,
 * as Godot filters layers 1 to 6 into its outputs 0 to 5 (`sky.cpp:410-411`, `octmap_filter.glsl:80`).
 */
function texel(normal: OctDirection, mips: readonly Octmap[], layer: number, out: Float32Array): void {
  const coefficients = FAST_FILTER_COEFFICIENTS[min(layer, REAL_TIME_ROUGHNESS_LAYERS - 1) - 1]!;
  out.fill(0);
  let total = 0;
  for (let axis = 0; axis < FAST_FILTER_FRAMES.length; axis += 1) {
    const { up, others } = FAST_FILTER_FRAMES[axis]!;
    const nearest = max(abs(normal[others[0]]!), abs(normal[others[1]]!));
    const frameWeight = (nearest - FAST_FILTER_FRAME_LOWER_BOUND) / (1 - FAST_FILTER_FRAME_LOWER_BOUND);
    if (frameWeight <= 0) continue;
    frameAround(up, normal, frameX, frameY);
    const firstTap = axis * FAST_FILTER_SUPER_TAPS_PER_FRAME;
    for (let index = firstTap; index < firstTap + FAST_FILTER_SUPER_TAPS_PER_FRAME; index += 1) {
      for (let sub = 0; sub < FAST_FILTER_SUB_TAPS; sub += 1) {
        const x = coefficients.frameX[index]![sub]!;
        const y = coefficients.frameY[index]![sub]!;
        const z = coefficients.frameZ[index]![sub]!;
        vec3ToOctWithBorder(
          frameX[0]! * x + frameY[0]! * y + normal[0] * z,
          frameX[1]! * x + frameY[1]! * y + normal[1] * z,
          frameX[2]! * x + frameY[2]! * y + normal[2] * z,
          RADIANCE_LAYOUT.padding,
          tapUv
        );
        const weight = coefficients.weight[index]![sub]! * frameWeight;
        addTrilinear(mips, tapUv[0]!, tapUv[1]!, coefficients.lod[index]![sub]!, weight, out);
        total += weight;
      }
    }
  }
  for (let channel = 0; channel < 3; channel += 1) out[channel] = max(0, out[channel]! / total);
}
