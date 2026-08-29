/**
 * `CharacterBody2D/3D.up_direction` — the one value its setter refuses.
 *
 * `set_up_direction` opens with `ERR_FAIL_COND_MSG(p_up_direction == Vector2())`
 * (`character_body_2d.cpp:648`, `character_body_3d.cpp:848`), so the write never
 * lands and the slot keeps the constructor default. ADR-0032's error tier, which
 * is why this is not the pure `v.vector2`/`v.vector3` format check.
 *
 * EXACT equality, not `is_zero_approx`: Godot compares against the zero vector
 * itself, so `Vector2(1e-9, 0)` is stored and normalised. SpringBoneSimulator3D's
 * `nonZeroVector3` models the OTHER guard (`ERR_FAIL_COND(is_zero_approx())`) and
 * cannot stand in here.
 *
 * No `finite:` citation: `inf` and `nan` both compare unequal to 0, so a
 * non-finite component makes the vector non-zero and Godot's guard passes it.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import {
  VECTOR2_REGEX,
  VECTOR3_REGEX,
  accepts,
  propertyError,
  tupleComponent,
} from '../../../linter/validators/index.js';
import { formatCode, valueCode } from '../../../linter/validators/v/codes.js';
import { slotComponents } from '../../../godot/int.js';

const SHAPE = {
  '2D': { regex: VECTOR2_REGEX, type: 'Vector2', example: 'Vector2(0, -1)', arity: 2 },
  '3D': { regex: VECTOR3_REGEX, type: 'Vector3', example: 'Vector3(0, 1, 0)', arity: 3 },
} as const;

/**
 * @param dim - which twin, and so which literal arity.
 * @param cite - `file:line` of that twin's own `ERR_FAIL_COND_MSG`.
 */
export function upDirection(dim: '2D' | '3D', cite: string): PropertyValidator {
  const { regex, type, example, arity } = SHAPE[dim];
  const validator = accepts((key, value, line) => {
    const match = regex.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property 'up_direction' must be ${type} with ${arity} numbers like ${example}, got: "${value}"`,
        formatCode('up_direction')
      );
    }
    // `slotComponents`, not bare `tupleComponent`: the grammar admits the
    // `${type}i(...)` spelling `can_convert_strict` converts, whose arguments are
    // narrowed to int32 before the widening into this float slot.
    const components = slotComponents(value, type, match.slice(1, arity + 1), tupleComponent);
    if (components.every((component) => component === 0)) {
      return propertyError(
        key,
        line,
        `Property 'up_direction' must not be the zero vector: Godot's setter fails ` +
          `ERR_FAIL_COND_MSG(p_up_direction == ${type}()) and drops the write, so the ` +
          'body keeps its default up direction. Use motion_mode FLOATING instead.',
        valueCode('up_direction')
      );
    }
    return null;
  }, `${type}(${arity === 2 ? 'x, y' : 'x, y, z'}) other than the zero vector, or the ${type}i spelling Godot converts`);
  validator.grounding = { kind: 'enforced', cite };
  return validator;
}
