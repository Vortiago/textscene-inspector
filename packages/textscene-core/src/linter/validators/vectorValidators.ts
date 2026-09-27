/** Validator factories and regexes for the Vector, Rect2 and Transform3D literals. */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { truncatedComponent } from './intSlot.js';
import { floatTupleValidator, makeFloatTupleRegex } from './floatTupleValidator.js';
import { ruleInt, tupleComponent } from './commonValidators.js';
import { slotComponents, slotComponentsAltered } from '../../godot/int.js';
import { compositeTypeName, isConvertedSpelling } from '../../godot/variantConversion.js';

/**
 * Vector3 format: Vector3(x, y, z), for the callers that `.exec()` it to reach
 * the three components for their own checks.
 */
export const VECTOR3_REGEX = makeFloatTupleRegex('Vector3', 3);

/**
 * Vector2 format: Vector2(x, y), for the callers that `.exec()` it to reach the
 * two components. Use this, not a local `makeFloatTupleRegex('Vector2', 2)`.
 */
export const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

/**
 * `Vector2i(x, y)`, with the components Godot's parser takes:
 * `_parse_construct<int32_t>` (variant_parser.cpp:577-592) accepts any number
 * token and truncates it toward zero, so `Vector2i(2e1, 0)` stores `(20, 0)`.
 */
export const VECTOR2I_REGEX = makeFloatTupleRegex('Vector2i', 2);

/**
 * The two components a `Vector2i` slot holds, for every phase-2 rule over one,
 * or `null` when no int32 holds one. Phase 2 runs after a phase-1 error
 * (`linter/Linter.ts:32`), so on `null` the rule skips and phase 1's error
 * stands, rather than quote a value the file does not state.
 */
export function matchVector2i(raw: string): { x: number; y: number } | null {
  const match = VECTOR2I_REGEX.exec(raw);
  if (!match) return null;
  // A `Vector2(...)` in a Vector2i slot holds doubles, so both components take
  // the `double -> int32` branch whatever the token looks like.
  const converted = isConvertedSpelling('Vector2i', compositeTypeName(raw));
  const x = ruleInt(match[1], null, 'int32', converted);
  const y = ruleInt(match[2], null, 'int32', converted);
  return x === null || y === null ? null : { x, y };
}

/**
 * The three components a `Vector3` slot holds, for every phase-2 rule over one, or
 * `null` when the literal is malformed or one component does not survive. On `null`
 * the rule skips and the format validator's finding stands.
 */
export function matchVector3(raw: string): { x: number; y: number; z: number } | null {
  const trimmed = raw.trim();
  const match = VECTOR3_REGEX.exec(trimmed);
  if (!match) return null;
  const captures = [match[1], match[2], match[3]];
  // Withheld, not NaN: the engine stores a number, but not the one written, and
  // `_to_int`'s float branch is undefined behaviour (variant.h:369-370).
  if (slotComponentsAltered(trimmed, 'Vector3', captures)) return null;
  // The `Vector3i(...)` spelling Godot converts narrows its arguments to int32
  // before the widening.
  const [x, y, z] = slotComponents(trimmed, 'Vector3', captures, tupleComponent);
  return { x: x!, y: y!, z: z! };
}

/** A `Vector2(x, y)` format validator. */
export function createVector2Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return floatTupleValidator(
    propertyName,
    'Vector2',
    2,
    'Vector2 with 2 numbers like Vector2(0, 0)',
    errorCode
  );
}

/**
 * A `Vector2i(x, y)` validator with an optional per-component minimum, which
 * need not be 0: `Viewport::_set_size` does `p_size.maxi(2)`.
 */
export function createVector2iValidator(
  propertyName: string,
  minComponent: number | undefined = undefined,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /** Severity of the minimum branch: `warning` when only a hint backs it. */
  valueSeverity: ParseError['severity'] = 'error'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const match = VECTOR2I_REGEX.exec(value);
    if (!match) {
      return propertyError(key, line, `Property '${propertyName}' must be Vector2i(x, y) — or the Vector2 spelling Godot converts into it — got: "${value}"`, errorCodeFormat);
    }

    // A non-finite component reads but does not fit: `_parse_construct<int32_t>`
    // narrows at parse time (variant_parser.cpp:593) to an architecture-specific
    // value, so the message names the literal. An alteration errors under
    // ADR-0032, bounded or not.
    const converted = isConvertedSpelling('Vector2i', compositeTypeName(value));
    // Truncated toward zero, as the int32 conversion does, so `0.9` is bounded as
    // the 0 Godot stores. A `Vector2(...)` spelling holds doubles, so
    // `Vector2(4294967295, 64)` takes the `double -> int32` branch to the UB sentinel.
    const x = ruleInt(match[1], null, 'int32', converted);
    const y = ruleInt(match[2], null, 'int32', converted);
    if (x === null || y === null) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' has a component Godot cannot store in an integer slot, got: "${value}". The file loads, but the value is narrowed at parse time to a number the file does not state.`,
        errorCodeValue,
        'error'
      );
    }

    // Computed here, returned last: a component that is both fractional and
    // below the floor has a real error to report, and that outranks the warning.
    const truncated = truncatedComponent(propertyName, key, line, [match[1], match[2]], errorCodeValue);

    if (minComponent !== undefined) {
      if (x < minComponent || y < minComponent) {
        // Per-node tests assert a substring of the 0 case's wording.
        const requirement =
          minComponent === 0 ? 'must have non-negative values' : `must have components >= ${minComponent}`;
        return propertyError(key, line, `Property '${propertyName}' ${requirement}, got: Vector2i(${x}, ${y})`, errorCodeValue, valueSeverity);
      }
    }

    return truncated;
  };
}

/** A `Vector3(x, y, z)` format validator. */
export function createVector3Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return floatTupleValidator(
    propertyName,
    'Vector3',
    3,
    'Vector3 with 3 numbers like Vector3(0, 0, 0)',
    errorCode
  );
}

/** A `Rect2(x, y, w, h)` format validator. */
export function createRect2Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return floatTupleValidator(
    propertyName,
    'Rect2',
    4,
    'Rect2 format like Rect2(0, 0, 100, 100)',
    errorCode
  );
}

/** A `Transform3D(12 floats)` format validator. */
export function createTransform3DValidator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return floatTupleValidator(
    propertyName,
    'Transform3D',
    12,
    'Transform3D with 12 numbers like Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
    errorCode
  );
}
