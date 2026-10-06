/**
 * Formats a lint result as the text a language model reads: one line per finding,
 * with its line, severity, message and rule. It reads the `Diagnostic` rows the
 * Problems panel shows, so an agent and the user see one verdict.
 */

import { diagnosticLine, type Diagnostic } from '@textscene/core/linter';

/** The lint outcome for one file, as plain text. */
export function formatLintResult(fileName: string, diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return `${fileName}: no findings.`;
  const count = diagnostics.length === 1 ? '1 finding' : `${diagnostics.length} findings`;
  return [`${fileName}: ${count}.`, ...diagnostics.map(findingLine)].join('\n');
}

function findingLine(diagnostic: Diagnostic): string {
  const line = diagnosticLine(diagnostic);
  const where = line !== undefined ? `line ${line}` : 'the file';
  const subject = diagnostic.nodeName ? ` ${diagnostic.nodeName} (${diagnostic.nodeType})` : '';
  return `  ${where}: [${diagnostic.severity}] ${diagnostic.message} (${diagnostic.ruleName})${subject}`;
}
