/** Unit tests for lintFile/runLint exit-code logic and error handling. */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { lintFile, printFileResult, runLint, type FileLintResult } from './lint';

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
