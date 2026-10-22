/** VisibleOnScreenNotifier3D types. The notifier reports whether `aabb`, in its local space, is on screen. */

import type { Aabb } from '../../../godot/math/aabb';
import type { Node3DProperties } from '../../base/node3d/types';

export interface VisibleOnScreenNotifier3DProperties extends Node3DProperties {
  /** The box the notifier watches and its gizmo outlines. */
  aabb: Aabb;
}
