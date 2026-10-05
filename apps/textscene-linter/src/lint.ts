/** File linting and exit-code logic for the TSCN linter CLI. */

import { readdirSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Linter, type Diagnostic } from '@textscene/core/linter';
import { isGodotTextResourcePath } from '@textscene/core/godot';
import { projectProviderFor } from '@textscene/core/resources/diskProject';
import { escapeControlCharacters, formatDiagnostics, formatError } from './format';

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
 * Expands directory arguments into the `.tscn`/`.tres` files they contain,
 * recursively and sorted for deterministic output. A file path passes through,
 * and so does a missing one, so `lintFile` reports it as a read error rather
 * than this throwing.
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
 * Recursively collects the lintable files under `dir` into `found`, which the
 * recursion threads so no level re-copies. Dirent-based: an ordinary entry costs
 * no `statSync`. A symlinked directory is not followed. A symlinked file costs
 * one `statSync`, so a scene linked in from elsewhere is still linted.
 */
function collectTscnFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue; // A broken symlink: skip, not throw.
      }
      if (stats.isFile() && isGodotTextResourcePath(entry.name)) found.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) collectTscnFiles(fullPath, found);
    else if (entry.isFile() && isGodotTextResourcePath(entry.name)) found.push(fullPath);
  }
  return found;
}

/**
 * One linter for the process, so what it reads per provider, the glTF verdicts and the plugin answer, serves every
 * scene of a run. It carries no other state between calls.
 */
const linter = new Linter();

/**
 * Reads and lints a single TSCN file, returning raw diagnostics with no
 * presentation applied. For a file inside a Godot project, it also reads the
 * files the scene uses from that project. Read failures (missing file,
 * permissions) are captured as `readError` rather than thrown.
 */
export async function lintFileDiagnostics(filePath: string): Promise<FileDiagnostics> {
  try {
    const absolutePath = resolve(filePath);
    const content = await readFile(absolutePath, 'utf-8');
    const provider = await projectProviderFor(absolutePath);
    return { filePath, diagnostics: await linter.lintComplete(content, provider) };
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
 * as errors. The path and the read error reach stderr with their control
 * characters escaped.
 */
export async function lintFile(filePath: string, hasColor: boolean): Promise<FileLintResult> {
  const result = await lintFileDiagnostics(filePath);

  if (result.readError !== undefined) {
    return {
      filePath,
      stdoutLines: [],
      stderrLines: [
        formatError(`Failed to lint ${escapeControlCharacters(filePath)}:`, hasColor),
        formatError(`  ${escapeControlCharacters(result.readError)}`, hasColor),
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
 * Lints files in order, one at a time, so output keeps the argument order.
 * The exit code is 1 when any file has an error-severity diagnostic or fails
 * to read. Warning/info-only diagnostics exit 0. `onResult` fires after each
 * file, so a caller streams output as files finish.
 */
export async function runLint(
  filePaths: string[],
  hasColor: boolean,
  onResult?: (result: FileLintResult) => void
): Promise<LintRunResult> {
  const results: FileLintResult[] = [];
  let hasErrors = false;

  for (const filePath of filePaths) {
    const result = await lintFile(filePath, hasColor);
    results.push(result);
    if (result.hasErrors) {
      hasErrors = true;
    }
    onResult?.(result);
  }

  return { exitCode: hasErrors ? 1 : 0, results };
}

/**
 * Lints files one at a time and returns raw per-file diagnostics, the data source
 * for the `json` and `github` formats. Sequential, not parallel: parallel reads of
 * a large tree, each file with its dependencies, can exhaust the process's file
 * handles. The exit code follows `runLint`.
 */
export async function collectFileDiagnostics(filePaths: string[]): Promise<CollectDiagnosticsResult> {
  const files: FileDiagnostics[] = [];
  for (const filePath of filePaths) files.push(await lintFileDiagnostics(filePath));
  const exitCode = files.some(hasErrorSeverity) ? 1 : 0;

  return { exitCode, files };
}
