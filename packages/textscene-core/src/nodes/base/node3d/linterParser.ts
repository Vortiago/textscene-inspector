/**
 * Node3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * `scale` keeps a bespoke validator because it folds a vector-format
 * check together with extreme-magnitude detection (Godot's editor
 * produces a precision warning above 1000× or below 0.001×).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { VECTOR3_REGEX } from '../../../linter/validators/vectorValidators.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const EXTREME_SCALE_MAX = 1000;
const EXTREME_SCALE_MIN = 0.001;

const ROTATION_ORDER = {
  0: 'XYZ',
  1: 'XZY',
  2: 'YXZ',
  3: 'YZX',
  4: 'ZXY',
  5: 'ZYX',
};

/**
 * Bespoke `scale` validator: Vector3 format + each component must be
 * positive and within [EXTREME_SCALE_MIN, EXTREME_SCALE_MAX] for
 * numerical precision.
 */
const scaleValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR3_REGEX.exec(value);
  if (!match) {
    return {
      severity: 'error',
      message: `Property 'scale' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`,
      line,
      column: key.length + 3,
      code: 'INVALID_SCALE_FORMAT',
    };
  }

  const x = parseFloat(match[1] || '0');
  const y = parseFloat(match[2] || '0');
  const z = parseFloat(match[3] || '0');

  if (x <= 0 || y <= 0 || z <= 0) {
    return {
      severity: 'error',
      message: `Property 'scale' must have positive values, got: Vector3(${x}, ${y}, ${z}). Zero or negative scale can cause rendering issues.`,
      line,
      column: key.length + 3,
      code: 'INVALID_SCALE_VALUE',
    };
  }

  if (x > EXTREME_SCALE_MAX || y > EXTREME_SCALE_MAX || z > EXTREME_SCALE_MAX) {
    return {
      severity: 'error',
      message: `Property 'scale' has extreme values (>${EXTREME_SCALE_MAX}): Vector3(${x}, ${y}, ${z}). This may cause precision issues.`,
      line,
      column: key.length + 3,
      code: 'EXTREME_SCALE_VALUE',
    };
  }

  if (x < EXTREME_SCALE_MIN || y < EXTREME_SCALE_MIN || z < EXTREME_SCALE_MIN) {
    return {
      severity: 'error',
      message: `Property 'scale' has extreme values (<${EXTREME_SCALE_MIN}): Vector3(${x}, ${y}, ${z}). This may cause precision issues.`,
      line,
      column: key.length + 3,
      code: 'EXTREME_SCALE_VALUE',
    };
  }

  return null;
};

validatorRegistry.registerAll('Node3D', {
  transform: v.transform3d('transform'),
  global_transform: v.transform3d('global_transform'),
  position: v.vector3('position'),
  rotation: v.vector3('rotation'),
  rotation_degrees: v.vector3('rotation_degrees'),
  scale: scaleValidator,
  quaternion: v.quaternion('quaternion'),
  basis: v.basis('basis'),
  global_position: v.vector3('global_position'),
  global_rotation: v.vector3('global_rotation'),
  global_rotation_degrees: v.vector3('global_rotation_degrees'),
  global_basis: v.basis('global_basis'),
  visible: v.boolean('visible'),
  top_level: v.boolean('top_level'),
  visibility_parent: v.nodePath('visibility_parent'),
  rotation_order: v.enumInt('rotation_order', 0, 5, ROTATION_ORDER),
});
