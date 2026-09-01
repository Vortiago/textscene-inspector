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
import { v, VECTOR2_REGEX, tupleComponent } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { isZeroApprox } from '../../../godot/index.js';
import { slotComponents, slotComponentsAltered } from '../../../godot/int.js';

// Matched against the shared VECTOR2_REGEX so this bespoke validator stays
// exactly as lenient as v.vector2 — the canonical float grammar, which accepts
// digits with an optional trailing point, scientific notation, and the
// non-finite spellings Godot writes.
//
// node_2d.cpp:187-199: set_scale substitutes CMP_EPSILON for a component that
// `Math::is_zero_approx`s ("Avoid having 0 scale values, can lead to errors in
// physics and rendering."), a silent correction ADR-0032 treats the same as an
// ERR_FAIL: enforced, stays an error.
const scaleValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR2_REGEX.exec(value);
  if (!match) {
    return propertyError(key, line, `Property 'scale' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`, 'INVALID_SCALE_FORMAT');
  }

  const captures = [match[1], match[2]];
  // Ahead of the zero check, which cannot express it: an altered component
  // reads back NaN, and `isZeroApprox(NaN)` is false, so the check said nothing
  // about the one literal Godot does not store as written. The message quotes
  // the literal and never the stored number — `_to_int`'s float branch is
  // undefined behaviour (variant.h:369-370).
  if (slotComponentsAltered(value, 'Vector2', captures)) {
    return propertyError(key, line, `Property 'scale' has a component Godot cannot store in the integer spelling it is written in, got: "${value}". The file loads, but the components are narrowed at parse time to a number the file does not state.`, 'INVALID_SCALE_VALUE');
  }

  // `slotComponents`, not bare `tupleComponent`: VECTOR2_REGEX admits the
  // `Vector2i(...)` spelling `can_convert_strict` converts, whose arguments are
  // narrowed through `_parse_construct<int32_t>` BEFORE the widening into this
  // float slot, so `Vector2i(0.5, 1)` reaches set_scale as the (0, 1) that
  // trips the CMP_EPSILON substitution.
  const [x, y] = slotComponents(value, 'Vector2', captures, tupleComponent);

  if (isZeroApprox(x!) || isZeroApprox(y!)) {
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
  // node_2d.cpp:503, PROPERTY_HINT_RANGE "-89.9,89.9,0.1,radians_as_degrees":
  // the inspector shows degrees, the .tscn stores radians, so the extents are
  // ±1.56905 rad. set_skew (:178-185) is a bare assignment with no clamp,
  // unlike set_scale beside it, so out of range warns.
  skew: v.radians('skew', { minDeg: -89.9, maxDeg: 89.9, hinted: 'node_2d.cpp:503' }),
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
