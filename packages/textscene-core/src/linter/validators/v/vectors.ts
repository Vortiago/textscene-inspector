/**
 * Fixed-shape numeric literals: vectors, rects, transforms, a basis, a
 * quaternion, an AABB and a colour.
 *
 * All but `vector2i` and `boundedVector3` are pure format checks — the literal
 * either has the arity Godot writes or it does not — which is why the two that
 * carry a per-COMPONENT bound are the only ones here taking a `Grounding`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { ruleInt, tupleComponent } from '../commonValidators.js';
import { markIntSlot } from '../intSlot.js';
import { floatTupleValidator, makeFloatTupleRegex } from '../floatTupleValidator.js';
import {
  VECTOR3_REGEX,
  createRect2Validator,
  createTransform3DValidator,
  createVector2Validator,
  createVector2iValidator,
  createVector3Validator,
} from '../vectorValidators.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import { accepts, endSeverity, ground, shape, type Grounding } from './grounding.js';

// The component grammar Godot's parser takes, not `-?\d+`:
// `_parse_construct<int32_t>` (variant_parser.cpp:577-592) accepts any number
// token and converts it, so a float or exponent component loads and truncates.
const RECT2I_RE = makeFloatTupleRegex('Rect2i', 4);

export const vectorCombinators = {
  /** `Rect2i(x, y, w, h)` integer format. */
  rect2i(name: string): PropertyValidator {
    const code = formatCode(name);
    return markIntSlot(shape((key, value, line) => {
      const match = RECT2I_RE.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be Rect2i(x, y, w, h) with integer components, got: ${value}`,
          code
        );
      }
      // Same arm as `vector2i`: the component reads, no int32 holds it.
      if (match.slice(1, 5).some((component) => ruleInt(component) === null)) {
        return propertyError(
          key,
          line,
          `Property '${name}' has a component no integer can hold, got: ${value}`,
          valueCode(name),
          'error'
        );
      }
      return null;
    }, 'Rect2i(x, y, w, h)'));
  },

  /** `Vector2(x, y)` format. */
  vector2(name: string): PropertyValidator {
    return shape(createVector2Validator(name, formatCode(name)), 'Vector2(x, y)');
  },

  /**
   * `Vector2i(x, y)` integer format, optionally with a per-COMPONENT minimum.
   *
   * `min` rejects a value Godot's parser reads perfectly well, so it is a bound
   * like any other and takes its `Grounding`. It used to be a bare positional
   * `requireNonNegative` boolean, which put it outside `boundGrounding`'s sweep
   * entirely: `Window.size` and `SubViewport.size` both refused a negative
   * component with nothing recorded about which setter, if any, agreed.
   */
  vector2i(name: string, opts: { min?: number } & Grounding = {}): PropertyValidator {
    const { min } = opts;
    return markIntSlot(ground(
      accepts(
        createVector2iValidator(name, min, formatCode(name), valueCode(name), endSeverity(opts, 'min')),
        min === undefined ? 'Vector2i(x, y)' : `Vector2i(x, y), both >= ${min}`
      ),
      opts,
      { min }
    ));
  },

  /** `Vector3(x, y, z)` format. */
  vector3(name: string): PropertyValidator {
    return shape(createVector3Validator(name, formatCode(name)), 'Vector3(x, y, z)');
  },

  /**
   * `Vector3(x, y, z)` with a per-COMPONENT numeric range.
   *
   * Godot writes a component bound as an ordinary PROPERTY_HINT_RANGE on a
   * VECTOR3 property, e.g. gpu_particles_collision_3d.cpp:101 hints `size`
   * "0.01,1024,0.01,or_greater" - meaning every component must be at least
   * 0.01, with the upper end a soft editor bound. `v.vector3` only checks the
   * literal's shape, so three slices hand-rolled the parse-and-compare loop
   * before this existed.
   *
   * Bounds are inclusive, and either may be omitted. A predicate that is not a
   * range (Camera2D's `zoom` must be non-zero, Node2D's `scale` likewise) is
   * not this, and stays hand-rolled.
   */
  boundedVector3(
    name: string,
    opts: { min?: number; max?: number } & Grounding = {}
  ): PropertyValidator {
    const { min, max } = opts;
    // Per END, not per bound. The three components share one RANGE, but the two
    // ends of that range can have different authority: GPUParticlesCollision's
    // `size` has an enforced floor and a merely hinted ceiling. Collapsing them
    // reported an ERROR for a value only the inspector hint excludes.
    const minSeverity = endSeverity(opts, 'min');
    const maxSeverity = endSeverity(opts, 'max');
    return ground(accepts((key, value, line) => {
      const match = VECTOR3_REGEX.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`,
          formatCode(name)
        );
      }
      const parts = [match[1], match[2], match[3]].map(tupleComponent);
      const belowMin = min !== undefined && parts.some((c) => c < min);
      const aboveMax = max !== undefined && parts.some((c) => c > max);
      if (belowMin || aboveMax) {
        const bound =
          min !== undefined && max !== undefined
            ? `between ${min} and ${max}`
            : min !== undefined
              ? `>= ${min}`
              : `<= ${max}`;
        return propertyError(
          key,
          line,
          `Property '${name}' components must be ${bound}, got: Vector3(${parts.join(', ')})`,
          valueCode(name),
          // A component under the floor is the stronger claim when the two ends
          // disagree, so it wins.
          belowMin ? minSeverity : maxSeverity
        );
      }
      return null;
    }, `Vector3(x, y, z), each ${numericRange('float', min, max)}`), opts, { min, max });
  },

  /** `Rect2(x, y, w, h)` format. */
  rect2(name: string): PropertyValidator {
    return shape(createRect2Validator(name, formatCode(name)), 'Rect2(x, y, w, h)');
  },

  /** `Transform3D(...12 floats)` format. */
  transform3d(name: string): PropertyValidator {
    return shape(createTransform3DValidator(name, formatCode(name)), 'Transform3D(12 floats)');
  },

  /**
   * `Color(r, g, b, a)` format. Built inline because the existing
   * factories don't expose a Color helper, but the regex matches
   * directionallight3d/omnilight3d/spotlight3d's hand-rolled version.
   */
  color(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Color', 4, 'Color with 4 numbers like Color(1, 1, 1, 1)', formatCode(name)),
      'Color(r, g, b, a)'
    );
  },

  /** `AABB(x, y, z, w, h, d)` format. */
  aabb(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'AABB', 6, 'AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1)', formatCode(name)),
      'AABB(x, y, z, w, h, d)'
    );
  },

  /** `Quaternion(x, y, z, w)` format. */
  quaternion(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Quaternion', 4, 'Quaternion with 4 numbers like Quaternion(0, 0, 0, 1)', formatCode(name)),
      'Quaternion(x, y, z, w)'
    );
  },

  /** `Transform2D(6 floats)` format. */
  transform2d(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Transform2D', 6, 'Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0)', formatCode(name)),
      'Transform2D(6 floats)'
    );
  },

  /** `Basis(9 floats)` format. */
  basis(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Basis', 9, 'Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)', formatCode(name)),
      'Basis(9 floats)'
    );
  },
};
