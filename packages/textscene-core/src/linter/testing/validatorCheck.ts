/**
 * The apparatus every slice's `linterParser.test.ts` shares. A rejection names a
 * message substring, because a tier alone matches any same-tier arm, and the
 * validator derives its tier from its own `enforced:` or `hinted:` declaration
 * (ADR-0032). The message carries the bound's number and the setter's refusal.
 */

import { expect } from 'vitest';
import { validatorRegistry } from '../ValidatorRegistry.js';
import type { ParseError, Severity } from '../types.js';

/** The signature the per-slice `check` helpers all had. */
export type Check = (property: string, value: string, line?: number) => ParseError | null;

/**
 * A `check(property, value)` bound to one node or resource type, through the
 * linter's own `findValidator` base-walk. A property with no validator anywhere
 * fails here rather than returning `null`, which reads as accepted.
 */
export function checkerFor(type: string): Check {
  return (property, value, line = 1) => {
    const validator = validatorRegistry.findValidator(type, property);
    expect(validator, `no validator registered for ${type}.${property}`).not.toBeNull();
    return validator!(property, value, line);
  };
}

/**
 * Assert a validator refused a value at `severity`, for the reason it names.
 * `contains` must be non-empty: a message substring ties the assertion to the
 * bound in the test's title, which the tier alone cannot.
 */
export function expectRejected(
  error: ParseError | null,
  severity: Severity,
  contains: readonly string[]
): ParseError {
  expect(
    contains.length,
    'name what the message must say — a tier alone does not identify the bound'
  ).toBeGreaterThan(0);
  expect(error, `expected a ${severity}, the validator accepted the value`).not.toBeNull();
  expect(error!.severity).toBe(severity);
  for (const substring of contains) expect(error!.message).toContain(substring);
  return error!;
}

/**
 * The value is refused as an error: Godot's setter would refuse or alter it, or
 * the literal never reaches the property at all (ADR-0032).
 */
export function expectError(
  error: ParseError | null,
  ...contains: [string, ...string[]]
): ParseError {
  return expectRejected(error, 'error', contains);
}

/**
 * The value is refused as a warning: it loads, but lies outside the property's
 * own `PROPERTY_HINT_*`, or is altered before the setter sees it (ADR-0032).
 */
export function expectWarning(
  error: ParseError | null,
  ...contains: [string, ...string[]]
): ParseError {
  return expectRejected(error, 'warning', contains);
}

/** Assert the validator accepted the value. Fails with the diagnostic it gave instead. */
export function expectAccepted(error: ParseError | null): void {
  expect(error, error ? `refused: [${error.severity}] ${error.message}` : undefined).toBeNull();
}
