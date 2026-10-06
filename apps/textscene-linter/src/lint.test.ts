/** Unit tests for lintFile/runLint exit-code logic and error handling. */

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
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

// A CollisionShape2D with no shape trips a warning-severity diagnostic
// (collisionshape2d-requires-shape, a ported editor warning) and nothing of
// error severity.
const WARNING_TSCN = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Body" type="StaticBody2D" parent="."]

[node name="Shape" type="CollisionShape2D" parent="Body"]
`;

// A CSGMesh3D with no mesh trips an info-severity diagnostic
// (csgmesh3d-requires-mesh: Godot draws nothing and says nothing).
const INFO_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Shape" type="CSGMesh3D" parent="."]
`;

let tempDir: string;
let cleanPath: string;
let errorPath: string;
let warningPath: string;
let infoPath: string;
let missingPath: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lint-test-'));
  cleanPath = join(tempDir, 'clean.tscn');
  errorPath = join(tempDir, 'error.tscn');
  warningPath = join(tempDir, 'warning.tscn');
  infoPath = join(tempDir, 'info.tscn');
  missingPath = join(tempDir, 'does-not-exist.tscn');
  writeFileSync(cleanPath, CLEAN_TSCN);
  writeFileSync(errorPath, ERROR_TSCN);
  writeFileSync(warningPath, WARNING_TSCN);
  writeFileSync(infoPath, INFO_TSCN);
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('lintFile', () => {
  it('reports a clean file with a success line and no errors', async () => {
    const result = await lintFile(cleanPath, false);

    expect(result.hasErrors).toBe(false);
    expect(result.stdoutLines).toEqual([`✓ ${cleanPath}`]);
    expect(result.stderrLines).toEqual([]);
  });

  it('reports error diagnostics on stdout and flags hasErrors', async () => {
    const result = await lintFile(errorPath, false);

    expect(result.hasErrors).toBe(true);
    expect(result.stdoutLines[0]).toBe(errorPath);
    expect(result.stdoutLines.join('\n')).toContain('error');
    expect(result.stdoutLines.join('\n')).toContain('(strict-parser)');
    expect(result.stdoutLines[result.stdoutLines.length - 1]).toBe('');
    expect(result.stderrLines).toEqual([]);
  });

  it('does not flag hasErrors for warning-only diagnostics', async () => {
    const result = await lintFile(warningPath, false);

    expect(result.hasErrors).toBe(false);
    expect(result.stdoutLines.join('\n')).toContain('warning');
    expect(result.stdoutLines.join('\n')).toContain('collisionshape2d-requires-shape');
  });

  it('handles a missing file gracefully: stderr names the path, hasErrors set', async () => {
    const result = await lintFile(missingPath, false);

    expect(result.hasErrors).toBe(true);
    expect(result.stdoutLines).toEqual([]);
    expect(result.stderrLines).toHaveLength(2);
    expect(result.stderrLines[0]).toBe(`Failed to lint ${missingPath}:`);
    expect(result.stderrLines[1]).toContain(missingPath);
    expect(result.stderrLines[1]).toContain('ENOENT');
  });

  it('escapes control characters in the path and the read error on stderr', async () => {
    const hostilePath = `${missingPath}\x1b]0;pwned\x07`;

    const result = await lintFile(hostilePath, false);

    expect(result.stderrLines.join('\n')).not.toContain('\x1b');
    expect(result.stderrLines[0]).toBe(`Failed to lint ${missingPath}\\u001b]0;pwned\\u0007:`);
    expect(result.stderrLines[1]).toContain(`${missingPath}\\u001b]0;pwned\\u0007`);
  });

  it('applies color codes to the error output when color is enabled', async () => {
    const result = await lintFile(missingPath, true);

    expect(result.stderrLines[0]).toBe(`\x1b[31mFailed to lint ${missingPath}:\x1b[0m`);
  });
});

describe('runLint', () => {
  it('returns exit code 0 for clean files', async () => {
    const { exitCode, results } = await runLint([cleanPath], false);

    expect(exitCode).toBe(0);
    expect(results).toHaveLength(1);
  });

  it('returns exit code 1 when a file has error diagnostics', async () => {
    expect((await runLint([errorPath], false)).exitCode).toBe(1);
  });

  // Warning/info diagnostics print but do not fail the run. Only an error-severity
  // diagnostic or an unreadable file gives a nonzero exit code.
  it('returns exit code 0 for warnings-only files (established contract)', async () => {
    const { exitCode, results } = await runLint([warningPath], false);

    expect(exitCode).toBe(0);
    expect(results[0]?.stdoutLines.join('\n')).toContain('warning');
  });

  it('returns exit code 1 when a file is missing', async () => {
    expect((await runLint([missingPath], false)).exitCode).toBe(1);
  });

  it('lints every file even when an early file fails', async () => {
    const { exitCode, results } = await runLint([missingPath, cleanPath, errorPath], false);

    expect(exitCode).toBe(1);
    expect(results.map((r) => r.filePath)).toEqual([missingPath, cleanPath, errorPath]);
    expect(results[1]?.hasErrors).toBe(false);
  });

  it('returns exit code 0 for an empty file list', async () => {
    expect(await runLint([], false)).toEqual({ exitCode: 0, results: [] });
  });

  it('invokes onResult once per file, in order, with the file result', async () => {
    const seen: string[] = [];
    await runLint([cleanPath, errorPath], false, (result) => seen.push(result.filePath));

    expect(seen).toEqual([cleanPath, errorPath]);
  });
});

describe('lintFileDiagnostics', () => {
  it('returns an empty diagnostics array and no readError for a clean file', async () => {
    const result = await lintFileDiagnostics(cleanPath);

    expect(result).toEqual({ filePath: cleanPath, diagnostics: [] });
  });

  it('returns raw error-severity diagnostics for an invalid file (no formatting)', async () => {
    const result = await lintFileDiagnostics(errorPath);

    expect(result.readError).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === 'error' && d.ruleName === 'strict-parser')).toBe(
      true
    );
  });

  it('returns raw warning-severity diagnostics for a warnings-only file', async () => {
    const result = await lintFileDiagnostics(warningPath);

    expect(result.readError).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) => d.severity === 'warning' && d.ruleName === 'collisionshape2d-requires-shape'
      )
    ).toBe(true);
  });

  it('returns raw info-severity diagnostics, which never count as errors', async () => {
    const result = await lintFileDiagnostics(infoPath);

    expect(result.readError).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.severity === 'info' && d.ruleName === 'csgmesh3d-requires-mesh')
    ).toBe(true);
    expect((await collectFileDiagnostics([infoPath])).exitCode).toBe(0);
  });

  it('sets readError (and an empty diagnostics array) for a missing file', async () => {
    const result = await lintFileDiagnostics(missingPath);

    expect(result.diagnostics).toEqual([]);
    expect(result.readError).toContain('ENOENT');
  });
});

describe('collectFileDiagnostics', () => {
  it('returns exit code 0 and per-file diagnostics for clean files', async () => {
    const { exitCode, files } = await collectFileDiagnostics([cleanPath]);

    expect(exitCode).toBe(0);
    expect(files).toEqual([{ filePath: cleanPath, diagnostics: [] }]);
  });

  it('returns exit code 1 when a file has error diagnostics', async () => {
    expect((await collectFileDiagnostics([errorPath])).exitCode).toBe(1);
  });

  it('returns exit code 0 for warnings-only files (matches runLint contract)', async () => {
    expect((await collectFileDiagnostics([warningPath])).exitCode).toBe(0);
  });

  it('returns exit code 1 when a file is missing, and records its readError', async () => {
    const { exitCode, files } = await collectFileDiagnostics([missingPath]);

    expect(exitCode).toBe(1);
    expect(files[0]?.readError).toContain('ENOENT');
  });

  it('collects every file even when an early file fails, preserving order', async () => {
    const { exitCode, files } = await collectFileDiagnostics([missingPath, cleanPath, errorPath]);

    expect(exitCode).toBe(1);
    expect(files.map((f) => f.filePath)).toEqual([missingPath, cleanPath, errorPath]);
  });

  it('returns exit code 0 and no files for an empty file list', async () => {
    expect(await collectFileDiagnostics([])).toEqual({ exitCode: 0, files: [] });
  });
});

/** The committed GLB that requires EXT_mesh_gpu_instancing, which Godot's glTF importer refuses. */
const INSTANCED_TREE = join(
  import.meta.dirname,
  '../../../scenes/fixtures/gltf-unsupported-required-extension/instanced-tree.glb'
);

const USES_TREE_GLB = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Tree" instance=ExtResource("1_tree")]
`;

describe('cross-file rules', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'tscn-lint-gltf-'));
    mkdirSync(join(projectDir, 'game', 'scenes'), { recursive: true });
    writeFileSync(join(projectDir, 'game', 'project.godot'), 'config_version=5\n');
    copyFileSync(INSTANCED_TREE, join(projectDir, 'game', 'tree.glb'));
    writeFileSync(join(projectDir, 'game', 'scenes', 'level.tscn'), USES_TREE_GLB);
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("reads a scene's dependencies under its project.godot and fails the run on a refused glTF", async () => {
    const scene = join(projectDir, 'game', 'scenes', 'level.tscn');
    const { exitCode, files } = await collectFileDiagnostics([scene]);

    expect(exitCode).toBe(1);
    expect(files[0]!.diagnostics.map((d) => d.ruleName)).toContain('gltf-required-extension-unsupported');
  });

  it('warns, and passes the run, where the project enables an editor plugin that may support the extension', async () => {
    const pluginProject = join(projectDir, 'plugged');
    mkdirSync(pluginProject);
    writeFileSync(
      join(pluginProject, 'project.godot'),
      '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/gltf/plugin.cfg")\n'
    );
    copyFileSync(INSTANCED_TREE, join(pluginProject, 'tree.glb'));
    writeFileSync(join(pluginProject, 'level.tscn'), USES_TREE_GLB);

    const { exitCode, files } = await collectFileDiagnostics([join(pluginProject, 'level.tscn')]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics.map((d) => [d.severity, d.ruleName])).toEqual([
      ['warning', 'gltf-required-extension-maybe-unsupported'],
    ]);
  });

  it('warns, and passes the run, in a fresh checkout whose GDExtension has no .godot list yet', async () => {
    const extendedProject = join(projectDir, 'extended');
    mkdirSync(join(extendedProject, 'addons', 'gltf'), { recursive: true });
    writeFileSync(join(extendedProject, 'project.godot'), 'config_version=5\n');
    writeFileSync(join(extendedProject, 'addons', 'gltf', 'gltf.gdextension'), '[configuration]\n');
    copyFileSync(INSTANCED_TREE, join(extendedProject, 'tree.glb'));
    writeFileSync(join(extendedProject, 'level.tscn'), USES_TREE_GLB);

    const { exitCode, files } = await collectFileDiagnostics([join(extendedProject, 'level.tscn')]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics.map((d) => [d.severity, d.ruleName])).toEqual([
      ['warning', 'gltf-required-extension-maybe-unsupported'],
    ]);
  });

  it('warns, and passes the run, where only a child node instances the refused glTF, since the scene still loads', async () => {
    const scene = join(projectDir, 'game', 'scenes', 'child.tscn');
    writeFileSync(
      scene,
      USES_TREE_GLB.replace(
        '[node name="Tree" instance=ExtResource("1_tree")]',
        '[node name="Root" type="Node3D"]\n\n[node name="Tree" parent="." instance=ExtResource("1_tree")]'
      )
    );

    const { exitCode, files } = await collectFileDiagnostics([scene]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics.map((d) => [d.severity, d.ruleName])).toEqual([
      ['warning', 'gltf-required-extension-unsupported-in-node'],
    ]);
  });
});

describe('cross-file rules for a scene outside every Godot project', () => {
  let workspaceDir: string;

  beforeAll(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'tscn-lint-loose-'));
    mkdirSync(join(workspaceDir, 'dungeon'));
    copyFileSync(INSTANCED_TREE, join(workspaceDir, 'dungeon', 'tree.glb'));
    writeFileSync(join(workspaceDir, 'dungeon', 'level.tscn'), USES_TREE_GLB);
    copyFileSync(INSTANCED_TREE, join(workspaceDir, 'tree.glb'));
    writeFileSync(join(workspaceDir, 'level.tscn'), USES_TREE_GLB);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  /** A loose scene has no `project.godot` to rule out a plugin that supports the extension, so the verdict is a warning. */
  const NO_PROJECT_GLTF_WARNING = [['warning', 'gltf-required-extension-maybe-unsupported']];

  /** Runs the CLI as if it were started in `dir`, its workspace. */
  function runFrom(dir: string): void {
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
  }

  it("reads the dependencies under the scene's own directory inside the working directory", async () => {
    runFrom(workspaceDir);

    const { exitCode, files } = await collectFileDiagnostics([join(workspaceDir, 'dungeon', 'level.tscn')]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics.map((d) => [d.severity, d.ruleName])).toEqual(NO_PROJECT_GLTF_WARNING);
  });

  it('reads the dependencies of a scene that lies in the working directory itself', async () => {
    runFrom(workspaceDir);

    const { exitCode, files } = await collectFileDiagnostics([join(workspaceDir, 'level.tscn')]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics.map((d) => [d.severity, d.ruleName])).toEqual(NO_PROJECT_GLTF_WARNING);
  });

  it('reads no dependency for a scene outside the working directory, so a run reads no unrelated tree', async () => {
    runFrom(join(workspaceDir, 'dungeon'));

    const { exitCode, files } = await collectFileDiagnostics([join(workspaceDir, 'level.tscn')]);

    expect(exitCode).toBe(0);
    expect(files[0]!.diagnostics).toEqual([]);
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

  it('follows a symlinked .tscn file (matching a plain-file argument passed through statSync)', () => {
    const linkedDir = mkdtempSync(join(tmpdir(), 'tscn-lint-expand-symlink-'));
    const realTarget = join(linkedDir, 'shared.tscn');
    writeFileSync(realTarget, CLEAN_TSCN);
    const linkPath = join(dirRoot, 'linked.tscn');
    symlinkSync(realTarget, linkPath);

    try {
      const result = expandTscnPaths([dirRoot]);
      expect(result).toContain(linkPath);
    } finally {
      rmSync(linkPath, { force: true });
      rmSync(linkedDir, { recursive: true, force: true });
    }
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
