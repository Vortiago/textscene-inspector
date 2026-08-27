/** Shared constructor for the strict parser's per-property ParseError. */

import type { ParseError } from '../../linter/types.js';

/**
 * Build a property-level ParseError. The column is always `key.length + 3` —
 * it points just past the `key = ` prefix of a `key = value` property line — so
 * callers pass only the varying message and code.
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
 * The same, for a refusal of the KEY rather than of the value — an unrecognised
 * leaf name, a shape `_set` cannot resolve, a negative index.
 *
 * Every value fails such a check, `null` included, which is exactly what the
 * strict parser's nil rewrite must not restate: it says the slot stores the
 * type's zero value instead, and there is no slot. Reach for this wherever the
 * branch producing the error never looked at `value`; see
 * {@link ParseError.keyVerdict}.
 */
export function keyShapeError(
  key: string,
  line: number,
  message: string,
  code: string
): ParseError {
  return { ...propertyError(key, line, message, code), keyVerdict: true };
}
