/**
 * The one reading of `Diagnostic.location` every host shares, so the web gutter, the VS Code
 * Problems panel and the `tscn-lsp` server agree on which diagnostics are about a line, which
 * about the file, and where each squiggle sits.
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

/** The lines of the open document a squiggle is clamped into. */
export interface DiagnosticLines {
  readonly lineCount: number;
  /** The length of the zero-based line `line`. */
  lineLength(line: number): number;
}

/** A zero-based squiggle, as LSP and VS Code count lines and characters. */
export interface DiagnosticRange {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Where a diagnostic's squiggle sits: its line clamped into the document, from its column to
 * the line's end. One that names no line is about the whole file, so it gets a zero-width range
 * at the start: a client lists it at line 1, column 1, with no squiggle under line 1's text.
 */
export function diagnosticRange(
  diagnostic: Pick<Diagnostic, 'location'>,
  lines: DiagnosticLines
): DiagnosticRange {
  const line = diagnosticLine(diagnostic);
  if (line === undefined) return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

  const lineIndex = clamp(line - 1, 0, Math.max(lines.lineCount - 1, 0));
  const lineLength = lines.lineLength(lineIndex);
  const column = diagnostic.location?.column;
  const start = typeof column === 'number' ? clamp(column - 1, 0, lineLength) : 0;
  return {
    start: { line: lineIndex, character: start },
    end: { line: lineIndex, character: Math.max(lineLength, start) },
  };
}
