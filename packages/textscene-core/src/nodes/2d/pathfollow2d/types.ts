/** PathFollow2D — positions its children along the parent Path2D's curve. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface PathFollow2DProperties extends Node2DProperties {
  /** Absolute distance along the curve, pixels. Undefined when unset. */
  progress?: number;
  /** Fraction along the curve, 0..1. Takes precedence over `progress`. Undefined when unset. */
  progress_ratio?: number;
  /** Offset along the curve tangent, pixels (Godot default 0). */
  h_offset: number;
  /** Offset perpendicular to the curve, pixels (Godot default 0). */
  v_offset: number;
  /** Rotate children to face the curve tangent (Godot default true). */
  rotates: boolean;
  /** Cubic vs linear interpolation between baked points (Godot default true). */
  cubic_interp: boolean;
  /** Wrap progress past the curve ends (Godot default true). */
  loop: boolean;
}
