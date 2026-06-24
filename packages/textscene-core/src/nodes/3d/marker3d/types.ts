/** Marker3D — a transform anchor drawn as a small 3-axis cross gizmo. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface Marker3DProperties extends Node3DProperties {
  /** Half-length of the cross gizmo arms, world units (Godot default 0.25). */
  gizmo_extents: number;
}
