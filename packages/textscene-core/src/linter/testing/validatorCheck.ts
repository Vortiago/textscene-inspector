/**
 * The apparatus every slice's `linterParser.test.ts` re-implements.
 *
 * Two things were being hand-copied into ~170 files. The five-line `check`
 * helper — find the validator, assert it exists, invoke it with a line number —
 * differed only in the type literal, so the trailing `line` argument, a
 * dispatcher wrapper, or a new field riding on `ParseError` had to be re-landed
 * once per copy. And the rejection assertion was written as
 * `expect(error?.severity).toBe('warning')` and nothing else, which any same-tier
 * refusal from the same validator satisfies: swap a hint-range arm for an
 * enum-membership arm, or check the wrong end of a range, and the test still
 * passes under a title naming the old bound.
 *
 * ADR-0032's tier is derived inside the validator from its own `enforced:` /
 * `hinted:` declaration, so a flipped tier stays self-consistent and every
 * registry-wide guard agrees with it. The MESSAGE is the second file: it carries
 * the bound's number and, for an enforced end, the sentence that says the setter
 * refused. That is why a substring is required here rather than optional.
 */

import { expect } from 'vitest';
import { validatorRegistry } from '../ValidatorRegistry.js';
import type { ParseError, Severity } from '../types.js';

/** The signature the per-slice `check` helpers all had. */
export type Check = (property: string, value: string, line?: number) => ParseError | null;

/**
 * A `check(property, value)` bound to one node or resource type.
 *
 * Resolves through `findValidator`, so the base-walk applies and an inherited
 * key answers from the ancestor that declares it — the same lookup the linter
 * makes. A property with no validator anywhere fails here rather than returning
 * `null` and reading as "accepted".
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
 *
 * `contains` is required and must be non-empty. A tier on its own says only
 * "something refused this at this severity", which is true of every other arm of
 * the same validator; naming a substring of the message ties the assertion to
 * the bound in the test's own title.
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
 * The value is refused as an ERROR: Godot's setter would refuse or alter it, or
 * the literal never reaches the property at all (ADR-0032).
 */
export function expectError(
  error: ParseError | null,
  ...contains: [string, ...string[]]
): ParseError {
  return expectRejected(error, 'error', contains);
}

/**
 * The value is refused as a WARNING: it loads, but lies outside the property's
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
