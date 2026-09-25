/**
 * The one bound SpringBoneSimulator3D's own setters enforce on a value, shared
 * by the setting-level and joint-level gravity directions.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { CMP_EPSILON, isZeroApprox } from '../../../../godot/index.js';

/**
 * A gravity direction, which `set_gravity_direction` and `set_joint_gravity_direction` refuse
 * through `ERR_FAIL_COND(p_gravity_direction.is_zero_approx())`, keeping the previous one.
 * `Vector3::is_zero_approx` tests each component against `CMP_EPSILON` (vector3.cpp:149-151), so
 * `Vector3(0.000001, 0, 0)` is refused too.
 * @param name - the leaf name, for the message.
 * @param cite - `file:line` of that leaf's own `ERR_FAIL_COND`.
 */
export function nonZeroVector3(name: string, cite: string): PropertyValidator {
  return v.vector3(name, {
    // No `finite:` cite: `abs(nan)` and `abs(inf)` both fail `< CMP_EPSILON`, so Godot's guard
    // passes a non-finite vector, and the component grammar lets such a value reach this bound.
    components: (components) =>
      components.every(isZeroApprox)
        ? {
            message:
              `Property '${name}' must not be the zero vector: Godot's setter fails ` +
              `ERR_FAIL_COND(is_zero_approx()) and drops the write, and every component ` +
              `under ${CMP_EPSILON} counts as zero`,
          }
        : null,
    accepts: 'Vector3(x, y, z), not the zero vector',
    enforced: cite,
  });
}
