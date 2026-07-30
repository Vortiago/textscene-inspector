/**
 * Node2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `scale` keeps a bespoke validator that folds a Vector2 format check with a
 * per-component non-zero check (a zero axis collapses the node — a genuine
 * rendering breaker). Extreme-but-nonzero magnitudes are NOT flagged: the
 * renderer draws them and real Godot scenes use near-zero "hide" scales, so
 * erroring on them would re-introduce the parser/linter divergence this base
 * validator (inherited by every Node2D subclass via the base-walk, #143) exists
 * to remove.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v, makeFloatTupleRegex } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific) so the
// bespoke `scale` validator stays as lenient as the renderer and v.vector2.
const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

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

  return null;
};
scaleValidator.accepts = 'Vector2(x, y), no zero component';

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
  // CanvasItem light culling: ANDed against a 2D light's range_item_cull_mask.
  light_mask: layerBitmask('light_mask'),
  y_sort_enabled: v.boolean('y_sort_enabled'),
  // CanvasItem material slot. The reference is format-checked; whether it names
  // a CanvasItemMaterial (the only kind the renderer applies) is not, because a
  // ShaderMaterial there is valid Godot, just unimplemented here.
  material: v.resourceReference('material'),
  use_parent_material: v.boolean('use_parent_material'),
});
