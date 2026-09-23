/**
 * Pure `Diagnostic[]` grouping per gutter line, and the problem-count badge. No
 * React or WebGL: the testable seam under the linter gutter (`r3f-main.tsx`).
 */
import { SEVERITY_ORDER, flooredSeverity, type Diagnostic, type Severity } from '@textscene/core/linter';

/** One gutter row's worth of diagnostics: the line's highest severity, and every message on it, in encounter order. */
export interface LineDiagnostics {
  line: number;
  severity: Severity;
  messages: string[];
}

/**
 * Number of lines in `text`, at least 1. It counts `\n` rather than taking
 * `text.split('\n').length`, which builds an array of every line.
 */
export function countLines(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* '\n' */) count++;
  }
  return count;
}

/**
 * True when `a` is at least as severe as `b` (lower rank = more severe), both
 * floored first: `SEVERITY_ORDER` gives `undefined` off the union, every comparison
 * with it is false, and a bogus first severity holds the row against every error.
 */
function atLeastAsSevere(a: Severity, b: Severity): boolean {
  return SEVERITY_ORDER[a] <= SEVERITY_ORDER[b];
}

/**
 * Groups diagnostics by `location.line`: the line's highest severity and every
 * message in the given order. A diagnostic with no `location.line` marks no row,
 * so it is skipped rather than given a synthetic line.
 */
export function groupDiagnosticsByLine(diagnostics: readonly Diagnostic[]): Map<number, LineDiagnostics> {
  const byLine = new Map<number, LineDiagnostics>();
  for (const d of diagnostics) {
    const line = d.location?.line;
    if (line === undefined) continue;
    const severity = flooredSeverity(d.severity);
    const existing = byLine.get(line);
    if (!existing) {
      byLine.set(line, { line, severity, messages: [d.message] });
      continue;
    }
    existing.messages.push(d.message);
    if (atLeastAsSevere(severity, existing.severity)) {
      existing.severity = severity;
    }
  }
  return byLine;
}

/** Diagnostic counts by severity and a total: the toggle badge's input. */
export interface DiagnosticsSummary {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
}

export function summarizeDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticsSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  // A switch total over the closed union, not a fall-through `else`: a fourth
  // tier fails tsc in the `default` arm below rather than passing unnoticed.
  for (const d of diagnostics) {
    const severity = flooredSeverity(d.severity);
    switch (severity) {
      case 'error':
        errors++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        infos++;
        break;
      default: {
        // Unreachable: `flooredSeverity` maps an off-union tier onto `info`.
        // The arm stays for tsc, which fails a fourth tier here.
        const unmatched: never = severity;
        void unmatched;
      }
    }
  }
  return { errors, warnings, infos, total: errors + warnings + infos };
}

/**
 * Badge text for the source-pane toggle, such as `"✖ 1 / ⚠ 2"`. `null` when there
 * is nothing to report, so the caller renders no badge.
 */
export function formatProblemBadge(summary: DiagnosticsSummary): string | null {
  if (summary.total === 0) return null;
  const parts: string[] = [];
  if (summary.errors > 0) parts.push(`✖ ${summary.errors}`);
  if (summary.warnings > 0) parts.push(`⚠ ${summary.warnings}`);
  if (summary.infos > 0) parts.push(`ℹ ${summary.infos}`);
  return parts.join(' / ');
}
