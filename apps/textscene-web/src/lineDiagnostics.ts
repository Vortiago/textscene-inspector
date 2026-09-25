/**
 * Pure `Diagnostic[]` grouping for the Source pane: per gutter line, and the file-level section
 * for a diagnostic that names no line. It also builds the problem-count badge. No React or
 * WebGL: the testable seam under `r3f-main.tsx`.
 */
import {
  SEVERITY_ORDER,
  diagnosticLine,
  flooredSeverity,
  type Diagnostic,
  type Severity,
} from '@textscene/core/linter';

/** Diagnostics shown together: their highest severity, and every message, in encounter order. */
export interface DiagnosticGroup {
  severity: Severity;
  messages: string[];
}

/** One gutter row's worth of diagnostics. */
export interface LineDiagnostics extends DiagnosticGroup {
  line: number;
}

/**
 * The two homes of the badge's findings. Every diagnostic lands in exactly one, so the badge
 * counts only what the pane can show.
 */
export interface GroupedDiagnostics {
  byLine: Map<number, LineDiagnostics>;
  /** The diagnostics that name no gutter row, or `null` when there is none. */
  fileLevel: DiagnosticGroup | null;
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

/** Adds one diagnostic to `group`, which keeps the higher severity. */
function addTo(group: DiagnosticGroup, severity: Severity, message: string): void {
  group.messages.push(message);
  if (atLeastAsSevere(severity, group.severity)) group.severity = severity;
}

/**
 * Groups diagnostics by `location.line`, each line with its highest severity and every message
 * in the given order. A diagnostic that names no row of the buffer's `lineCount` goes to the
 * file-level group, never onto a synthetic line: a dot on line 1 would claim that line is at
 * fault. A line past the end is one a lint of older text named, before lines were deleted.
 */
export function groupDiagnostics(
  diagnostics: readonly Diagnostic[],
  lineCount: number
): GroupedDiagnostics {
  const byLine = new Map<number, LineDiagnostics>();
  let fileLevel: DiagnosticGroup | null = null;
  for (const d of diagnostics) {
    const severity = flooredSeverity(d.severity);
    const line = diagnosticLine(d);
    if (line === undefined || line > lineCount) {
      if (fileLevel) addTo(fileLevel, severity, d.message);
      else fileLevel = { severity, messages: [d.message] };
      continue;
    }
    const existing = byLine.get(line);
    if (existing) addTo(existing, severity, d.message);
    else byLine.set(line, { line, severity, messages: [d.message] });
  }
  return { byLine, fileLevel };
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
