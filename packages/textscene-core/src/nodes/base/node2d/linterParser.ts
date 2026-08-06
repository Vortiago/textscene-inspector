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

import '../../canvasitem/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, makeFloatTupleRegex, tupleComponent } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific, plus the
// non-finite spellings Godot writes) so the bespoke `scale` validator stays as
// lenient as v.vector2.
const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

// Godot's own CMP_EPSILON (core/math/math_defs.h), the threshold
// Math::is_zero_approx compares against. Matches camera2d/linterParser.ts's
// zoomValidator, which grounds the identical is_zero_approx predicate.
const CMP_EPSILON = 0.00001;

// node_2d.cpp:187-199: set_scale substitutes CMP_EPSILON for a component that
// `Math::is_zero_approx`s ("Avoid having 0 scale values, can lead to errors in
// physics and rendering."), a silent correction ADR-0032 treats the same as an
// ERR_FAIL: enforced, stays an error.
const scaleValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR2_REGEX.exec(value);
  if (!match) {
    return propertyError(key, line, `Property 'scale' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`, 'INVALID_SCALE_FORMAT');
  }

  const x = tupleComponent(match[1]);
  const y = tupleComponent(match[2]);

  if (Math.abs(x) < CMP_EPSILON || Math.abs(y) < CMP_EPSILON) {
    return propertyError(key, line, `Property 'scale' must have non-zero values, got: Vector2(${x}, ${y}). Zero scale causes rendering issues.`, 'INVALID_SCALE_VALUE');
  }

  return null;
};
scaleValidator.accepts = 'Vector2(x, y), no (near-)zero component';
// Hand-rolled (not built through `v`), so tagged by hand for
// boundGrounding.test.ts: node_2d.cpp:194-198 substitutes CMP_EPSILON for a
// (near-)zero component rather than assigning it, an enforced silent
// alteration under ADR-0032, so out-of-range stays an error.
scaleValidator.grounding = { kind: 'enforced', cite: 'node_2d.cpp:194' };

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
  // CanvasItem light culling: ANDed against a 2D light's range_item_cull_mask.
  // CanvasItem material slot. The reference is format-checked; whether it names
  // a CanvasItemMaterial (the only kind the renderer applies) is not, because a
  // ShaderMaterial there is valid Godot, just unimplemented here.
});
