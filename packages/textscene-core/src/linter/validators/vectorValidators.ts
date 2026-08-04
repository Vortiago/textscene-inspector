/** Shared validator utilities for Vector types */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { floatTupleValidator, makeFloatTupleRegex } from './floatTupleValidator.js';

/**
 * Vector3 format: Vector3(x, y, z). Re-derived from the canonical float grammar
 * and re-exported because node3d/skeleton3d/rigidbody3d linterParsers `.exec()`
 * it directly for their bespoke component checks (3 capture groups).
 */
export const VECTOR3_REGEX = makeFloatTupleRegex('Vector3', 3);

/** Vector2i format: Vector2i(x, y) - two comma-separated integers */
export const VECTOR2I_REGEX = /^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;

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

    if (minComponent !== undefined) {
      const x = parseInt(match[1] || '0', 10);
      const y = parseInt(match[2] || '0', 10);
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
