/**
 * Declarative validator namespace `v` — the thin DSL that lets each
 * node's `linterParser.ts` become a flat property → combinator map.
 *
 * WI-ARCH-1: arch-scout candidate #1. Before this file the 31
 * `linterParser.ts` files totalled 9,488 LOC of near-identical
 * `parseFloat → NaN check → range check → return {ParseError shape}`.
 * Each validator now collapses to a single call site of ~30 chars.
 *
 * Each `v.xxx(propertyName, options?)` returns a `PropertyValidator`
 * (`(key, value, line) => ParseError | null`). Error codes are
 * auto-derived from the property name (uppercase + `_FORMAT` / `_VALUE`
 * suffix), so per-property call sites no longer pass them. Message
 * text follows the same template the existing files use (so all
 * `expect(msg).toContain('cast_shadow')` and `toContain('0-3')` style
 * tests keep passing).
 *
 * Built on top of the existing `create*Validator` factories in this
 * directory; this file is a façade, not a re-implementation.
 */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { floatTupleValidator } from './floatTupleValidator.js';
import {
  createBooleanValidator,
  createEnumValidator,
  createNumericRangeValidator,
  createPositiveIntegerValidator,
} from './commonValidators.js';
import {
  createNodePathValidator,
  createResourceReferenceValidator,
  createStringValidator,
} from './resourceValidators.js';
import {
  createRect2Validator,
  createTransform3DValidator,
  createVector2Validator,
  createVector2iValidator,
  createVector3Validator,
} from './vectorValidators.js';

/**
 * Convert `cast_shadow` → `CAST_SHADOW`. Used to auto-derive error
 * codes so call sites don't pass them.
 */
function upper(name: string): string {
  return name.toUpperCase();
}

/** Auto-derived error codes for the "must be a number" branch. */
function formatCode(name: string, kind = 'FORMAT'): string {
  return `INVALID_${upper(name)}_${kind}`;
}

/** Auto-derived error codes for the "out of range" branch. */
function valueCode(name: string): string {
  return formatCode(name, 'VALUE');
}

export interface FloatOpts {
  /** Inclusive minimum. Omit for no lower bound. */
  min?: number;
  /** Inclusive maximum. Omit for no upper bound. */
  max?: number;
  /** Custom range message override (replaces the auto-derived "must be …" text). */
  message?: string;
}

/** Same shape as `FloatOpts`; named separately for documentation symmetry. */
export type IntOpts = FloatOpts;

export interface EnumOpts {
  /** Per-value display labels, e.g. `{0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'}`. */
  labels: Record<number, string>;
}

/**
 * The declarative validator namespace. Use as `v.float`, `v.enum`, etc.
 */
export const v = {
  /**
   * Float in a range. Either bound is optional.
   * Default `min = null` (no lower bound), `max = null` (no upper bound).
   */
  float(name: string, opts: FloatOpts = {}): PropertyValidator {
    return createNumericRangeValidator(
      name,
      opts.min ?? null,
      opts.max ?? null,
      false,
      opts.message,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Float ≥ 0. Convenience alias for `v.float(name, { min: 0 })`. */
  nonNegativeFloat(name: string): PropertyValidator {
    return createNumericRangeValidator(
      name,
      0,
      null,
      false,
      undefined,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Float > 0 (strict). Useful for distances, energies, near/far planes. */
  positiveFloat(name: string, message?: string): PropertyValidator {
    return createNumericRangeValidator(
      name,
      Number.MIN_VALUE,
      null,
      false,
      message ?? `Property '${name}' must be greater than 0`,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    return createNumericRangeValidator(
      name,
      opts.min ?? null,
      opts.max ?? null,
      true,
      opts.message,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Positive integer (> 0). Specialised wrapper from `commonValidators`. */
  positiveInt(name: string, message?: string): PropertyValidator {
    return createPositiveIntegerValidator(
      name,
      message,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Integer enum, e.g. `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>
  ): PropertyValidator {
    return createEnumValidator(
      name,
      min,
      max,
      labels,
      formatCode(name),
      valueCode(name)
    );
  },

  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return createBooleanValidator(name, formatCode(name));
  },

  /** Non-empty string (anything that isn't whitespace-only). */
  string(name: string): PropertyValidator {
    return createStringValidator(name, formatCode(name));
  },

  /**
   * Quoted string `"..."` — value must begin and end with a double quote.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    const code = formatCode(name);
    return (key, value, line) => {
      if (!value.startsWith('"') || !value.endsWith('"')) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    };
  },

  /** `Vector2(x, y)` format. */
  vector2(name: string): PropertyValidator {
    return createVector2Validator(name, formatCode(name));
  },

  /**
   * `Vector2i(x, y)` integer format with optional non-negative
   * requirement (defaults to false to match the underlying factory).
   */
  vector2i(name: string, requireNonNegative = false): PropertyValidator {
    return createVector2iValidator(
      name,
      requireNonNegative,
      formatCode(name),
      valueCode(name)
    );
  },

  /** `Vector3(x, y, z)` format. */
  vector3(name: string): PropertyValidator {
    return createVector3Validator(name, formatCode(name));
  },

  /** `Rect2(x, y, w, h)` format. */
  rect2(name: string): PropertyValidator {
    return createRect2Validator(name, formatCode(name));
  },

  /** `Transform3D(...12 floats)` format. */
  transform3d(name: string): PropertyValidator {
    return createTransform3DValidator(name, formatCode(name));
  },

  /** `SubResource("id")` or `ExtResource("id")` format. */
  resourceReference(name: string): PropertyValidator {
    return createResourceReferenceValidator(
      name,
      `INVALID_${upper(name)}_REFERENCE`
    );
  },

  /** `NodePath("path/to/node")` format. */
  nodePath(name: string): PropertyValidator {
    return createNodePathValidator(name, `INVALID_${upper(name)}_PATH`);
  },

  /**
   * `Color(r, g, b, a)` format. Built inline because the existing
   * factories don't expose a Color helper, but the regex matches
   * directionallight3d/omnilight3d/spotlight3d's hand-rolled version.
   */
  color(name: string): PropertyValidator {
    return floatTupleValidator(name, 'Color', 4, 'Color with 4 numbers like Color(1, 1, 1, 1)', formatCode(name));
  },

  /** `AABB(x, y, z, w, h, d)` format. */
  aabb(name: string): PropertyValidator {
    return floatTupleValidator(name, 'AABB', 6, 'AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1)', formatCode(name));
  },

  /** `Quaternion(x, y, z, w)` format. */
  quaternion(name: string): PropertyValidator {
    return floatTupleValidator(name, 'Quaternion', 4, 'Quaternion with 4 numbers like Quaternion(0, 0, 0, 1)', formatCode(name));
  },

  /** `Transform2D(6 floats)` format. */
  transform2d(name: string): PropertyValidator {
    return floatTupleValidator(name, 'Transform2D', 6, 'Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0)', formatCode(name));
  },

  /**
   * Lenient integer — `parseInt(value, 10)` accepts trailing decimals
   * ("10.5" → 10). Used for properties like Camera2D's `limit_*` where
   * the upstream Godot parser is tolerant. The "must be a number" /
   * "must be an integer" wording follows the per-node test wording.
   */
  lenientInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return (key, value, line) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    };
  },

  /**
   * Strict integer — rejects floats that round to an integer (uses
   * `Number.isInteger(parseFloat(value))` to disambiguate "5.5" from "5").
   * Use this when the property is a discrete index/count, not a number
   * that happens to be whole-valued.
   */
  strictInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return (key, value, line) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    };
  },

  /**
   * Strict non-negative integer: same format check as `strictInt`, plus
   * `value >= 0`. Used for frame indices and similar count-style
   * properties where `"5.5"` is a format error and `-1` is a value error.
   */
  strictNonNegativeInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    return (key, value, line) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      if (parsed < 0) {
        return propertyError(key, line, `Property '${name}' must be non-negative (got ${parsed})`, valueErr);
      }
      return null;
    };
  },

  /** `Basis(9 floats)` format. */
  basis(name: string): PropertyValidator {
    return floatTupleValidator(name, 'Basis', 9, 'Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)', formatCode(name));
  },
};
