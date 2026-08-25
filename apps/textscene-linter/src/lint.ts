/** File linting and exit-code logic for the TSCN linter CLI. */

import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
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
 * Raw lint outcome for a single file: unformatted diagnostics, with no
 * presentation baked in. This is the shared seam that every output format
 * (text, json, github) builds on, so read/lint logic lives in exactly one
 * place.
 */
export interface FileDiagnostics {
  filePath: string;
  diagnostics: Diagnostic[];
  /** Set instead of `diagnostics` when the file could not be read. */
  readError?: string;
}

export interface CollectDiagnosticsResult {
  /** 0 when every file is clean or warning/info-only; 1 otherwise. */
  exitCode: number;
  files: FileDiagnostics[];
}

/**
 * Expands directory arguments into the `.tscn`/`.tres` files they contain
 * (recursively, sorted for deterministic output); plain file paths -
 * including ones the shell already expanded from a glob - pass through
 * unchanged. A path that does not exist on disk is also passed through
 * unchanged so the existing per-file read-error handling in `lintFile`
 * reports it consistently, rather than throwing here.
 */
export function expandTscnPaths(inputPaths: string[]): string[] {
  const expanded: string[] = [];

  for (const inputPath of inputPaths) {
    let stats;
    try {
      stats = statSync(inputPath);
    } catch {
      expanded.push(inputPath);
      continue;
    }

    if (!stats.isDirectory()) {
      expanded.push(inputPath);
      continue;
    }

    expanded.push(...collectTscnFiles(inputPath).sort());
  }

  return expanded;
}

/**
 * Both text formats Godot writes, and the linter's subject is both.
 *
 * A `.tres` is the same grammar with its type in the `[gd_resource]` header
 * rather than a section heading; the validators a `[sub_resource]` block gets
 * inside a scene are the ones a standalone resource file gets here.
 */
const LINTABLE_EXTENSIONS = new Set(['.tscn', '.tres']);

const isLintable = (name: string): boolean => LINTABLE_EXTENSIONS.has(extname(name));

/**
 * Recursively collect the lintable FILES under `dir`, appending into `found`
 * (threaded through the recursion so nested results are never re-copied at
 * each ancestor level). Dirent-based so the file/directory distinction comes
 * for free from each readdir for ordinary entries (no extra `statSync`
 * call). A symlinked directory is left alone — not recursed into — matching
 * the previous `readdirSync(recursive)` behavior, which never follows
 * directory symlinks either. A symlinked FILE, though, is resolved with one
 * `statSync` (mirroring the previous implementation's `statSync(fullPath)
 * .isFile()` check, which follows symlinks) so a scene symlinked in from
 * elsewhere is still linted rather than silently dropped.
 */
function collectTscnFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue; // broken symlink — skip rather than throw
      }
      if (stats.isFile() && isLintable(entry.name)) found.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) collectTscnFiles(fullPath, found);
    else if (entry.isFile() && isLintable(entry.name)) found.push(fullPath);
  }
  return found;
}

/**
 * Reads and lints a single TSCN file, returning raw diagnostics with no
 * presentation applied. Read failures (missing file, permissions) are
 * captured as `readError` rather than thrown.
 */
export function lintFileDiagnostics(filePath: string): FileDiagnostics {
  try {
    const absolutePath = resolve(filePath);
    const content = readFileSync(absolutePath, 'utf-8');

    // Lint the TSCN file content (two-phase: strict parsing + semantic rules)
    const linter = new Linter();
    return { filePath, diagnostics: linter.lint(content) };
  } catch (error) {
    return {
      filePath,
      diagnostics: [],
      readError: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * True when a file's raw lint outcome should fail the run: an error-severity
 * diagnostic, or a read failure. Warning/info-only diagnostics do not count.
 */
function hasErrorSeverity(result: FileDiagnostics): boolean {
  return result.readError !== undefined || result.diagnostics.some((d: Diagnostic) => d.severity === 'error');
}

/**
 * Lint a single TSCN file for the default (ANSI/plain text) CLI output.
 * Read failures are reported as stderr lines rather than thrown, and count
 * as errors.
 */
export function lintFile(filePath: string, hasColor: boolean): FileLintResult {
  const result = lintFileDiagnostics(filePath);

  if (result.readError !== undefined) {
    return {
      filePath,
      stdoutLines: [],
      stderrLines: [
        formatError(`Failed to lint ${filePath}:`, hasColor),
        formatError(`  ${result.readError}`, hasColor),
      ],
      hasErrors: true,
    };
  }

  return {
    filePath,
    stdoutLines: formatDiagnostics(filePath, result.diagnostics, hasColor),
    stderrLines: [],
    hasErrors: hasErrorSeverity(result),
  };
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

/**
 * Lint files in order and return raw per-file diagnostics with no
 * presentation applied - the shared data source for the `json` and `github`
 * output formats. Uses the same exit-code contract as `runLint`: error
 * diagnostics or read failures fail the run, warning/info-only ones do not.
 */
export function collectFileDiagnostics(filePaths: string[]): CollectDiagnosticsResult {
  const files = filePaths.map(lintFileDiagnostics);
  const exitCode = files.some(hasErrorSeverity) ? 1 : 0;

  return { exitCode, files };
}
