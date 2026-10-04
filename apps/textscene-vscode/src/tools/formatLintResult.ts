/**
 * Formats a lint result as the text a language model reads: one line per finding,
 * with its line, tier, message and rule. The same `Diagnostic` rows the Problems
 * panel shows, so an agent and the user see one verdict.
 */

import type { Diagnostic } from '@textscene/core/linter';

/** The lint outcome for one file, as plain text. */
export function formatLintResult(fileName: string, diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return `${fileName}: no findings.`;
  const count = diagnostics.length === 1 ? '1 finding' : `${diagnostics.length} findings`;
  const lines = [`${fileName}: ${count}.`];
  for (const diagnostic of diagnostics) {
    const where = diagnostic.location?.line !== undefined ? `line ${diagnostic.location.line}` : 'the file';
    const subject = diagnostic.nodeName ? ` ${diagnostic.nodeName} (${diagnostic.nodeType})` : '';
    lines.push(
      `  ${where}: [${diagnostic.severity}] ${diagnostic.message} (${diagnostic.ruleName})${subject}`
    );
  }
  return lines.join('\n');
}
