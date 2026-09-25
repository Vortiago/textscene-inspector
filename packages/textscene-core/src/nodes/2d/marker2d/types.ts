/** Marker2D: a transform anchor drawn as a small editor cross gizmo. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface Marker2DProperties extends Node2DProperties {
  /** Half-length of the cross gizmo arms, pixels (Godot default 10). */
  gizmo_extents: number;
}
