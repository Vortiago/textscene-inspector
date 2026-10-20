/**
 * Godot 4.6.3's PrimitiveMesh facts: the lightmap texel size its UV2 padding is measured in, and the
 * scale that pads a UV2 made from UV.
 */

import { storedReal } from '../math/real.js';

/** `rendering/lightmapping/primitive_meshes/texel_size`'s default (`servers/rendering/rendering_server.cpp:3821`). */
export const DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE = 0.2;

/**
 * The texel size a PrimitiveMesh keeps from the project setting: one at or below zero becomes the
 * default (`scene/resources/3d/primitive_meshes.cpp:346-352,364-369`).
 */
export function primitiveMeshTexelSize(setting: number): number {
  return setting <= 0 ? DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE : setting;
}

/** The texture size `get_uv2_scale` assumes on an axis with no lightmap size hint (`primitive_meshes.cpp:41`). */
const PADDING_REF_SIZE = 1024;

/**
 * `PrimitiveMesh::get_uv2_scale` on one axis (`primitive_meshes.cpp:329-341`): one less the padding
 * over the axis's lightmap size hint, in texels, in single precision. A zero hint measures against
 * 1024 texels.
 */
export function primitiveMeshUv2Scale(uv2Padding: number, lightmapSize: number): number {
  return storedReal(1 - storedReal(uv2Padding / (lightmapSize === 0 ? PADDING_REF_SIZE : lightmapSize)));
}
