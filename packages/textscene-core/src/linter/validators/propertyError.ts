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
 *
 * Error-tier by construction, so it takes no `severity`: the key names no slot,
 * so the value reaches no property and is nowhere — the ADR-0032 error tier.
 * A hint bounds a slot that exists, and there is none to bound.
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
 * The same, for a refusal of a bare `null` handed to a slot that exists — a
 * setter opening with an `ERR_FAIL_COND(...is_null())`, where nothing is
 * stored at all.
 *
 * The strict parser's nil rewrite must not restate that either: it claims the
 * slot holds the type's zero, which is what a slot whose CONVERSION discards
 * the null does, not one whose setter refuses it. See
 * {@link ParseError.nilVerdict}.
 *
 * Error-tier by construction, so it takes no `severity`: an `ERR_FAIL_COND` is
 * the setter refusing the write, which is the ADR-0032 error tier by
 * definition. Nothing is stored, so no hint has anything to say about it.
 */
export function nilShapeError(
  key: string,
  line: number,
  message: string,
  code: string
): ParseError {
  return { ...propertyError(key, line, message, code), nilVerdict: true };
}
