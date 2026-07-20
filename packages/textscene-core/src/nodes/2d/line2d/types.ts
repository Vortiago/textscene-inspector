/** Line2D — a stroked polyline drawn as mesh quads (extends Node2D). */

import type { Color, Node2DProperties } from '../../base/node2d/types';

export interface Line2DProperties extends Node2DProperties {
  /** Flat `[x0,y0,x1,y1,…]` Float32Array from a PackedVector2Array. Empty (< 2 vertices) → nothing to draw. */
  points: Float32Array;
  /** Stroke width in Godot pixels (default 10). */
  width: number;
  /** Flat fill color (Godot `default_color`, sRGB; default white). Multiplies with modulate. */
  defaultColor: Color;
  /**
   * Whether to close the polyline back to the first vertex (default false).
   * When closed, one extra quad is emitted from last point → first point.
   */
  closed: boolean;
  /**
   * Corner style. Godot has no "no joint" value — `LINE_JOINT_SHARP` (0) is the
   * default, so interior corners are ALWAYS filled.
   */
  jointMode: number;
  /** Miter length limit in half-widths before SHARP bevels. Default 2.0. */
  sharpLimit: number;
  /** Triangles per ROUND joint. Default 8. */
  roundPrecision: number;
}
