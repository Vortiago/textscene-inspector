/** NavigationPolygon slice types. */

export interface NavigationPolygonData {
  /**
   * Region-local vertices in raw Godot 2D space (+Y **down**), flat
   * `[x0, y0, x1, y1, …]`. The render adapter owns the Y negation.
   */
  vertices: Float32Array;
  /** Per-polygon vertex-index loops, each with at least three in-range indices. */
  polygons: number[][];
}
