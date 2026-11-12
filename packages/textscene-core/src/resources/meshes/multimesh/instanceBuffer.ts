/**
 * The instances of a MultiMesh as a draw reads them: a column-major matrix, a colour and the
 * custom data for each drawn instance. No THREE.
 */

import { MultiMeshTransformFormat } from '../../../godot/scene/multiMesh.js';
import { instanceLayout, MATRIX_FLOATS, VEC4_FLOATS, type DrawnInstances } from './types.js';

/** The colour of an instance of a MultiMesh with no `use_colors`: the vertex colour stays as it is. */
const NO_COLOUR = [1, 1, 1, 1] as const;

/** The values of `count` instances, as the attributes of a draw hold them. */
export interface InstanceArrays {
  /** `MATRIX_FLOATS` for each instance, in the order three reads a `Matrix4`. */
  matrices: Float32Array;
  /** `VEC4_FLOATS` for each instance. */
  colours: Float32Array;
  /** `VEC4_FLOATS` for each instance: `INSTANCE_CUSTOM`. */
  customs: Float32Array;
}

/**
 * The first `drawn.count` instances of `drawn.buffer`. The shader reads each transform as rows and
 * completes a 2D one with the row (0, 0, 1, 0) (`scene_forward_clustered.glsl:316-318`).
 */
export function multiMeshInstanceArrays(drawn: DrawnInstances): InstanceArrays {
  const { count, usesColors, usesCustomData } = drawn;
  const is3D = drawn.transformFormat === MultiMeshTransformFormat.TRANSFORM_3D;
  const { stride, colourOffset, customOffset } = instanceLayout(is3D, usesColors, usesCustomData);
  const buffer = drawn.buffer ?? new Float32Array(count * stride);
  const matrices = new Float32Array(count * MATRIX_FLOATS);
  const colours = new Float32Array(count * VEC4_FLOATS);
  const customs = new Float32Array(count * VEC4_FLOATS);
  for (let i = 0; i < count; i++) {
    const at = i * stride;
    writeMatrix(matrices, i * MATRIX_FLOATS, buffer, at, is3D);
    if (usesColors)
      colours.set(buffer.subarray(at + colourOffset, at + colourOffset + VEC4_FLOATS), i * VEC4_FLOATS);
    else colours.set(NO_COLOUR, i * VEC4_FLOATS);
    if (usesCustomData)
      customs.set(buffer.subarray(at + customOffset, at + customOffset + VEC4_FLOATS), i * VEC4_FLOATS);
  }
  return { matrices, colours, customs };
}

/** Row `r` of the transform at `at` becomes the matrix's row `r`: element (r, c) lands at `c * 4 + r`. */
function writeMatrix(
  matrices: Float32Array,
  to: number,
  buffer: Float32Array,
  at: number,
  is3D: boolean
): void {
  const rows = is3D ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < 4; column++)
      matrices[to + column * 4 + row] = buffer[at + row * 4 + column]!;
  }
  // The row a 2D transform lacks, and the bottom row of every matrix.
  if (!is3D) matrices[to + 10] = 1;
  matrices[to + 15] = 1;
}
