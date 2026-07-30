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
import { propertyError } from '../../../linter/validators/index.js';
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
 * Strict validator for `debug_color`. Bespoke rather than `v.color` because
 * Godot accepts BOTH `Color(r, g, b)` and `Color(r, g, b, a)` here, while
 * `v.color` requires exactly four components.
 */
const COLOR_3_OR_4_REGEX =
  /^Color\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/;

export const debugColorValidator: PropertyValidator = (key, value, line) => {
  if (!COLOR_3_OR_4_REGEX.test(value)) {
    return propertyError(
      key,
      line,
      `Property 'debug_color' must be in Color(r, g, b) or Color(r, g, b, a) format, got: "${value}"`,
      'INVALID_DEBUG_COLOR_FORMAT'
    );
  }
  return null;
};

// Shown in each sheet's generated `## Linting` table.
debugColorValidator.accepts = 'Color(r, g, b, a)';
