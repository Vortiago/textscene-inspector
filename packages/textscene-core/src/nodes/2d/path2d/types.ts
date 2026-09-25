/** The Path2D property shape: a Node2D holding a Curve2D, drawn as a polyline gizmo. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface Path2DProperties extends Node2DProperties {
  /** Raw `SubResource("…")` / `ExtResource("…")` reference to the Curve2D. */
  curve?: string;
}
