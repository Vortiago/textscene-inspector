/** Pure output formatting for the TSCN linter CLI (no I/O). */

import type { Diagnostic } from '@textscene/core/linter';

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
 * Get icon for severity level
 */
export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error': return '✖';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    default: return '•';
  }
}

/**
 * Format severity with color
 */
export function formatSeverity(severity: string, hasColor: boolean): string {
  if (!hasColor) return severity;

  switch (severity) {
    case 'error': return `\x1b[31m${severity}\x1b[0m`; // Red
    case 'warning': return `\x1b[33m${severity}\x1b[0m`; // Yellow
    case 'info': return `\x1b[36m${severity}\x1b[0m`; // Cyan
    default: return severity;
  }
}

/**
 * Format file path
 */
export function formatFilePath(path: string, hasColor: boolean): string {
  return hasColor ? `\x1b[1m${path}\x1b[0m` : path; // Bold
}

/**
 * Format success message
 */
export function formatSuccess(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[32m${message}\x1b[0m` : message; // Green
}

/**
 * Format error message
 */
export function formatError(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[31m${message}\x1b[0m` : message; // Red
}

/**
 * Format dim text
 */
export function formatDim(text: string, hasColor: boolean): string {
  return hasColor ? `\x1b[2m${text}\x1b[0m` : text; // Dim
}
