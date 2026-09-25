/** ArrayMesh decoded data: one entry per decodable surface. */

/** One decoded mesh surface. Every surface here is a TRIANGLES primitive. */
export interface ArrayMeshSurface {
  /**
   * The surface's position in the mesh's `_surfaces` array, not in this one,
   * which skips undecodable surfaces. `surface_material_override/N` names it.
   */
  surfaceIndex: number;
  /**
   * Godot Mesh.ArrayFormat bitfield (uint64, fits in a JS number ≤ 2^53): the
   * byte layout the surface was read under, which a diagnostic about a
   * mis-sized buffer quotes.
   */
  format: number;
  vertexCount: number;
  indexCount: number;
  /** Vertex positions, `vertexCount × 3` (x, y, z). */
  positions: Float32Array;
  /** UV1, `vertexCount × 2`, or undefined when the surface has no TEX_UV. */
  uvs?: Float32Array;
  /** Per-vertex normals `vertexCount × 3`, or undefined when the surface has none. */
  normals?: Float32Array;
  /** Triangle indices, width auto-detected (uint16 ≤ 65535 verts, else uint32). */
  indices: Uint16Array | Uint32Array;
  /** Resolved `res://` path of the surface's material, if it has one. */
  materialPath?: string;
  /**
   * For a mesh inlined in a scene: the id of the scene's `[sub_resource]`
   * material, which no resource path addresses, so the renderer resolves it
   * against the scene's resources. Never set for a mesh from a `.tres`, whose
   * sub-resource materials are addressable.
   */
  materialSubResourceId?: string;
}

export interface ArrayMeshData {
  surfaces: ArrayMeshSurface[];
}
