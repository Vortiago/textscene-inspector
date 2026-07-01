/**
 * CollisionShape2D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * `debug_color` keeps a bespoke validator because it accepts BOTH
 * `Color(r,g,b)` (3-component) and `Color(r,g,b,a)` (4-component), unlike
 * `v.color` which requires exactly 4.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const COLOR_3_OR_4_REGEX =
  /^Color\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/;

const debugColor: PropertyValidator = (key, value, line) => {
  if (!COLOR_3_OR_4_REGEX.test(value)) {
    return propertyError(key, line, `Property 'debug_color' must be in Color(r, g, b) or Color(r, g, b, a) format, got: "${value}"`, 'INVALID_DEBUG_COLOR_FORMAT');
  }
  return null;
};

validatorRegistry.registerAll('CollisionShape2D', {
  shape: v.resourceReference('shape'),
  disabled: v.boolean('disabled'),
  one_way_collision: v.boolean('one_way_collision'),
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    message:
      "Property 'one_way_collision_margin' must be non-negative (>= 0)",
  }),
  debug_color: debugColor,
});
