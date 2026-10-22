/** ArrayMesh decoded data: one entry per decodable surface. */

/** One decoded mesh surface: a TRIANGLES primitive, or POINTS when `isPoints` is set. */
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
  /** UV2, `vertexCount × 2`, or undefined when the surface has no TEX_UV2. */
  uv2s?: Float32Array;
  /** Per-vertex normals `vertexCount × 3`, or undefined when the surface has none. */
  normals?: Float32Array;
  /** Per-vertex tangents `vertexCount × 4`, `w` the binormal sign, or undefined when the surface has none. */
  tangents?: Float32Array;
  /**
   * Three per triangle, or one per drawn point, in one width for every surface:
   * `godotSurfacesGeometry` copies them into the width the merged mesh needs.
   */
  indices: Uint32Array;
  /** Godot's `PRIMITIVE_POINTS`: one point per index. Absent for a triangle surface. */
  isPoints?: boolean;
  /** Resolved `res://` path of the surface's material, if it has one. */
  materialPath?: string;
  /**
   * For a mesh inlined in a scene: the surface's raw `"material"` reference, which
   * the renderer resolves against the scene's resources. Never set for a mesh from
   * a `.tres`, whose materials resolve to `materialPath`.
   */
  materialRef?: string;
}

export interface ArrayMeshData {
  surfaces: ArrayMeshSurface[];
}
