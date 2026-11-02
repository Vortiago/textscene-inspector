/** ShapeCast3D property surface. Each key stays `undefined` when unauthored, so the consumer applies Godot's default. */

import type { Rgba } from '../../../../godot/math/math.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import type { Node3DProperties } from '../../../base/node3d/types';

export { DEFAULT_ENABLED, DEFAULT_TARGET_POSITION } from '../../shared/castTarget';

export interface ShapeCast3DProperties extends Node3DProperties {
  /** Whether the sweep casts each frame. Godot default true. */
  enabled?: boolean;
  /** The swept `Shape3D`'s reference, as the file authors it. Godot default null. */
  shape?: string;
  /** The sweep's end, in the node's space. Godot default Vector3(0, -1, 0). */
  target_position?: Vector3;
  /** `debug_shape_custom_color`, an sRGB Color. Godot's `Color(0, 0, 0)` default reads the project collision colour. */
  debug_shape_custom_color?: Rgba;
}
