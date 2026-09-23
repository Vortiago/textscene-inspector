/** Shared constructor for the strict parser's per-property ParseError. */

import type { ParseError } from '../../linter/types.js';

/**
 * Build a property-level ParseError. The column is always `key.length + 3`,
 * just past the `key = ` prefix of a `key = value` property line.
 */
export function propertyError(
  key: string,
  line: number,
  message: string,
  code: string,
  severity: ParseError['severity'] = 'error'
): ParseError {
  return {
    severity,
    message,
    line,
    column: key.length + 3,
    code,
  };
}

/**
 * The same, for a refusal of the key rather than the value: an unrecognised
 * leaf name, a shape `_set` cannot resolve, a negative index. Use it wherever
 * the branch never looked at `value` ({@link ParseError.keyVerdict}). Always an
 * error: the key names no slot, so no hint can bound it (ADR-0032).
 */
export function keyShapeError(
  key: string,
  line: number,
  message: string,
  code: string
): ParseError {
  return { ...propertyError(key, line, message, code), keyVerdict: true };
}

/**
 * The same, for a bare `null` refused by a setter opening with
 * `ERR_FAIL_COND(...is_null())`, so nothing is stored and the nil rewrite's
 * "stores the type's zero" is false ({@link ParseError.nilVerdict}). Always an
 * error: the setter refuses the write (ADR-0032).
 */
export function nilShapeError(
  key: string,
  line: number,
  message: string,
  code: string
): ParseError {
  return { ...propertyError(key, line, message, code), nilVerdict: true };
}
