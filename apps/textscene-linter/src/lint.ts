/** File linting and exit-code logic for the TSCN linter CLI. */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Linter, type Diagnostic } from '@textscene/core/linter';
import { formatDiagnostics, formatError } from './format';

/** Lint outcome for a single file, with output split by target stream. */
export interface FileLintResult {
  filePath: string;
  /** Lines destined for stdout (one console.log call per line). */
  stdoutLines: string[];
  /** Lines destined for stderr (one console.error call per line). */
  stderrLines: string[];
  /** True when the file has error-severity diagnostics or could not be read. */
  hasErrors: boolean;
}

export interface LintRunResult {
  /** 0 when all files are clean or warning/info-only; 1 otherwise. */
  exitCode: number;
  results: FileLintResult[];
}

/**
 * Lint a single TSCN file. Read failures (missing file, permissions) are
 * reported as stderr lines rather than thrown, and count as errors.
 */
export function lintFile(filePath: string, hasColor: boolean): FileLintResult {
  try {
    const absolutePath = resolve(filePath);
    const content = readFileSync(absolutePath, 'utf-8');

    // Lint the TSCN file content (two-phase: strict parsing + semantic rules)
    const linter = new Linter();
    const diagnostics = linter.lint(content);

    return {
      filePath,
      stdoutLines: formatDiagnostics(filePath, diagnostics, hasColor),
      stderrLines: [],
      hasErrors: diagnostics.some((d: Diagnostic) => d.severity === 'error'),
    };
  } catch (error) {
    return {
      filePath,
      stdoutLines: [],
      stderrLines: [
        formatError(`Failed to lint ${filePath}:`, hasColor),
        formatError(`  ${error instanceof Error ? error.message : String(error)}`, hasColor),
      ],
      hasErrors: true,
    };
  }
}

/** Print one file's lint result to the console, preserving stream targets. */
export function printFileResult(result: FileLintResult): void {
  for (const line of result.stdoutLines) {
    console.log(line);
  }
  for (const line of result.stderrLines) {
    console.error(line);
  }
}

/**
 * Lint files in order. Exit code is 1 when any file has error-severity
 * diagnostics or fails to read; warning/info-only diagnostics do NOT fail
 * the run (exit 0) - this is the established CLI contract.
 *
 * The optional onResult callback fires after each file so callers can
 * stream output as files are processed (matching the original CLI behavior).
 */
export function runLint(
  filePaths: string[],
  hasColor: boolean,
  onResult?: (result: FileLintResult) => void
): LintRunResult {
  const results: FileLintResult[] = [];
  let hasErrors = false;

  for (const filePath of filePaths) {
    const result = lintFile(filePath, hasColor);
    results.push(result);
    if (result.hasErrors) {
      hasErrors = true;
    }
    onResult?.(result);
  }

  return { exitCode: hasErrors ? 1 : 0, results };
}
