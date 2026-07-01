/**
 * Node2D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * `scale` keeps a bespoke validator that folds Vector2 format check
 * with per-component non-zero + extreme-magnitude detection.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const VECTOR2_REGEX =
  /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;
const EXTREME_SCALE_MAX = 1000;
const EXTREME_SCALE_MIN = 0.001;

const scaleValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR2_REGEX.exec(value);
  if (!match) {
    return propertyError(key, line, `Property 'scale' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`, 'INVALID_SCALE_FORMAT');
  }

  const x = parseFloat(match[1] || '0');
  const y = parseFloat(match[2] || '0');

  if (x === 0 || y === 0) {
    return propertyError(key, line, `Property 'scale' must have non-zero values, got: Vector2(${x}, ${y}). Zero scale causes rendering issues.`, 'INVALID_SCALE_VALUE');
  }

  if (Math.abs(x) > EXTREME_SCALE_MAX || Math.abs(y) > EXTREME_SCALE_MAX) {
    return propertyError(key, line, `Property 'scale' has extreme values (>${EXTREME_SCALE_MAX}): Vector2(${x}, ${y}). This may cause precision issues.`, 'EXTREME_SCALE_VALUE');
  }

  if (Math.abs(x) < EXTREME_SCALE_MIN || Math.abs(y) < EXTREME_SCALE_MIN) {
    return propertyError(key, line, `Property 'scale' has extreme values (<${EXTREME_SCALE_MIN}): Vector2(${x}, ${y}). This may cause precision issues.`, 'EXTREME_SCALE_VALUE');
  }

  return null;
};

validatorRegistry.registerAll('Node2D', {
  position: v.vector2('position'),
  rotation: v.float('rotation'),
  rotation_degrees: v.float('rotation_degrees'),
  scale: scaleValidator,
  skew: v.float('skew'),
  transform: v.transform2d('transform'),
  global_position: v.vector2('global_position'),
  global_rotation: v.float('global_rotation'),
  global_rotation_degrees: v.float('global_rotation_degrees'),
  global_scale: v.vector2('global_scale'),
  global_skew: v.float('global_skew'),
  global_transform: v.transform2d('global_transform'),
  z_index: v.strictInt('z_index'),
  z_as_relative: v.boolean('z_as_relative'),
  y_sort_enabled: v.boolean('y_sort_enabled'),
});
