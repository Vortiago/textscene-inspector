/** Godot 4.6.3's PrimitiveMesh facts: the lightmap texel size its UV2 padding is measured in. */

/** `rendering/lightmapping/primitive_meshes/texel_size`'s default (`servers/rendering/rendering_server.cpp:3821`). */
export const DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE = 0.2;

/**
 * The texel size a PrimitiveMesh keeps from the project setting: one at or below zero becomes the
 * default (`scene/resources/3d/primitive_meshes.cpp:346-352,364-369`).
 */
export function primitiveMeshTexelSize(setting: number): number {
  return setting <= 0 ? DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE : setting;
}
