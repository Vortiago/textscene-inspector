/**
 * The order every host shows diagnostics in, and the merge of a file's own diagnostics with the cross-file ones a
 * `LintSession` reads later. `Linter` and the session sort through it, so every host shows one order.
 */

import { SEVERITY_ORDER, flooredSeverity, type Diagnostic } from './types.js';

/**
 * `diagnostics` sorted by severity, errors first, in place, an unranked tier floored to `info`. A bare index gives
 * `undefined` for a severity outside the union, and the `NaN` difference reads as "equal", leaving the order undecided.
 * The sort is stable, so the order within a tier stays.
 */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => SEVERITY_ORDER[flooredSeverity(a.severity)] - SEVERITY_ORDER[flooredSeverity(b.severity)]
  );
}

/** A new list of `local` and `crossFile` together, sorted by severity. Neither input changes. */
export function mergeDiagnostics(local: readonly Diagnostic[], crossFile: readonly Diagnostic[]): Diagnostic[] {
  return sortDiagnostics(local.concat(crossFile));
}
