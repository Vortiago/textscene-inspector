/**
 * The properties every PrimitiveMesh inherits and applies after its own builder. Defaults:
 * `scene/resources/3d/primitive_meshes.h:56-59`. No setter clamps them (`primitive_meshes.cpp:299-327`).
 */

import { isEqualApprox } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { boolOr, floatOr } from '../../../parser/valueParsers.js';

const DEFAULT_UV2_PADDING = 2;

export interface PrimitiveMeshProperties {
  flipFaces: boolean;
  addUv2: boolean;
  /** In lightmap texels, which the project's texel size turns into world units. */
  uv2Padding: number;
}

export function decodePrimitiveMesh(properties: Record<string, string>): PrimitiveMeshProperties {
  return {
    flipFaces: boolOr(properties.flip_faces, false, 'PrimitiveMesh flip_faces'),
    addUv2: boolOr(properties.add_uv2, false, 'PrimitiveMesh add_uv2'),
    uv2Padding: storedUv2Padding(
      floatOr(properties.uv2_padding, DEFAULT_UV2_PADDING, 'PrimitiveMesh uv2_padding')
    ),
  };
}

/** `set_uv2_padding` ignores a value `is_equal_approx` to the default it starts from (`primitive_meshes.cpp:320-327`). */
function storedUv2Padding(padding: number): number {
  return isEqualApprox(padding, DEFAULT_UV2_PADDING) ? DEFAULT_UV2_PADDING : storedReal(padding);
}
