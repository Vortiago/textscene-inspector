/**
 * The properties every PrimitiveMesh inherits and applies after its own builder. Defaults:
 * `scene/resources/3d/primitive_meshes.h:56-59`. No setter clamps them (`primitive_meshes.cpp:299-327`).
 */

import { boolOr, floatOr } from '../../../parser/valueParsers.js';

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
    uv2Padding: floatOr(properties.uv2_padding, 2, 'PrimitiveMesh uv2_padding'),
  };
}
