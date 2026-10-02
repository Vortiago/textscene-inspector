/** Pure output formatting for the TSCN linter CLI (no I/O). */

import { diagnosticLine, flooredSeverity, type Diagnostic, type Severity } from '@textscene/core/linter';
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
 * The control characters a terminal acts on: C0, DEL and C1 (`\p{Cc}`), less tab. A scene
 * controls its node names, the property values a message quotes, and its own file name, so
 * an ESC or a C1 CSI from it could retitle the terminal, clear it or write the clipboard.
 */
const TERMINAL_CONTROL = /(?!\t)\p{Cc}/gu;

/** The workflow-command data keeps CR and LF for `escapeGithubData` to percent-encode. */
const GITHUB_CONTROL = /(?![\t\r\n])\p{Cc}/gu;

/** DEL and C1, the controls `JSON.stringify` writes raw. */
const JSON_RAW_CONTROL = /[\u007f-\u009f]/gu;

/** A control character as the JavaScript escape that names it, such as `\u001b` for ESC. */
function visibleEscape(control: string): string {
  return `\\u${control.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

/**
 * Writes each control character in untrusted text as a visible `\u` escape, so the text
 * reaches a terminal as characters, never as a command. Tab stays, since it only moves the
 * cursor right.
 */
export function escapeControlCharacters(text: string): string {
  return text.replace(TERMINAL_CONTROL, visibleEscape);
}

/**
 * Format lint results for one file as stdout lines.
 * Clean files produce a single success line; files with diagnostics produce
 * a file-path header, one line per diagnostic, and a trailing blank line.
 * The path and each diagnostic's node and message reach the terminal escaped.
 */
export function formatDiagnostics(filePath: string, diagnostics: Diagnostic[], hasColor: boolean): string[] {
  if (diagnostics.length === 0) {
    return [formatSuccess(`✓ ${escapeControlCharacters(filePath)}`, hasColor)];
  }

  const lines: string[] = [formatFilePath(filePath, hasColor)];

  for (const diagnostic of diagnostics) {
    const icon = getSeverityIcon(diagnostic.severity);
    const severityText = formatSeverity(diagnostic.severity, hasColor);
    const node = escapeControlCharacters(`[${diagnostic.nodeType}:${diagnostic.nodeName}]`);
    const nodeInfo = formatDim(node, hasColor);
    const ruleInfo = formatDim(`(${diagnostic.ruleName})`, hasColor);
    const message = escapeControlCharacters(diagnostic.message);

    lines.push(`  ${icon} ${severityText} ${nodeInfo} ${message} ${ruleInfo}`);
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
      // The line as the web gutter and VS Code read it, so a finding they show as about the whole
      // file gets no `line=` here either, and a column without its line means nothing.
      const line = diagnosticLine(diagnostic) ?? null;
      findings.push({
        file: file.filePath,
        line,
        column: line === null ? null : (diagnostic.location?.column ?? null),
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
 * `JSON.stringify` escapes C0 but writes DEL and C1 raw. Their `\u` escape is
 * the same JSON string, and only a string can hold one.
 */
export function formatJson(files: FileDiagnostics[]): string {
  return JSON.stringify(toJsonFindings(files), null, 2).replace(JSON_RAW_CONTROL, visibleEscape);
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
 * the GitHub Actions toolkit's escaping rules. The runner reads the first `::`
 * as the end of the properties, so a later `::` stays data. CR and LF would
 * start a new command, so they are percent-encoded. The toolkit names no
 * encoding for any other control, so each one is a visible `\u` escape, as in
 * the text output.
 */
function escapeGithubData(value: string): string {
  return value
    .replace(GITHUB_CONTROL, visibleEscape)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
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

/** The file-path header, bold with colour on, its control characters escaped. */
export function formatFilePath(path: string, hasColor: boolean): string {
  const visiblePath = escapeControlCharacters(path);
  return hasColor ? `\x1b[1m${visiblePath}\x1b[0m` : visiblePath;
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
