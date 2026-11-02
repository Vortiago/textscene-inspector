/**
 * `CollisionShape2D/3D.debug_color`, the colour Godot draws the shape in, and the cast nodes' debug
 * shape colour. The documented `Color(0, 0, 0, 0)` is a placeholder: `_validate_property` strips a
 * value equal to the project colour, so an absent key means that translucent teal.
 */

import { colorOr } from '../../../utils/colorParser';
import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import type { Rgba } from '../../../godot/math/math.js';

/**
 * ProjectSettings `debug/shapes/collision/shape_color` (class_projectsettings.html),
 * read by scene/3d/physics/collision_shape_3d.cpp `_get_default_debug_color()`
 * through `SceneTree::get_debug_collisions_color()`.
 */
export const DEFAULT_COLLISION_DEBUG_COLOR: Rgba = Object.freeze({
  r: 0,
  g: 0.6,
  b: 0.7,
  a: 0.42,
});

export function parseDebugColor(raw: string | undefined): Rgba {
  return colorOr(raw, DEFAULT_COLLISION_DEBUG_COLOR);
}

/**
 * The colour a cast node's gizmo material takes: the node's `debug_shape_custom_color`, or
 * the project collision colour when it is absent or equals Godot's empty default, whose literal
 * carries an alpha of 1 (`ray_cast_3d.cpp:489-492`, `shape_cast_3d.cpp:571-574`, `color.h:80`).
 *
 * @canonical A cast node's debug shape colour
 */
export function debugShapeColour(customColor: Rgba | undefined): Rgba {
  return customColor &&
    (customColor.r !== 0 || customColor.g !== 0 || customColor.b !== 0 || customColor.a !== 1)
    ? customColor
    : DEFAULT_COLLISION_DEBUG_COLOR;
}

/**
 * The shared `Color` grammar: 4 arguments (`variant_parser.cpp:914`), each a
 * plain float in any form `rtos_fix` writes (`:2145`). Both setters
 * (collision_shape_2d.cpp:235-241, collision_shape_3d.cpp:252-262) assign bare, and
 * PROPERTY_HINT_NONE (collision_shape_2d.cpp:296, collision_shape_3d.cpp:182) grounds no range.
 */
export const debugColorValidator: PropertyValidator = v.color('debug_color');
