/**
 * The one bound SpringBoneSimulator3D's own setters enforce on a value, shared
 * by the setting-level and joint-level gravity directions.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { VECTOR3_REGEX, accepts, propertyError } from '../../../../linter/validators/index.js';
import { CMP_EPSILON } from '../../../../godot/index.js';
import { tupleComponent } from '../../../../linter/validators/commonValidators.js';

/**
 * A gravity direction, which the setter refuses outright when it is zero.
 *
 * `set_gravity_direction` and `set_joint_gravity_direction` both open with
 * `ERR_FAIL_COND(p_gravity_direction.is_zero_approx())`, so the write never
 * lands and the previous direction stays. Not `=== 0`:
 * `Vector3::is_zero_approx` is `is_zero_approx(x) && is_zero_approx(y) &&
 * is_zero_approx(z)` (vector3.cpp:149-151), each a `abs(v) < CMP_EPSILON`
 * comparison, so `Vector3(0.000001, 0, 0)` is refused just as `Vector3(0, 0, 0)`
 * is.
 *
 * No `finite:` citation: `abs(nan) < CMP_EPSILON` is false, and so is
 * `abs(inf) < CMP_EPSILON`, so a non-finite component makes the vector NOT
 * zero-approx and Godot's guard lets it through. The linter's component grammar
 * spells all four non-finite literals, so such a value reaches this bound rather
 * than being turned away as a format error first.
 *
 * @param name - the leaf name, for the message.
 * @param cite - `file:line` of that leaf's own `ERR_FAIL_COND`.
 */
export function nonZeroVector3(name: string, cite: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_VALUE`;
  const validator = accepts((key, value, line) => {
    const match = VECTOR3_REGEX.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be Vector3 with 3 numbers like Vector3(0, -1, 0), got: "${value}"`,
        `INVALID_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FORMAT`,
      );
    }
    const components = [match[1], match[2], match[3]].map(tupleComponent);
    if (components.every((c) => Math.abs(c) < CMP_EPSILON)) {
      return propertyError(
        key,
        line,
        `Property '${name}' must not be the zero vector: Godot's setter fails ` +
          `ERR_FAIL_COND(is_zero_approx()) and drops the write, and every component ` +
          `under ${CMP_EPSILON} counts as zero`,
        code,
      );
    }
    return null;
  }, 'Vector3(x, y, z), not the zero vector');
  validator.grounding = { kind: 'enforced', cite };
  return validator;
}
