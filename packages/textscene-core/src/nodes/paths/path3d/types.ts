/** Path3D — a Node3D holding a Curve3D, drawn as a polyline gizmo. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface Path3DProperties extends Node3DProperties {
  /** Raw `SubResource("…")` / `ExtResource("…")` reference to the Curve3D. */
  curve?: string;
}
