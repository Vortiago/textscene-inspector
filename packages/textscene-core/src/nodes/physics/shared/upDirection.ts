/**
 * `CharacterBody2D/3D.up_direction`: `ERR_FAIL_COND_MSG(p_up_direction == Vector2())`
 * (`character_body_2d.cpp:648`, `character_body_3d.cpp:848`, ADR-0032 error). Exact
 * equality, not `is_zero_approx` like `nonZeroVector3`: `Vector2(1e-9, 0)` is stored.
 * No `finite:` cite: `inf` and `nan` compare unequal to 0, so they pass.
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
