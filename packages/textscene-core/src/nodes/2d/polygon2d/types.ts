/** The Polygon2D property shape: a filled 2D polygon on Node2D. */

import type { Color, Node2DProperties, Vector2 } from '../../base/node2d/types';

export interface Polygon2DProperties extends Node2DProperties {
  /**
   * Outline vertices as a flat `[x0, y0, x1, y1, …]` Float32Array in Godot 2D
   * pixel space (+Y down). Empty (< 3 vertices) → nothing to fill.
   */
  polygon: Float32Array;
  /** Flat fill color (Godot `color`, sRGB; default white). Multiplies with modulate. */
  color: Color;
  /** Pixel offset added to every polygon vertex (default 0,0). */
  offset: Vector2;
  /**
   * Index lists into `polygon`, one per sub-polygon. When non-empty Godot
   * ignores the stored vertex order and fills each list separately.
   */
  polygons: number[][];
  /**
   * Trailing vertices of `polygon` that are UV/skinning helpers rather than
   * outline points. Godot drops them when `polygons` is empty or invert is on.
   */
  internalVertexCount: number;
  /** Fill the grown bounding box with the polygon punched out (default false). */
  invertEnabled: boolean;
  /** Padding added to the bounds when inverted, in pixels (default 100). */
  invertBorder: number;
  /** `ExtResource("id")` / `SubResource("id")` texture reference. */
  texture?: string;
  /**
   * Per-vertex texture coordinates in texel space (+Y down), flat
   * `[u0, v0, u1, v1, …]`. Godot pairs these with `polygon` only when the two
   * hold the same number of vertices; otherwise the point coordinates stand in.
   */
  uv: Float32Array;
  /**
   * Per-vertex fill colors as flat `[r, g, b, a, …]` in sRGB. Used only when
   * there is exactly one per vertex; otherwise the flat `color` applies.
   */
  vertexColors: Float32Array;
  /** Pixel offset folded into the UV transform (default 0,0). */
  textureOffset: Vector2;
  /** UV scale, applied to the rotated coordinate and to `textureOffset`. */
  textureScale: Vector2;
  /** UV rotation in radians, applied before the offset. */
  textureRotation: number;
}
