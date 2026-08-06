/**
 * `CollisionShape2D/3D.debug_color` — the colour Godot draws the shape in.
 *
 * The class reference lists the default as `Color(0, 0, 0, 0)` and then says,
 * in the same entry, that the literal is a **placeholder**: the real default is
 * ProjectSettings `debug/shapes/collision/shape_color`. Godot's own
 * `_validate_property` strips `debug_color` from a saved scene when it equals
 * that value, so an ABSENT key means the project colour — a translucent teal —
 * not transparent black, and not the green this previewer used to hard-code.
 *
 * Source: scene/3d/physics/collision_shape_3d.cpp `_get_default_debug_color()`
 * → `SceneTree::get_debug_collisions_color()`, and class_projectsettings.html
 * `debug/shapes/collision/shape_color` = `Color(0, 0.6, 0.7, 0.42)`.
 */

import type { Color } from '../../../utils/colorParser';
import { colorOr } from '../../../utils/colorParser';
import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/** ProjectSettings `debug/shapes/collision/shape_color`. */
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
 * Strict validator for `debug_color`.
 *
 * The shared `Color` grammar, not a bespoke one. It used to be a hand-rolled
 * `[\d.]+`-per-channel regex that also allowed a three-argument spelling, and it
 * was wrong at both ends: `VariantParser::parse_value` refuses a `Color` whose
 * argument count is not 4 (`variant_parser.cpp:913`), while a channel is a plain
 * float, so the negative/overbright, scientific and non-finite forms `rtos_fix`
 * writes (`:2145`) all load and were being reported.
 *
 * Both CollisionShape2D::set_debug_color (collision_shape_2d.cpp:235-241) and
 * CollisionShape3D::set_debug_color (collision_shape_3d.cpp:252-262) are bare
 * assignments, and `debug_color`'s ADD_PROPERTY (collision_shape_2d.cpp:296,
 * collision_shape_3d.cpp:182) carries PROPERTY_HINT_NONE: no hint string, so no
 * component range to ground. This only rejects a malformed Color literal, which
 * is what `v.color` is.
 */
export const debugColorValidator: PropertyValidator = v.color('debug_color');
