/**
 * Declarative validator namespace `v` — the thin DSL that lets each
 * node's `linterParser.ts` become a flat property → combinator map.
 *
 * Before this file the 31
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

const RECT2I_RE = /^Rect2i\(\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\)$/;

/**
 * One TSCN quoted literal: a quote, an escape-aware body, a closing quote, and
 * nothing after it. The previous `".*"` only checked the first and last
 * character, so it accepted `"Head" junk "Tail"` as a single string.
 *
 * `\"` inside the value is honoured. A raw newline is accepted too — the body
 * class permits one — which costs nothing, because StrictTscnParser skips
 * multiline properties before any validator sees them.
 *
 * Measured before tightening: across the corpus (699 files, 1,971 quoted
 * values) this and `".*"` disagree on nothing, so no real scene changes verdict.
 */
const QUOTED_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;
const STRING_NAME_RE = /^&?"(?:[^"\\]|\\[\s\S])*"$/;

/**
 * Tag a validator with what it accepts, for the generated `## Linting` table.
 * Exported so a slice with a bespoke validator can describe it too — an
 * untagged one renders an empty cell, which `validatorAccepts.test.ts` fails on.
 */
export function accepts(validator: PropertyValidator, description: string): PropertyValidator {
  validator.accepts = description;
  return validator;
}

/** `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds. */
function numericRange(kind: 'float' | 'integer', min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${kind} ${min}-${max}`;
  if (min !== undefined) return `${kind} >= ${min}`;
  if (max !== undefined) return `${kind} <= ${max}`;
  return kind;
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
    return accepts(
      createNumericRangeValidator(
      name,
      opts.min ?? null,
      opts.max ?? null,
      false,
        opts.message,
        formatCode(name),
        valueCode(name)
      ),
      numericRange('float', opts.min, opts.max)
    );
  },

  /** Float ≥ 0. Convenience alias for `v.float(name, { min: 0 })`. */
  nonNegativeFloat(name: string): PropertyValidator {
    return accepts(
      createNumericRangeValidator(name, 0, null, false, undefined, formatCode(name), valueCode(name)),
      'float >= 0'
    );
  },

  /** Float > 0 (strict). Useful for distances, energies, near/far planes. */
  positiveFloat(name: string, message?: string): PropertyValidator {
    return accepts(
      createNumericRangeValidator(
        name,
        Number.MIN_VALUE,
        null,
        false,
        message ?? `Property '${name}' must be greater than 0`,
        formatCode(name),
        valueCode(name)
      ),
      'float > 0'
    );
  },

  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    return accepts(
      createNumericRangeValidator(
        name,
        opts.min ?? null,
        opts.max ?? null,
        true,
        opts.message,
        formatCode(name),
        valueCode(name)
      ),
      numericRange('integer', opts.min, opts.max)
    );
  },

  /** Positive integer (> 0). Specialised wrapper from `commonValidators`. */
  positiveInt(name: string, message?: string): PropertyValidator {
    return accepts(
      createPositiveIntegerValidator(name, message, formatCode(name), valueCode(name)),
      'integer > 0'
    );
  },

  /** Integer enum, e.g. `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>
  ): PropertyValidator {
    // The labels are the point: `enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)`
    // tells a reader what each number means without opening Godot's docs.
    const names = Object.keys(labels)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => labels[k])
      .join('/');
    return accepts(
      createEnumValidator(name, min, max, labels, formatCode(name), valueCode(name)),
      `enum ${min}-${max} (${names})`
    );
  },

  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return accepts(createBooleanValidator(name, formatCode(name)), 'true or false');
  },

  /** Non-empty string (anything that isn't whitespace-only). */
  string(name: string): PropertyValidator {
    return accepts(createStringValidator(name, formatCode(name)), 'non-empty string');
  },

  /**
   * Quoted string `"..."` — value must begin and end with a double quote.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    const code = formatCode(name);
    return accepts((key, value, line) => {
      if (!QUOTED_RE.test(value)) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string');
  },

  /**
   * A `StringName` property: Godot writes `&"value"`, but the variant text
   * parser also accepts a plain `"value"`, and both appear in real scenes — so
   * `quotedString` would reject the form the engine itself saves.
   */
  stringName(name: string): PropertyValidator {
    const code = formatCode(name);
    return accepts((key, value, line) => {
      if (!STRING_NAME_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a string, quoted or a StringName literal (&"…"), got: ${value}`,
          code
        );
      }
      return null;
    }, 'quoted string or &"name"');
  },

  /** `Rect2i(x, y, w, h)` integer format. */
  rect2i(name: string): PropertyValidator {
    const code = formatCode(name);
    return accepts((key, value, line) => {
      if (!RECT2I_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be Rect2i(x, y, w, h) with integer components, got: ${value}`,
          code
        );
      }
      return null;
    }, 'Rect2i(x, y, w, h)');
  },

  /** `Vector2(x, y)` format. */
  vector2(name: string): PropertyValidator {
    return accepts(createVector2Validator(name, formatCode(name)), 'Vector2(x, y)');
  },

  /**
   * `Vector2i(x, y)` integer format with optional non-negative
   * requirement (defaults to false to match the underlying factory).
   */
  vector2i(name: string, requireNonNegative = false): PropertyValidator {
    return accepts(
      createVector2iValidator(name, requireNonNegative, formatCode(name), valueCode(name)),
      requireNonNegative ? 'Vector2i(x, y), both >= 0' : 'Vector2i(x, y)'
    );
  },

  /** `Vector3(x, y, z)` format. */
  vector3(name: string): PropertyValidator {
    return accepts(createVector3Validator(name, formatCode(name)), 'Vector3(x, y, z)');
  },

  /** `Rect2(x, y, w, h)` format. */
  rect2(name: string): PropertyValidator {
    return accepts(createRect2Validator(name, formatCode(name)), 'Rect2(x, y, w, h)');
  },

  /** `Transform3D(...12 floats)` format. */
  transform3d(name: string): PropertyValidator {
    return accepts(createTransform3DValidator(name, formatCode(name)), 'Transform3D(12 floats)');
  },

  /** `SubResource("id")` or `ExtResource("id")` format. */
  resourceReference(name: string): PropertyValidator {
    return accepts(
      createResourceReferenceValidator(
      name,
      `INVALID_${upper(name)}_REFERENCE`
    ),
      'SubResource("id") or ExtResource("id")'
    );
  },

  /** `NodePath("path/to/node")` format. */
  nodePath(name: string): PropertyValidator {
    return accepts(
      createNodePathValidator(name, `INVALID_${upper(name)}_PATH`),
      'NodePath("path/to/node")'
    );
  },

  /**
   * `Color(r, g, b, a)` format. Built inline because the existing
   * factories don't expose a Color helper, but the regex matches
   * directionallight3d/omnilight3d/spotlight3d's hand-rolled version.
   */
  color(name: string): PropertyValidator {
    return accepts(
      floatTupleValidator(name, 'Color', 4, 'Color with 4 numbers like Color(1, 1, 1, 1)', formatCode(name)),
      'Color(r, g, b, a)'
    );
  },

  /** `AABB(x, y, z, w, h, d)` format. */
  aabb(name: string): PropertyValidator {
    return accepts(
      floatTupleValidator(name, 'AABB', 6, 'AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1)', formatCode(name)),
      'AABB(x, y, z, w, h, d)'
    );
  },

  /** `Quaternion(x, y, z, w)` format. */
  quaternion(name: string): PropertyValidator {
    return accepts(
      floatTupleValidator(name, 'Quaternion', 4, 'Quaternion with 4 numbers like Quaternion(0, 0, 0, 1)', formatCode(name)),
      'Quaternion(x, y, z, w)'
    );
  },

  /** `Transform2D(6 floats)` format. */
  transform2d(name: string): PropertyValidator {
    return accepts(
      floatTupleValidator(name, 'Transform2D', 6, 'Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0)', formatCode(name)),
      'Transform2D(6 floats)'
    );
  },

  /**
   * Lenient integer — `parseInt(value, 10)` accepts trailing decimals
   * ("10.5" → 10). Used for properties like Camera2D's `limit_*` where
   * the upstream Godot parser is tolerant. The "must be a number" /
   * "must be an integer" wording follows the per-node test wording.
   */
  lenientInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return accepts(
      (key, value, line) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    },
      'integer'
    );
  },

  /**
   * Strict integer — rejects floats that round to an integer (uses
   * `Number.isInteger(parseFloat(value))` to disambiguate "5.5" from "5").
   * Use this when the property is a discrete index/count, not a number
   * that happens to be whole-valued.
   */
  strictInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return accepts(
      (key, value, line) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    },
      'integer'
    );
  },

  /**
   * Strict non-negative integer: same format check as `strictInt`, plus
   * `value >= 0`. Used for frame indices and similar count-style
   * properties where `"5.5"` is a format error and `-1` is a value error.
   */
  strictNonNegativeInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    return accepts(
      (key, value, line) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      if (parsed < 0) {
        return propertyError(key, line, `Property '${name}' must be non-negative (got ${parsed})`, valueErr);
      }
      return null;
    },
      'integer >= 0'
    );
  },

  /** `Basis(9 floats)` format. */
  basis(name: string): PropertyValidator {
    return accepts(
      floatTupleValidator(name, 'Basis', 9, 'Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)', formatCode(name)),
      'Basis(9 floats)'
    );
  },

  /**
   * `PackedVector2Array(x, y, x, y, …)`, an arbitrary-length list of coordinate PAIRS.
   *
   * Not built on `floatTupleValidator`, which pins an exact arity. The interesting
   * failure here is the one arity cannot express: an ODD number of values, meaning a
   * truncated final vertex. That is a value error rather than a format error, because
   * the grammar parsed fine and the content is wrong.
   *
   * Godot serialises an empty array as `PackedVector2Array()`, so zero values is legal.
   * Godot writes signed, scientific (`4.37114e-08`) and whitespace-padded numbers.
   *
   * Implemented standalone rather than reusing `parsePackedVector2Array` from the
   * resources layer: that helper throws on bad input instead of returning a ParseError,
   * and does not check pair parity at all.
   */
  packedVector2Array(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const WRAPPER = /^\s*PackedVector2Array\s*\(([\s\S]*)\)\s*$/;
    return accepts(
      (key, value, line) => {
      const match = WRAPPER.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a PackedVector2Array like PackedVector2Array(0, 0, 1, 0), got: ${value}`,
          formatErr
        );
      }
      const body = match[1]!.trim();
      if (body === '') return null;

      const parts = body.split(',');
      for (const part of parts) {
        const n = Number(part.trim());
        if (part.trim() === '' || !Number.isFinite(n)) {
          return propertyError(
            key,
            line,
            `Property '${name}' contains a non-numeric value: "${part.trim()}"`,
            formatErr
          );
        }
      }
      if (parts.length % 2 !== 0) {
        return propertyError(
          key,
          line,
          `Property '${name}' must contain coordinate pairs, got ${parts.length} values (odd)`,
          valueErr
        );
      }
      return null;
    },
      'PackedVector2Array(x, y, …) — even count'
    );
  },
};
