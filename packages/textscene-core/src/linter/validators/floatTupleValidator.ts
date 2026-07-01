/** Arity-driven validator for fixed-length float-tuple TSCN values. */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { FLOAT_PATTERN_SOURCE } from '../../parser/vectors.js';

/**
 * Build the anchored regex for a fixed-arity float tuple like `Vector3(x, y, z)`
 * or `Color(r, g, b, a)`. Each component uses the canonical
 * {@link FLOAT_PATTERN_SOURCE} shared with the renderer (parser/vectors.ts), so
 * the linter accepts exactly what the renderer parses — `.5`, `5.`, `+5` and
 * scientific notation included. Each component is a capture group, so callers
 * that `.exec()` the returned regex still read `match[1..arity]`.
 */
export function makeFloatTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join('\\s*,\\s*');
  return new RegExp(`^${typeName}\\(\\s*${body}\\s*\\)$`);
}

/**
 * A validator that a property value is `typeName(<arity floats>)`. `expectation`
 * is the human-readable "must be …" suffix (kept per-type so wording stays
 * exact, e.g. `Vector3 with 3 numbers like Vector3(0, 0, 0)` vs `Rect2 format
 * like Rect2(0, 0, 100, 100)`).
 */
export function floatTupleValidator(
  propertyName: string,
  typeName: string,
  arity: number,
  expectation: string,
  errorCode: string
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  return (key, value, line) => {
    if (!regex.test(value)) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${expectation}, got: "${value}"`,
        errorCode
      );
    }
    return null;
  };
}
