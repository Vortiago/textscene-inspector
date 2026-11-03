/** RayCast3D property surface. Each key stays `undefined` when unauthored, so the consumer applies Godot's default. */

import type { Rgba } from '../../../../godot/math/math.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import type { Node3DProperties } from '../../../base/node3d/types';

export { DEFAULT_ENABLED, DEFAULT_TARGET_POSITION } from '../../shared/castTarget';

/** `_debug_shape_thickness = 2` in scene/3d/physics/ray_cast_3d.h:57, which fills the pyramid gizmo. */
export const DEFAULT_DEBUG_SHAPE_THICKNESS = 2;

export interface RayCast3DProperties extends Node3DProperties {
  /** Whether the ray casts each frame. Godot default true. */
  enabled?: boolean;
  /** The ray's end, in the node's space. Godot default Vector3(0, -1, 0). */
  target_position?: Vector3;
  /** The pyramid gizmo's width grade, 1 to 5. Godot default 2, which fills a ring `thickness / 100` m across. */
  debug_shape_thickness?: number;
  /** `debug_shape_custom_color`, an sRGB Color. Godot's `Color(0, 0, 0)` default reads the project collision colour. */
  debug_shape_custom_color?: Rgba;
}
