/**
 * The one reading of `Diagnostic.location.line` every host shares, so the web gutter and the
 * VS Code Problems panel agree on which diagnostics are about a line and which about the file.
 */

import type { Diagnostic } from './types.js';

/**
 * The 1-based line `diagnostic` names, or `undefined` where it names none: no line, or 0, a
 * negative, a fraction or `NaN`, which no editor row carries. A host shows such a diagnostic
 * as one about the whole file.
 */
export function diagnosticLine(diagnostic: Pick<Diagnostic, 'location'>): number | undefined {
  const line = diagnostic.location?.line;
  return line !== undefined && Number.isInteger(line) && line >= 1 ? line : undefined;
}
