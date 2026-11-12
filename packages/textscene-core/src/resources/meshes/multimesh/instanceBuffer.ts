/**
 * The instances of a MultiMesh as a draw reads them: a column-major matrix, a colour and the
 * custom data for each drawn instance. No THREE.
 */

import { MultiMeshTransformFormat } from '../../../godot/scene/multiMesh.js';
import { TRANSFORM_FLOATS, type DrawnInstances } from './types.js';

/** Floats in the buffer's 2D transform: the x row and the y row, each with its origin component. */
const TRANSFORM_2D_FLOATS = 8;

const MATRIX_FLOATS = 16;
const VEC4_FLOATS = 4;

/** The colour of an instance of a MultiMesh with no `use_colors`: the vertex colour stays as it is. */
const NO_COLOUR = [1, 1, 1, 1] as const;

/** The values of `count` instances, as the attributes of a draw hold them. */
export interface InstanceArrays {
  count: number;
  /** `MATRIX_FLOATS` for each instance, in the order three reads a `Matrix4`. */
  matrices: Float32Array;
  /** Four floats for each instance. */
  colours: Float32Array;
  /** Four floats for each instance: `INSTANCE_CUSTOM`. */
  customs: Float32Array;
}

/**
 * The first `drawn.count` instances of `drawn.buffer`. The shader reads each transform as rows and
 * completes a 2D one with the row (0, 0, 1, 0) (`scene_forward_clustered.glsl:316-318`).
 */
export function multiMeshInstanceArrays(drawn: DrawnInstances): InstanceArrays {
  const { count, buffer, usesColors, usesCustomData } = drawn;
  const is3D = drawn.transformFormat === MultiMeshTransformFormat.TRANSFORM_3D;
  const transformFloats = is3D ? TRANSFORM_FLOATS : TRANSFORM_2D_FLOATS;
  const colourFloats = usesColors ? VEC4_FLOATS : 0;
  const stride = transformFloats + colourFloats + (usesCustomData ? VEC4_FLOATS : 0);
  const matrices = new Float32Array(count * MATRIX_FLOATS);
  const colours = new Float32Array(count * VEC4_FLOATS);
  const customs = new Float32Array(count * VEC4_FLOATS);
  for (let i = 0; i < count; i++) {
    const at = i * stride;
    writeMatrix(matrices.subarray(i * MATRIX_FLOATS, (i + 1) * MATRIX_FLOATS), buffer, at, is3D);
    const colour = colours.subarray(i * VEC4_FLOATS, (i + 1) * VEC4_FLOATS);
    if (usesColors) colour.set(buffer.subarray(at + transformFloats, at + transformFloats + VEC4_FLOATS));
    else colour.set(NO_COLOUR);
    if (usesCustomData) {
      const from = at + transformFloats + colourFloats;
      customs.set(buffer.subarray(from, from + VEC4_FLOATS), i * VEC4_FLOATS);
    }
  }
  return { count, matrices, colours, customs };
}

/** Row `r` of the transform at `at` becomes the matrix's row `r`: element (r, c) lands at `c * 4 + r`. */
function writeMatrix(matrix: Float32Array, buffer: Float32Array, at: number, is3D: boolean): void {
  const rows = is3D ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < 4; column++) matrix[column * 4 + row] = buffer[at + row * 4 + column]!;
  }
  // The row a 2D transform lacks, and the bottom row of every matrix.
  if (!is3D) matrix[10] = 1;
  matrix[15] = 1;
}
