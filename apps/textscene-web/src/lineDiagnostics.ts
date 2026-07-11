/**
 * Issue #202 — pure `Diagnostic[]` → per-line gutter grouping + problem-count
 * badge formatting. No React, no WebGL: the unit-testable seam the linter
 * gutter (`r3f-main.tsx`) builds on.
 */
import { SEVERITY_ORDER, type Diagnostic, type Severity } from '@textscene/core/linter';

/** One gutter row's worth of diagnostics: the line's highest severity, and every message on it, in encounter order. */
export interface LineDiagnostics {
  line: number;
  severity: Severity;
  messages: string[];
}

/**
 * Number of lines in `text` (at least 1, even for an empty buffer) — counts
 * `\n` occurrences directly instead of `text.split('\n').length`, which
 * would materialize a full array of every line just to read its count.
 */
export function countLines(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* '\n' */) count++;
  }
  return count;
}

/** True when `a` is at least as severe as `b` (lower rank = more severe). */
function atLeastAsSevere(a: Severity, b: Severity): boolean {
  return SEVERITY_ORDER[a] <= SEVERITY_ORDER[b];
}

/**
 * Groups diagnostics by `location.line`, collapsing multiple diagnostics on
 * the same line into one entry: the highest severity present on that line,
 * plus every message on it in the order the diagnostics were given. A
 * diagnostic with no `location.line` can't mark a gutter row, so it is
 * silently skipped rather than surfaced under a synthetic line number.
 */
export function groupDiagnosticsByLine(diagnostics: readonly Diagnostic[]): Map<number, LineDiagnostics> {
  const byLine = new Map<number, LineDiagnostics>();
  for (const d of diagnostics) {
    const line = d.location?.line;
    if (line === undefined) continue;
    const existing = byLine.get(line);
    if (!existing) {
      byLine.set(line, { line, severity: d.severity, messages: [d.message] });
      continue;
    }
    existing.messages.push(d.message);
    if (atLeastAsSevere(d.severity, existing.severity)) {
      existing.severity = d.severity;
    }
  }
  return byLine;
}

/** Diagnostic counts by severity, plus a total — the toggle badge's raw input. */
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
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, total: errors + warnings + infos };
}

/**
 * Compact badge text for the source-pane toggle (e.g. `"✖ 1 / ⚠ 2"`). `null`
 * when there is nothing to report, so the caller can skip rendering a badge
 * entirely rather than showing an empty one.
 */
export function formatProblemBadge(summary: DiagnosticsSummary): string | null {
  if (summary.total === 0) return null;
  const parts: string[] = [];
  if (summary.errors > 0) parts.push(`✖ ${summary.errors}`);
  if (summary.warnings > 0) parts.push(`⚠ ${summary.warnings}`);
  if (summary.infos > 0) parts.push(`ℹ ${summary.infos}`);
  return parts.join(' / ');
}
