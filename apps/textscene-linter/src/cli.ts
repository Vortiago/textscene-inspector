#!/usr/bin/env node
/**
 * TSCN Linter CLI - Command-line tool for linting .tscn files
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';
import { Linter, type Diagnostic } from '@textscene/core/linter';

const program = new Command();

program
  .name('tscn-lint')
  .description('Lint and validate Godot TSCN files')
  .version('0.1.0')
  .argument('<files...>', 'TSCN files to lint')
  .option('--no-color', 'Disable colored output')
  .action((files: string[], options) => {
    const hasColor = options.color !== false;
    let hasErrors = false;

    for (const file of files) {
      const result = lintFile(file, hasColor);
      if (result.hasErrors) {
        hasErrors = true;
      }
    }

    // Exit with error code if any errors found
    process.exit(hasErrors ? 1 : 0);
  });

/**
 * Lint a single TSCN file
 */
function lintFile(filePath: string, hasColor: boolean): { hasErrors: boolean } {
  try {
    const absolutePath = resolve(filePath);
    const content = readFileSync(absolutePath, 'utf-8');

    // Lint the TSCN file content (two-phase: strict parsing + semantic rules)
    const linter = new Linter();
    const diagnostics = linter.lint(content);

    // Print results
    printResults(filePath, diagnostics, hasColor);

    // Check if any errors were found
    const hasErrors = diagnostics.some(d => d.severity === 'error');
    return { hasErrors };

  } catch (error) {
    console.error(formatError(`Failed to lint ${filePath}:`, hasColor));
    console.error(formatError(`  ${error instanceof Error ? error.message : String(error)}`, hasColor));
    return { hasErrors: true };
  }
}

/**
 * Print linting results for a file
 */
function printResults(filePath: string, diagnostics: Diagnostic[], hasColor: boolean): void {
  if (diagnostics.length === 0) {
    console.log(formatSuccess(`✓ ${filePath}`, hasColor));
    return;
  }

  console.log(formatFilePath(filePath, hasColor));

  for (const diagnostic of diagnostics) {
    const icon = getSeverityIcon(diagnostic.severity);
    const severityText = formatSeverity(diagnostic.severity, hasColor);
    const nodeInfo = formatDim(`[${diagnostic.nodeType}:${diagnostic.nodeName}]`, hasColor);
    const ruleInfo = formatDim(`(${diagnostic.ruleName})`, hasColor);

    console.log(`  ${icon} ${severityText} ${nodeInfo} ${diagnostic.message} ${ruleInfo}`);
  }

  console.log('');
}

/**
 * Get icon for severity level
 */
function getSeverityIcon(severity: string): string {
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
function formatSeverity(severity: string, hasColor: boolean): string {
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
function formatFilePath(path: string, hasColor: boolean): string {
  return hasColor ? `\x1b[1m${path}\x1b[0m` : path; // Bold
}

/**
 * Format success message
 */
function formatSuccess(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[32m${message}\x1b[0m` : message; // Green
}

/**
 * Format error message
 */
function formatError(message: string, hasColor: boolean): string {
  return hasColor ? `\x1b[31m${message}\x1b[0m` : message; // Red
}

/**
 * Format dim text
 */
function formatDim(text: string, hasColor: boolean): string {
  return hasColor ? `\x1b[2m${text}\x1b[0m` : text; // Dim
}

// Parse and execute
program.parse();
