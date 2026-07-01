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
  code: string
): ParseError {
  return {
    severity: 'error',
    message,
    line,
    column: key.length + 3,
    code,
  };
}
