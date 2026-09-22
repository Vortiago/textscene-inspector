/** ArrayMesh decoded data — one entry per decodable surface. */

/** One decoded mesh surface. Every surface here is a TRIANGLES primitive. */
export interface ArrayMeshSurface {
  /**
   * The surface's position in the mesh's `_surfaces` array. Not the position in
   * THIS array, which is compacted by undecodable surfaces — it is the index
   * `surface_material_override/N` names, so it has to survive the compaction.
   */
  surfaceIndex: number;
  /**
   * Godot Mesh.ArrayFormat bitfield (uint64, fits in a JS number ≤ 2^53).
   * Kept because it names the byte layout a surface was read under, which is
   * what any diagnostic about a mis-sized buffer has to quote.
   */
  format: number;
  vertexCount: number;
  indexCount: number;
  /** Vertex positions, `vertexCount × 3` (x, y, z). */
  positions: Float32Array;
  /** UV1, `vertexCount × 2`; undefined when the surface has no TEX_UV. */
  uvs?: Float32Array;
  /** Per-vertex normals `vertexCount × 3`; undefined when the surface has none. */
  normals?: Float32Array;
  /** Triangle indices; width auto-detected (uint16 ≤ 65535 verts, else uint32). */
  indices: Uint16Array | Uint32Array;
  /** Resolved `res://` path of the surface's material, if it has one. */
  materialPath?: string;
  /**
   * For a mesh inlined in a SCENE: the id of the scene's own `[sub_resource]`
   * material this surface names. No resource path can address a scene's
   * sub-resources, so the renderer resolves this against the scene resources it
   * already holds. Never set for a mesh read out of a `.tres`, whose own
   * sub-resource materials ARE addressable.
   */
  materialSubResourceId?: string;
}

export interface ArrayMeshData {
  surfaces: ArrayMeshSurface[];
}
