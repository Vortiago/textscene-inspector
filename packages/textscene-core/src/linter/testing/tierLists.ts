/**
 * The diagnostic lists linter tests assert on, named for the tier they hold, so
 * a name always means one filter. It imports types only, so a test that keeps
 * the linter barrel out can use it.
 */

import { expect } from 'vitest';
import type { Diagnostic, Severity } from '../types.js';

/** The diagnostics at `tier`, narrowed to `ruleName` when one is given. */
const atTier =
  (tier: Severity) =>
  (diagnostics: readonly Diagnostic[], ruleName?: string): Diagnostic[] =>
    diagnostics.filter(
      (d) => d.severity === tier && (ruleName === undefined || d.ruleName === ruleName)
    );

export const errorsOf = atTier('error');
export const warningsOf = atTier('warning');

/**
 * `ruleName`'s diagnostics, each asserted to be at `tier`. Filtering by tier
 * instead would hide a rule that moved tier behind an empty list.
 */
export function reportsOf(
  diagnostics: readonly Diagnostic[],
  ruleName: string,
  tier: Severity
): Diagnostic[] {
  const reports = diagnostics.filter((d) => d.ruleName === ruleName);
  for (const report of reports) expect(report.severity, report.message).toBe(tier);
  return reports;
}
