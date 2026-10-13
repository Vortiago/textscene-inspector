/**
 * Godot's fast filter, which bakes a real-time sky's layers (`octmap_filter.glsl`): eight taps
 * from a coefficient table, in each of up to three frames around the direction, blended by how near
 * the direction lies to each frame's axis. Godot's texture-array path runs it, with no lod offset.
 */

import { vec3ToOctWithBorder, type OctDirection } from '../../godot/octmap.js';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/skyFastFilterCoefficients.js';
import { FAST_FILTER_CHAIN_SIZES, REAL_TIME_ROUGHNESS_LAYERS } from '../../godot/skyReflection.js';
import { frameAround } from './frame.js';
import { RADIANCE_LAYOUT, type LayerFilter } from './layerFilter.js';
import { addTrilinear, type Octmap } from './octmapImage.js';

const { abs, max, min } = Math;

/** 1 / sqrt(3): a frame weighs nothing where its axis is no nearer the direction than the others (`:97-98`). */
const FRAME_LOWER_BOUND = 0.57735;

/** Each frame's up axis, and the two other axes that weigh it (`:95-96`, `:101-112`). */
const FRAMES: readonly { up: OctDirection; others: readonly [number, number] }[] = [
  { up: [1, 0, 0], others: [1, 2] },
  { up: [0, 1, 0], others: [0, 2] },
  { up: [0, 0, 1], others: [0, 1] },
];

/** NUM_TAPS / 4 with the low-quality table's eight taps a frame (`:42-46`, `:155`). */
const SUPER_TAPS_PER_FRAME = 2;

const SUB_TAPS = 4;

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
  for (let axis = 0; axis < FRAMES.length; axis += 1) {
    const { up, others } = FRAMES[axis]!;
    const frameWeight =
      (max(abs(normal[others[0]]!), abs(normal[others[1]]!)) - FRAME_LOWER_BOUND) / (1 - FRAME_LOWER_BOUND);
    if (frameWeight <= 0) continue;
    frameAround(up, normal, frameX, frameY);
    for (let index = axis * SUPER_TAPS_PER_FRAME; index < (axis + 1) * SUPER_TAPS_PER_FRAME; index += 1) {
      for (let sub = 0; sub < SUB_TAPS; sub += 1) {
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
