/**
 * Godot's DFG table, the split-sum weights of a reflection. An indirect specular weighs its light by
 * `(f90 - f0) * fresnel + f0 * total`, and Godot scales every specular by `1 + f0 * (1 / total - 1)`
 * for the light that scatters more than once (`scene_forward_clustered.glsl:2224-2231`).
 */

import { DFG_SHAPE, DFG_TABLE_RESIDUALS } from './dfgTable.generated.js';
import { fromResiduals } from '../tableResiduals.js';

/**
 * The table as the half floats Godot stores it in: `[fresnel, total]` per texel, a row per
 * roughness and a column per N.V, each at its texel's centre. A read at `(NdotV, roughness)` is
 * Godot's read.
 */
export function dfgHalfFloats(): Uint16Array {
  return fromResiduals(DFG_TABLE_RESIDUALS, DFG_SHAPE, new Uint16Array(DFG_TABLE_RESIDUALS.length));
}
