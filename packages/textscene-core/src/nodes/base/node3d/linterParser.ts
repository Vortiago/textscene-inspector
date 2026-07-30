/**
 * Node3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `scale` keeps a bespoke validator because it folds a vector-format check with
 * a per-component non-zero check (a zero axis collapses the node — a genuine
 * rendering breaker). A negative component is a valid mirror/flip (the renderer
 * draws it, matching Node2D), and extreme-but-finite magnitudes are fine too;
 * flagging either would re-introduce the parser/linter divergence this base
 * validator (inherited by every Node3D subclass via the base-walk, #143) removes.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import { VECTOR3_REGEX } from '../../../linter/validators/vectorValidators.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const ROTATION_ORDER = {
  0: 'XYZ',
  1: 'XZY',
  2: 'YXZ',
  3: 'YZX',
  4: 'ZXY',
  5: 'ZYX',
};

/** Bespoke `scale` validator: Vector3 format + each component must be non-zero. */
const scaleValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR3_REGEX.exec(value);
  if (!match) {
    return propertyError(key, line, `Property 'scale' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`, 'INVALID_SCALE_FORMAT');
  }

  const x = parseFloat(match[1] || '0');
  const y = parseFloat(match[2] || '0');
  const z = parseFloat(match[3] || '0');

  if (x === 0 || y === 0 || z === 0) {
    return propertyError(key, line, `Property 'scale' must have non-zero values, got: Vector3(${x}, ${y}, ${z}). Zero scale collapses the node and causes rendering issues.`, 'INVALID_SCALE_VALUE');
  }

  return null;
};
scaleValidator.accepts = 'Vector3(x, y, z), no zero component';

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
