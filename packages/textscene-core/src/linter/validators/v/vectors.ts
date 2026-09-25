/**
 * Fixed-shape numeric literals: vectors, rects, transforms, a basis, a
 * quaternion, an AABB and a colour. Most are pure arity checks. A combinator
 * with a per-component bound or refusal takes a `Grounding`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { ruleInt, tupleComponent } from '../commonValidators.js';
import { slotComponents, slotComponentsAltered } from '../../../godot/int.js';
import { markIntSlot, truncatedComponent } from '../intSlot.js';
import { floatTupleValidator, makeFloatTupleRegex } from '../floatTupleValidator.js';
import {
  VECTOR3_REGEX,
  createRect2Validator,
  createTransform3DValidator,
  createVector2Validator,
  createVector2iValidator,
  createVector3Validator,
} from '../vectorValidators.js';
import { compositeTypeName, isConvertedSpelling } from '../../../godot/variantConversion.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import { accepts, endSeverity, ground, shape, type Grounding } from './grounding.js';

// The component grammar Godot's parser takes, not `-?\d+`:
// `_parse_construct<int32_t>` (variant_parser.cpp:577-592) accepts any number
// token and converts it, so a float or exponent component loads and truncates.
const RECT2I_RE = makeFloatTupleRegex('Rect2i', 4);

/**
 * A per-component predicate on the narrowed components, for the setters whose
 * refusal is not a range: a zero axis, a negative component clamped up, a whole
 * vector the setter drops. Returns the refusal, or null when the value passes.
 */
export type ComponentRule = (
  parts: number[],
  written: string
) => { message: string; severity?: 'error' | 'warning' } | null;

/**
 * Runs `rule` after the format validator, on the components as Godot stores
 * them. A format or alteration error wins outright, and the truncation warning
 * for a converted spelling yields to a refusal, so it never masks a bound.
 */
function componentRule(
  validator: PropertyValidator,
  name: string,
  typeName: string,
  arity: number,
  rule: ComponentRule,
  opts: Grounding
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  const guarded: PropertyValidator = (key, value, line) => {
    const first = validator(key, value, line);
    if (first?.severity === 'error') return first;
    const match = regex.exec(value);
    if (!match) return first;
    const parts = slotComponents(value, typeName, match.slice(1, arity + 1), tupleComponent);
    const refusal = rule(parts, value);
    if (refusal) return propertyError(key, line, refusal.message, valueCode(name), refusal.severity);
    return first;
  };
  guarded.accepts = validator.accepts;
  const cites = (end: Grounding['enforced']) =>
    end === undefined ? [] : typeof end === 'string' ? [end] : [end.min, end.max].filter((c): c is string => !!c);
  const enforced = cites(opts.enforced);
  const hinted = cites(opts.hinted).filter((c) => !enforced.includes(c));
  if (enforced.length > 0) guarded.grounding = { kind: 'enforced', cite: [...enforced, ...hinted].join(', ') };
  else if (hinted.length > 0) guarded.grounding = { kind: 'hinted', cite: hinted.join(', ') };
  return guarded;
}

/**
 * Refuse a composite whose float spelling carries a non-finite component, for
 * a setter that drops the whole write on one. An integer constructor's
 * non-finite argument is the alteration `floatTupleValidator` reports instead.
 */
function finiteComponents(
  validator: PropertyValidator,
  name: string,
  typeName: string,
  arity: number,
  cite: string
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  const guarded: PropertyValidator = (key, value, line) => {
    const format = validator(key, value, line);
    if (format) return format;
    const match = regex.exec(value);
    if (!match) return null;
    if (isConvertedSpelling(typeName, compositeTypeName(value))) return null;
    const components = match.slice(1, arity + 1).map((c) => tupleComponent(c));
    if (components.some((c) => !Number.isFinite(c))) {
      return propertyError(
        key,
        line,
        `Property '${name}' must have finite components; Godot's setter returns ` +
          `without storing "${value.trim()}"`,
        valueCode(name)
      );
    }
    return null;
  };
  guarded.accepts = validator.accepts;
  guarded.grounding = { kind: 'enforced', cite };
  return guarded;
}

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
      const components = match.slice(1, 5);
      // Same arm as `vector2i`: the component reads, no int32 holds it. A
      // `Rect2(...)` in a Rect2i slot holds four doubles, so every component
      // takes the `double -> int32` branch whatever the token looks like.
      const converted = isConvertedSpelling('Rect2i', compositeTypeName(value));
      if (components.some((component) => ruleInt(component, null, 'int32', converted) === null)) {
        return propertyError(
          key,
          line,
          `Property '${name}' has a component no integer can hold, got: ${value}`,
          valueCode(name),
          'error'
        );
      }
      return truncatedComponent(name, key, line, components, valueCode(name));
    }, 'Rect2i(x, y, w, h), or the Rect2 spelling Godot converts'));
  },

  /**
   * `Vector2(x, y)` format, optionally with a per-component finiteness refusal.
   * `finite` takes a citation: Godot writes `inf` and `nan` into every real-typed
   * composite, so only a setter that refuses one grounds it. Not `withFiniteGuard`,
   * which reads a scalar.
   */
  vector2(
    name: string,
    opts: { finite?: string; components?: ComponentRule; accepts?: string } & Grounding = {}
  ): PropertyValidator {
    const format = shape(
      createVector2Validator(name, formatCode(name)),
      opts.accepts ?? 'Vector2(x, y), or the Vector2i spelling Godot converts'
    );
    const ruled = opts.components
      ? componentRule(format, name, 'Vector2', 2, opts.components, opts)
      : format;
    return opts.finite ? finiteComponents(ruled, name, 'Vector2', 2, opts.finite) : ruled;
  },

  /**
   * `Vector2i(x, y)` integer format, optionally with a per-component minimum,
   * which is a bound like any other and takes its `Grounding`.
   */
  vector2i(name: string, opts: { min?: number } & Grounding = {}): PropertyValidator {
    const { min } = opts;
    return markIntSlot(ground(
      accepts(
        createVector2iValidator(name, min, formatCode(name), valueCode(name), endSeverity(opts, 'min')),
        min === undefined
          ? 'Vector2i(x, y), or the Vector2 spelling Godot converts'
          : `Vector2i(x, y), both >= ${min}, or the Vector2 spelling Godot converts`
      ),
      opts,
      { min }
    ));
  },

  /**
   * `Vector3(x, y, z)` format, optionally with a per-component refusal that is
   * not a range (see {@link ComponentRule}); a range is `boundedVector3`.
   */
  vector3(
    name: string,
    opts: { components?: ComponentRule; accepts?: string } & Grounding = {}
  ): PropertyValidator {
    const format = shape(
      createVector3Validator(name, formatCode(name)),
      opts.accepts ?? 'Vector3(x, y, z), or the Vector3i spelling Godot converts'
    );
    return opts.components
      ? componentRule(format, name, 'Vector3', 3, opts.components, opts)
      : format;
  },

  /**
   * `Vector3(x, y, z)` with an inclusive per-component range, either end
   * optional: a PROPERTY_HINT_RANGE on a VECTOR3, as gpu_particles_collision_3d.cpp:101
   * hints `size` "0.01,1024,0.01,or_greater". A predicate that is not a range,
   * such as a non-zero `zoom`, is `vector3`'s `components` option.
   */
  boundedVector3(
    name: string,
    opts: { min?: number; max?: number } & Grounding = {}
  ): PropertyValidator {
    const { min, max } = opts;
    // Per end: the components share one range, but its two ends can have
    // different authority, such as an enforced floor and a hinted ceiling.
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
      const captures = [match[1], match[2], match[3]];
      // Ahead of the bounds: an altered component reads back as NaN, which no
      // bound catches. The message quotes the literal, not the stored number:
      // `_to_int`'s float branch is undefined behaviour (variant.h:369-370).
      if (slotComponentsAltered(value, 'Vector3', captures)) {
        return propertyError(
          key,
          line,
          `Property '${name}' has a component Godot cannot store in the integer spelling it is written in, got: "${value}". ` +
            'The file loads, but the components are narrowed at parse time to a number the file does not state.',
          valueCode(name),
          'error'
        );
      }
      // `slotComponents`, not bare `tupleComponent`: the `Vector3i(...)` spelling's
      // arguments narrow through `_parse_construct<int32_t>` before the widening
      // into this float slot, as the renderer reads them too.
      const parts = slotComponents(value, 'Vector3', captures, tupleComponent);
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
      // After the bounds so an enforced bound is never masked: the converted
      // spelling's fractional component is stored truncated
      // (variant_parser.cpp:721-723), the warning `floatTupleValidator` draws.
      if (isConvertedSpelling('Vector3', compositeTypeName(value))) {
        return truncatedComponent(name, key, line, captures, valueCode(name));
      }
      return null;
    }, `Vector3(x, y, z), each ${numericRange('float', min, max)}`), opts, { min, max });
  },

  /** `Rect2(x, y, w, h)` format. */
  rect2(name: string): PropertyValidator {
    return shape(
      createRect2Validator(name, formatCode(name)),
      'Rect2(x, y, w, h), or the Rect2i spelling Godot converts'
    );
  },

  /** `Transform3D(...12 floats)` format. */
  transform3d(name: string): PropertyValidator {
    return shape(createTransform3DValidator(name, formatCode(name)), 'Transform3D(12 floats)');
  },

  /** `Color(r, g, b, a)` format. */
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
