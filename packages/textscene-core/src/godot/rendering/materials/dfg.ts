/**
 * Godot's DFG table, the split-sum weights of a reflection. An indirect specular weighs its light by
 * `(f90 - f0) * fresnel + f0 * total`, and Godot scales every specular by `1 + f0 * (1 / total - 1)`
 * for the light that scatters more than once (`scene_forward_clustered.glsl:2224-2231`).
 */

import { DFG_SIZE, DFG_TABLE_BASE64 } from './dfgTable.generated.js';
import { decodeBase64Bytes } from '../../variant/packedBytes.js';

export { DFG_SIZE };

/**
 * The table as the half floats Godot stores it in: `[fresnel, total]` per texel, a row per
 * roughness and a column per N.V, each at its texel's centre. A read at `(NdotV, roughness)` is
 * Godot's read.
 */
export function dfgHalfFloats(): Uint16Array {
  const bytes = decodeBase64Bytes(DFG_TABLE_BASE64);
  const halfFloats = new Uint16Array(bytes.length / 2);
  for (let i = 0; i < halfFloats.length; i += 1) {
    halfFloats[i] = bytes[i * 2]! | (bytes[i * 2 + 1]! << 8);
  }
  return halfFloats;
}
