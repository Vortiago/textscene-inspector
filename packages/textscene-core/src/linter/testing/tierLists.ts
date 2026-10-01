/**
 * The diagnostic lists that linter tests assert on, where each name means one
 * filter. It imports only types from the linter, so a test that keeps the
 * linter barrel out can use it.
 */

import { expect } from 'vitest';
import type { STRICT_PARSER_RULE_NAME } from '../fileDiagnostics.js';
import type { Diagnostic, Severity } from '../types.js';
import { recordTier } from './titleTier.js';

/**
 * The diagnostics at `tier`, narrowed to the validators' when asked. Any other
 * rule goes through `reportsOf`, which checks its tier instead of filtering on it.
 * A non-empty list records its tier for the title check, and an empty one records
 * nothing, since a test asserts an empty list to say the tier is absent.
 */
const atTier =
  (tier: Severity) =>
  (diagnostics: readonly Diagnostic[], ruleName?: typeof STRICT_PARSER_RULE_NAME): Diagnostic[] => {
    const found = diagnostics.filter(
      (d) => d.severity === tier && (ruleName === undefined || d.ruleName === ruleName)
    );
    if (found.length > 0) recordTier(tier);
    return found;
  };

export const errorsOf = atTier('error');
export const warningsOf = atTier('warning');
export const infosOf = atTier('info');

/**
 * `ruleName`'s diagnostics, after it asserts that each one is at `tier`.
 * Filtering by tier instead would hide a rule that moved tier behind an empty list.
 * Each assertion records `tier`, so a rule that reports nothing records nothing.
 */
export function reportsOf(
  diagnostics: readonly Diagnostic[],
  ruleName: string,
  tier: Severity
): Diagnostic[] {
  const reports = diagnostics.filter((d) => d.ruleName === ruleName);
  for (const report of reports) expect(report).toBeAtTier(tier);
  return reports;
}
