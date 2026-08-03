/** NavigationMesh slice types. */

export interface NavigationMeshData {
  /**
   * Vertices in Godot 3D space, flat `[x0, y0, z0, x1, y1, z1, …]`. Godot 3D is
   * right-handed Y-up like three.js, so these need no conversion.
   */
  vertices: Float32Array;
  /** Per-polygon vertex-index loops, each with at least three in-range indices. */
  polygons: number[][];
}
