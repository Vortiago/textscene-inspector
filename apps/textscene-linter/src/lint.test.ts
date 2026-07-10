/** Unit tests for lintFile/runLint exit-code logic and error handling. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  collectFileDiagnostics,
  expandTscnPaths,
  lintFile,
  lintFileDiagnostics,
  printFileResult,
  runLint,
  type FileLintResult,
} from './lint';

const CLEAN_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

// Invalid Transform3D triggers an error-severity diagnostic from the strict parser.
const ERROR_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(invalid, values, here)
`;

// Relative visibility_parent paths trigger a warning-severity diagnostic
// (valid-node3d-visibility) and nothing of error severity.
const WARNING_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
visibility_parent = NodePath("../Other")

[node name="Other" type="Node3D" parent="."]
`;

let tempDir: string;
let cleanPath: string;
let errorPath: string;
let warningPath: string;
let missingPath: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lint-test-'));
  cleanPath = join(tempDir, 'clean.tscn');
  errorPath = join(tempDir, 'error.tscn');
  warningPath = join(tempDir, 'warning.tscn');
  missingPath = join(tempDir, 'does-not-exist.tscn');
  writeFileSync(cleanPath, CLEAN_TSCN);
  writeFileSync(errorPath, ERROR_TSCN);
  writeFileSync(warningPath, WARNING_TSCN);
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('lintFile', () => {
  it('reports a clean file with a success line and no errors', () => {
    const result = lintFile(cleanPath, false);

    expect(result.hasErrors).toBe(false);
    expect(result.stdoutLines).toEqual([`✓ ${cleanPath}`]);
    expect(result.stderrLines).toEqual([]);
  });

  it('reports error diagnostics on stdout and flags hasErrors', () => {
    const result = lintFile(errorPath, false);

    expect(result.hasErrors).toBe(true);
    expect(result.stdoutLines[0]).toBe(errorPath);
    expect(result.stdoutLines.join('\n')).toContain('error');
    expect(result.stdoutLines.join('\n')).toContain('(strict-parser)');
    expect(result.stdoutLines[result.stdoutLines.length - 1]).toBe('');
    expect(result.stderrLines).toEqual([]);
  });

  it('does not flag hasErrors for warning-only diagnostics', () => {
    const result = lintFile(warningPath, false);

    expect(result.hasErrors).toBe(false);
    expect(result.stdoutLines.join('\n')).toContain('warning');
    expect(result.stdoutLines.join('\n')).toContain('valid-node3d-visibility');
  });

  it('handles a missing file gracefully: stderr names the path, hasErrors set', () => {
    const result = lintFile(missingPath, false);

    expect(result.hasErrors).toBe(true);
    expect(result.stdoutLines).toEqual([]);
    expect(result.stderrLines).toHaveLength(2);
    expect(result.stderrLines[0]).toBe(`Failed to lint ${missingPath}:`);
    expect(result.stderrLines[1]).toContain(missingPath);
    expect(result.stderrLines[1]).toContain('ENOENT');
  });

  it('applies color codes to the error output when color is enabled', () => {
    const result = lintFile(missingPath, true);

    expect(result.stderrLines[0]).toBe(`\x1b[31mFailed to lint ${missingPath}:\x1b[0m`);
  });
});

describe('runLint', () => {
  it('returns exit code 0 for clean files', () => {
    const { exitCode, results } = runLint([cleanPath], false);

    expect(exitCode).toBe(0);
    expect(results).toHaveLength(1);
  });

  it('returns exit code 1 when a file has error diagnostics', () => {
    expect(runLint([errorPath], false).exitCode).toBe(1);
  });

  // Pins current CLI behavior: warning/info diagnostics are printed but do
  // NOT fail the run. Only error-severity diagnostics and unreadable files
  // produce a nonzero exit code.
  it('returns exit code 0 for warnings-only files (established contract)', () => {
    const { exitCode, results } = runLint([warningPath], false);

    expect(exitCode).toBe(0);
    expect(results[0]?.stdoutLines.join('\n')).toContain('warning');
  });

  it('returns exit code 1 when a file is missing', () => {
    expect(runLint([missingPath], false).exitCode).toBe(1);
  });

  it('lints every file even when an early file fails', () => {
    const { exitCode, results } = runLint([missingPath, cleanPath, errorPath], false);

    expect(exitCode).toBe(1);
    expect(results.map((r) => r.filePath)).toEqual([missingPath, cleanPath, errorPath]);
    expect(results[1]?.hasErrors).toBe(false);
  });

  it('returns exit code 0 for an empty file list', () => {
    expect(runLint([], false)).toEqual({ exitCode: 0, results: [] });
  });

  it('invokes onResult once per file, in order, with the file result', () => {
    const seen: string[] = [];
    runLint([cleanPath, errorPath], false, (result) => seen.push(result.filePath));

    expect(seen).toEqual([cleanPath, errorPath]);
  });
});

describe('lintFileDiagnostics', () => {
  it('returns an empty diagnostics array and no readError for a clean file', () => {
    const result = lintFileDiagnostics(cleanPath);

    expect(result).toEqual({ filePath: cleanPath, diagnostics: [] });
  });

  it('returns raw error-severity diagnostics for an invalid file (no formatting)', () => {
    const result = lintFileDiagnostics(errorPath);

    expect(result.readError).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === 'error' && d.ruleName === 'strict-parser')).toBe(true);
  });

  it('returns raw warning-severity diagnostics for a warnings-only file', () => {
    const result = lintFileDiagnostics(warningPath);

    expect(result.readError).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === 'warning' && d.ruleName === 'valid-node3d-visibility')).toBe(true);
  });

  it('sets readError (and an empty diagnostics array) for a missing file', () => {
    const result = lintFileDiagnostics(missingPath);

    expect(result.diagnostics).toEqual([]);
    expect(result.readError).toContain('ENOENT');
  });
});

describe('collectFileDiagnostics', () => {
  it('returns exit code 0 and per-file diagnostics for clean files', () => {
    const { exitCode, files } = collectFileDiagnostics([cleanPath]);

    expect(exitCode).toBe(0);
    expect(files).toEqual([{ filePath: cleanPath, diagnostics: [] }]);
  });

  it('returns exit code 1 when a file has error diagnostics', () => {
    expect(collectFileDiagnostics([errorPath]).exitCode).toBe(1);
  });

  it('returns exit code 0 for warnings-only files (matches runLint contract)', () => {
    expect(collectFileDiagnostics([warningPath]).exitCode).toBe(0);
  });

  it('returns exit code 1 when a file is missing, and records its readError', () => {
    const { exitCode, files } = collectFileDiagnostics([missingPath]);

    expect(exitCode).toBe(1);
    expect(files[0]?.readError).toContain('ENOENT');
  });

  it('collects every file even when an early file fails, preserving order', () => {
    const { exitCode, files } = collectFileDiagnostics([missingPath, cleanPath, errorPath]);

    expect(exitCode).toBe(1);
    expect(files.map((f) => f.filePath)).toEqual([missingPath, cleanPath, errorPath]);
  });

  it('returns exit code 0 and no files for an empty file list', () => {
    expect(collectFileDiagnostics([])).toEqual({ exitCode: 0, files: [] });
  });
});

describe('expandTscnPaths', () => {
  let dirRoot: string;
  let nestedDir: string;
  let topTscn: string;
  let nestedTscn: string;
  let nestedTxt: string;

  beforeAll(() => {
    dirRoot = mkdtempSync(join(tmpdir(), 'tscn-lint-expand-'));
    nestedDir = join(dirRoot, 'nested');
    mkdirSync(nestedDir);
    topTscn = join(dirRoot, 'top.tscn');
    nestedTscn = join(nestedDir, 'nested.tscn');
    nestedTxt = join(nestedDir, 'ignore-me.txt');
    writeFileSync(topTscn, CLEAN_TSCN);
    writeFileSync(nestedTscn, CLEAN_TSCN);
    writeFileSync(nestedTxt, 'not a scene');
  });

  afterAll(() => {
    rmSync(dirRoot, { recursive: true, force: true });
  });

  it('passes a plain file path through unchanged', () => {
    expect(expandTscnPaths([cleanPath])).toEqual([cleanPath]);
  });

  it('passes a missing path through unchanged (lets lintFile report the read error)', () => {
    expect(expandTscnPaths([missingPath])).toEqual([missingPath]);
  });

  it('recursively expands a directory to its .tscn files, ignoring other extensions', () => {
    const result = expandTscnPaths([dirRoot]);

    expect(result.sort()).toEqual([nestedTscn, topTscn].sort());
    expect(result).not.toContain(nestedTxt);
  });

  it('mixes directory expansion with explicit files in one call', () => {
    const result = expandTscnPaths([dirRoot, cleanPath]);

    expect(result).toContain(cleanPath);
    expect(result).toContain(topTscn);
    expect(result).toContain(nestedTscn);
    expect(result).toHaveLength(3);
  });
});

describe('printFileResult', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes stdout lines via console.log and stderr lines via console.error', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result: FileLintResult = {
      filePath: 'x.tscn',
      stdoutLines: ['line1', ''],
      stderrLines: ['err1'],
      hasErrors: true,
    };
    printFileResult(result);

    expect(log.mock.calls).toEqual([['line1'], ['']]);
    expect(error.mock.calls).toEqual([['err1']]);
  });

  it('prints nothing for an empty result', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    printFileResult({ filePath: 'x.tscn', stdoutLines: [], stderrLines: [], hasErrors: false });

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
