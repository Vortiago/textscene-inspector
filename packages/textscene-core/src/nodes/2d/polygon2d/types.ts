/** Polygon2D — a filled 2D polygon (extends Node2D). */

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
   * outline points. Godot drops them ONLY when `polygons` is empty.
   */
  internalVertexCount: number;
  /** Fill the grown bounding box with the polygon punched out (default false). */
  invertEnabled: boolean;
  /** Padding added to the bounds when inverted, in pixels (default 100). */
  invertBorder: number;
  /**
   * `ExtResource("id")` / `SubResource("id")` texture reference. Captured for
   * the inspector and linter; the textured/`uv` mapping is deferred — the node
   * renders its flat-colored fill (see Component).
   */
  texture?: string;
}
