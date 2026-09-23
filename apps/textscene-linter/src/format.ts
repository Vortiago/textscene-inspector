/** Pure output formatting for the TSCN linter CLI (no I/O). */

import { flooredSeverity, type Diagnostic, type Severity } from '@textscene/core/linter';
import type { FileDiagnostics } from './lint';

/**
 * One machine-readable finding, flattened out of a per-file lint outcome:
 * one object per diagnostic (or, for an unreadable file, one synthetic
 * `file-read-error` finding). This is the `--format json` output shape and
 * the source data for `--format github` annotations.
 */
export interface JsonFinding {
  file: string;
  line: number | null;
  column: number | null;
  severity: Severity;
  rule: string;
  message: string;
  nodeType: string;
  nodeName: string;
}

/**
 * Format lint results for one file as stdout lines.
 * Clean files produce a single success line; files with diagnostics produce
 * a file-path header, one line per diagnostic, and a trailing blank line.
 */
export function formatDiagnostics(
  filePath: string,
  diagnostics: Diagnostic[],
  hasColor: boolean
): string[] {
  if (diagnostics.length === 0) {
    return [formatSuccess(`✓ ${filePath}`, hasColor)];
  }

  const lines: string[] = [formatFilePath(filePath, hasColor)];

  for (const diagnostic of diagnostics) {
    const icon = getSeverityIcon(diagnostic.severity);
    const severityText = formatSeverity(diagnostic.severity, hasColor);
    const nodeInfo = formatDim(`[${diagnostic.nodeType}:${diagnostic.nodeName}]`, hasColor);
    const ruleInfo = formatDim(`(${diagnostic.ruleName})`, hasColor);

    lines.push(`  ${icon} ${severityText} ${nodeInfo} ${diagnostic.message} ${ruleInfo}`);
  }

  lines.push('');
  return lines;
}

/**
 * Flattens per-file lint outcomes into one finding per diagnostic, in file
 * order. A file that failed to read contributes a single synthetic
 * `file-read-error` finding instead of per-diagnostic ones.
 */
export function toJsonFindings(files: FileDiagnostics[]): JsonFinding[] {
  const findings: JsonFinding[] = [];

  for (const file of files) {
    if (file.readError !== undefined) {
      findings.push({
        file: file.filePath,
        line: null,
        column: null,
        severity: 'error',
        rule: 'file-read-error',
        message: file.readError,
        nodeType: '',
        nodeName: '',
      });
      continue;
    }

    for (const diagnostic of file.diagnostics) {
      findings.push({
        file: file.filePath,
        line: diagnostic.location?.line ?? null,
        column: diagnostic.location?.column ?? null,
        // Floored: `severity` is declared as the closed union, and this is the
        // one output a CI tool switches on rather than reads.
        severity: flooredSeverity(diagnostic.severity),
        rule: diagnostic.ruleName,
        message: diagnostic.message,
        nodeType: diagnostic.nodeType,
        nodeName: diagnostic.nodeName,
      });
    }
  }

  return findings;
}

/**
 * Format lint results for a whole run as a single pretty-printed JSON array
 * of findings (`--format json`), suitable for CI tooling to parse.
 */
export function formatJson(files: FileDiagnostics[]): string {
  return JSON.stringify(toJsonFindings(files), null, 2);
}

/**
 * How each severity is presented: the text icon, the ANSI colour, and the
 * GitHub Actions workflow-command level. One table, total over the closed
 * `Severity` union, so adding a severity fails tsc here instead of falling
 * silently through a `default`.
 */
const SEVERITY_DISPLAY: Record<
  Severity,
  { icon: string; color: string; github: 'error' | 'warning' | 'notice' }
> = {
  error: { icon: '✖', color: '31', github: 'error' },
  warning: { icon: '⚠', color: '33', github: 'warning' },
  info: { icon: 'ℹ', color: '36', github: 'notice' },
};

/**
 * The row an off-union severity is presented by. Floored, not absent, so the icon,
 * colour, word, JSON `severity` and workflow-command level of one finding name one
 * tier. `flooredSeverity` also keeps out `'constructor'`, which a bare index
 * reaches through Object.prototype.
 */
function displayFor(severity: string): (typeof SEVERITY_DISPLAY)[Severity] {
  return SEVERITY_DISPLAY[flooredSeverity(severity)];
}

/**
 * Escapes workflow-command *data* (the `::command ...::<data>` payload) per
 * the GitHub Actions toolkit's escaping rules.
 */
function escapeGithubData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/**
 * Escapes workflow-command *property values* (the `key=<value>` parts),
 * which additionally escape `:` and `,` since those delimit properties.
 */
function escapeGithubProperty(value: string): string {
  return escapeGithubData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** Formats a single finding as a GitHub Actions workflow-command annotation. */
export function formatGithubAnnotation(finding: JsonFinding): string {
  // An off-union severity costs this finding its level on the PR, never the
  // whole run's annotations.
  const command = displayFor(finding.severity).github;
  const params = [`file=${escapeGithubProperty(finding.file)}`];
  if (finding.line !== null) {
    params.push(`line=${finding.line}`);
  }
  if (finding.column !== null) {
    params.push(`col=${finding.column}`);
  }
  const message = escapeGithubData(`${finding.message} (${finding.rule})`);

  return `::${command} ${params.join(',')}::${message}`;
}

/**
 * Format a whole run as GitHub Actions workflow-command annotations
 * (`--format github`), one line per finding, so CI surfaces lint results
 * inline on the diff.
 */
export function formatGithubAnnotations(files: FileDiagnostics[]): string[] {
  return toJsonFindings(files).map(formatGithubAnnotation);
}

/** Icon for a severity, floored for anything outside the union. */
export function getSeverityIcon(severity: string): string {
  return displayFor(severity).icon;
}

/** Severity name in its colour, floored for anything outside the union. */
export function formatSeverity(severity: string, hasColor: boolean): string {
  const floored = flooredSeverity(severity);
  return hasColor ? `\x1b[${SEVERITY_DISPLAY[floored].color}m${floored}\x1b[0m` : floored;
}

export function formatFilePath(path: string, hasColor: boolean): string {
  return hasColor ? `\x1b[1m${path}\x1b[0m` : path; // Bold
}

export function formatSuccess(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[32m${message}\x1b[0m` : message; // Green
}

export function formatError(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[31m${message}\x1b[0m` : message; // Red
}

export function formatDim(text: string, hasColor: boolean): string {
  return hasColor ? `\x1b[2m${text}\x1b[0m` : text; // Dim
}
