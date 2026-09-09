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
import { v } from '../../../linter/validators/index.js';
import type { ComponentRule } from '../../../linter/validators/v/vectors.js';

/**
 * @param dim - which twin, and so which literal arity.
 * @param cite - `file:line` of that twin's own `ERR_FAIL_COND_MSG`.
 */
export function upDirection(dim: '2D' | '3D', cite: string): PropertyValidator {
  const type = dim === '2D' ? 'Vector2' : 'Vector3';
  const components = (rule: ComponentRule) =>
    dim === '2D'
      ? v.vector2('up_direction', { components: rule, accepts: accepted(type, 'x, y'), enforced: cite })
      : v.vector3('up_direction', { components: rule, accepts: accepted(type, 'x, y, z'), enforced: cite });
  return components((parts) =>
    parts.every((component) => component === 0)
      ? {
          message:
            `Property 'up_direction' must not be the zero vector: Godot's setter fails ` +
            `ERR_FAIL_COND_MSG(p_up_direction == ${type}()) and drops the write, so the ` +
            'body keeps its default up direction. Use motion_mode FLOATING instead.',
        }
      : null
  );
}

function accepted(type: string, slots: string): string {
  return `${type}(${slots}) other than the zero vector, or the ${type}i spelling Godot converts`;
}
