/** Line2D: a stroked polyline drawn as Godot's `LineBuilder` builds it (extends Node2D). */

import type { Node2DProperties } from '../../base/node2d/types';
import type { Rgba } from '../../../godot/math/math';

export interface Line2DProperties extends Node2DProperties {
  /** Flat `[x0,y0,x1,y1,…]` Float32Array from a PackedVector2Array. Empty (< 2 vertices) → nothing to draw. */
  points: Float32Array;
  /** Stroke width in Godot pixels (default 10). */
  width: number;
  /** Flat fill color (Godot `default_color`, sRGB, default white). Multiplies with modulate. */
  defaultColor: Rgba;
  /**
   * Whether to close the polyline back to the first vertex (default false).
   * A closed line of more than 2 points joins its last point to its first and ignores both caps.
   */
  closed: boolean;
  /**
   * Corner style. Godot has no "no joint" value: `LINE_JOINT_SHARP` (0) is the
   * default, so interior corners are always filled.
   */
  jointMode: number;
  /** Miter length limit in half-widths before SHARP bevels. Default 2.0. */
  sharpLimit: number;
  /** Triangles per ROUND joint. Default 8. */
  roundPrecision: number;
  /** `LineCapMode` of the first and the last point: NONE (0), BOX (1) or ROUND (2). Default NONE. */
  beginCapMode: number;
  endCapMode: number;
  /** The raw `gradient` reference, for `useReferencedResources` to resolve. With one set, `default_color` is ignored. */
  gradient: string | undefined;
  /** The raw `width_curve` reference. The curve scales `width` along the line. */
  widthCurve: string | undefined;
}
