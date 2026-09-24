/**
 * `CollisionShape2D/3D.debug_color`, the colour Godot draws the shape in. The
 * documented `Color(0, 0, 0, 0)` is a placeholder: `_validate_property` strips a
 * value equal to the project colour, so an absent key means that translucent teal.
 */

import type { Color } from '../../../utils/colorParser';
import { colorOr } from '../../../utils/colorParser';
import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * ProjectSettings `debug/shapes/collision/shape_color` (class_projectsettings.html),
 * read by scene/3d/physics/collision_shape_3d.cpp `_get_default_debug_color()`
 * through `SceneTree::get_debug_collisions_color()`.
 */
export const DEFAULT_COLLISION_DEBUG_COLOR: Color = Object.freeze({
  r: 0,
  g: 0.6,
  b: 0.7,
  a: 0.42,
});

export function parseDebugColor(raw: string | undefined): Color {
  return colorOr(raw, DEFAULT_COLLISION_DEBUG_COLOR);
}

/**
 * The shared `Color` grammar: 4 arguments (`variant_parser.cpp:914`), each a
 * plain float in any form `rtos_fix` writes (`:2145`). Both setters
 * (collision_shape_2d.cpp:235-241, collision_shape_3d.cpp:252-262) assign bare, and
 * PROPERTY_HINT_NONE (collision_shape_2d.cpp:296, collision_shape_3d.cpp:182) grounds no range.
 */
export const debugColorValidator: PropertyValidator = v.color('debug_color');
