/** Shared validator utilities for Vector types */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { floatTupleValidator, makeFloatTupleRegex } from './floatTupleValidator.js';
import { ruleInt } from './commonValidators.js';

/**
 * Vector3 format: Vector3(x, y, z). Re-derived from the canonical float grammar
 * and re-exported because node3d/skeleton3d/rigidbody3d linterParsers `.exec()`
 * it directly for their bespoke component checks (3 capture groups).
 */
export const VECTOR3_REGEX = makeFloatTupleRegex('Vector3', 3);

/**
 * Vector2 format: Vector2(x, y), for the callers that `.exec()` it directly to
 * reach the two components rather than just validating the shape.
 *
 * Exported for the same reason as VECTOR3_REGEX, and belatedly: five call sites
 * had each built their own `makeFloatTupleRegex('Vector2', 2)` — camera2d,
 * navigationlink2d, parallax2d, the Node2D base and characterBodyLinterRule.
 * Identical today, and identical only for as long as nobody edits one.
 */
export const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

/**
 * `Vector2i(x, y)`, with the components Godot's parser actually takes.
 *
 * `_parse_construct<int32_t>` (variant_parser.cpp:577-592) accepts any number
 * token and pushes it into a `Vector<int32_t>`, so a component written as a
 * float or in exponent notation loads and truncates toward zero. A `-?\d+`
 * component grammar reported a format error on `Vector2i(2e1, 0)`, which Godot
 * stores as `Vector2i(20, 0)`.
 */
export const VECTOR2I_REGEX = makeFloatTupleRegex('Vector2i', 2);

/**
 * Creates a Vector2 validator
 */
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
 * Creates a Vector2i validator with an optional per-COMPONENT minimum.
 *
 * `minComponent` was a `requireNonNegative` boolean, which could only ever say
 * "0". Real setters floor elsewhere: `Viewport::_set_size` does `p_size.maxi(2)`,
 * so a `SubViewport` sized 1 is altered exactly as a negative one is, and a
 * boolean had no way to say so.
 */
export function createVector2iValidator(
  propertyName: string,
  minComponent: number | undefined = undefined,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /** Severity of the minimum branch — `warning` when only a hint backs it. */
  valueSeverity: ParseError['severity'] = 'error'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const match = VECTOR2I_REGEX.exec(value);
    if (!match) {
      return propertyError(key, line, `Property '${propertyName}' must be Vector2i format like Vector2i(0, 0), got: "${value}"`, errorCodeFormat);
    }

    // A non-finite component READS but does not FIT. `_parse_construct<int32_t>`
    // narrows at parse time (variant_parser.cpp:593), so the value Godot stores
    // is not the one the file states — measured as -2147483648 for all four
    // spellings on 4.6.3 x86_64, and architecture-specific in general, which is
    // why the message names the literal rather than the result. An alteration
    // is the error tier under ADR-0032, and this arm is independent of `min`:
    // it applies to every Vector2i, bounded or not.
    // Truncated toward zero, the way the int32 conversion does, so `0.9` is
    // bounded as the 0 Godot stores rather than as the 0.9 it was written.
    const x = ruleInt(match[1]);
    const y = ruleInt(match[2]);
    if (x === null || y === null) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' has a component Godot cannot store in an integer slot, got: "${value}". The file loads, but the value is narrowed at parse time to a number the file does not state.`,
        errorCodeValue,
        'error'
      );
    }

    if (minComponent !== undefined) {
      if (x < minComponent || y < minComponent) {
        // The 0 case keeps its long-standing wording; every per-node test that
        // asserts a substring of it is asserting the engine's floor, not the phrasing.
        const requirement =
          minComponent === 0 ? 'must have non-negative values' : `must have components >= ${minComponent}`;
        return propertyError(key, line, `Property '${propertyName}' ${requirement}, got: Vector2i(${x}, ${y})`, errorCodeValue, valueSeverity);
      }
    }

    return null;
  };
}

/**
 * Creates a Vector3 validator
 */
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

/**
 * Creates a Rect2 validator
 */
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

/**
 * Creates a Transform3D validator
 */
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
