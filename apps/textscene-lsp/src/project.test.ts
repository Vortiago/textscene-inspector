/** The project view the server reads a scene's files through: the nearest `project.godot`, from disk. */

import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fileExists,
  listResPaths,
  projectFileOf,
  projectProviderFor,
  projectRootForDir,
  projectRootForFile,
  providerForRoot,
} from './project';

let tempDir: string;
let projectDir: string;
let scenePath: string;
let root: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lsp-project-'));
  projectDir = join(tempDir, 'game');
  mkdirSync(join(projectDir, 'scenes', 'deep'), { recursive: true });
  mkdirSync(join(projectDir, 'models'));
  mkdirSync(join(projectDir, '.godot', 'imported'), { recursive: true });
  // A nested project: the editor's scan does not enter it, and neither does the listing.
  mkdirSync(join(projectDir, 'vendor', 'other'), { recursive: true });
  writeFileSync(join(projectDir, 'project.godot'), 'config_version=5\n');
  writeFileSync(join(projectDir, 'models', 'tree.glb'), new Uint8Array([0x67, 0x6c, 0x54, 0x46]));
  writeFileSync(join(projectDir, 'scenes', 'level.tscn'), '[gd_scene format=3]\n');
  writeFileSync(join(projectDir, 'vendor', 'other', 'project.godot'), 'config_version=5\n');
  writeFileSync(join(projectDir, 'vendor', 'other', 'nested.tscn'), '[gd_scene format=3]\n');
  writeFileSync(join(projectDir, '.godot', 'imported', 'cache.ctex'), 'generated');
  writeFileSync(join(tempDir, 'secret.txt'), 'outside the project');
  scenePath = join(projectDir, 'scenes', 'deep', 'level.tscn');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('projectRootForFile', () => {
  it('finds the nearest ancestor directory that holds project.godot', async () => {
    root = (await projectRootForFile(scenePath))!;
    expect(root).toBe(projectDir.replace(/\\/g, '/'));
  });

  it('gives null for a scene with no project.godot above it', async () => {
    expect(await projectRootForFile(join(tempDir, 'loose', 'scene.tscn'))).toBeNull();
  });

  it('walks from the file its own directory, not from a sibling', async () => {
    writeFileSync(join(projectDir, 'scenes', 'project.godot'), 'config_version=5\n');
    expect(await projectRootForDir(join(projectDir, 'scenes'))).toBe(projectDir.replace(/\\/g, '/'));
    // Remove the nested marker, so the listing tests see the project as authored.
    rmSync(join(projectDir, 'scenes', 'project.godot'));
  });
});

describe('projectProviderFor', () => {
  it('reads a res:// path under the nearest project.godot as bytes', async () => {
    const provider = await projectProviderFor(scenePath);
    const data = await provider!.loadResource('res://models/tree.glb', 'PackedScene');

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(data as ArrayBuffer)]).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('reads a text resource as a string', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://scenes/level.tscn', 'PackedScene')).toBe(
      '[gd_scene format=3]\n'
    );
  });

  it('gives null for a file the project does not hold', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://models/missing.glb', 'PackedScene')).toBeNull();
  });

  it('refuses a path that escapes the project root', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://../secret.txt', 'TextFile')).toBeNull();
  });

  it('stamps a file with its modification time and size', async () => {
    const provider = await projectProviderFor(scenePath);
    const { mtimeMs, size } = statSync(join(projectDir, 'models', 'tree.glb'));

    expect(await provider!.stamp!('res://models/tree.glb')).toBe(`${mtimeMs}:${size}`);
  });

  it('gives null for a stamp on a missing file', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.stamp!('res://models/missing.glb')).toBeNull();
  });

  it('hands back one provider for a root, so its verdicts are shared', () => {
    expect(providerForRoot(root)).toBe(providerForRoot(root));
  });
});

describe('listResPaths', () => {
  it('lists every project file as a res:// path and skips the .godot data directory', async () => {
    const paths = await listResPaths(root);

    expect(paths).toContain('res://project.godot');
    expect(paths).toContain('res://models/tree.glb');
    expect(paths).toContain('res://scenes/level.tscn');
    expect(paths.some((path) => path.startsWith('res://.godot/'))).toBe(false);
    // A nested project and its files are not entered, as the editor's scan does.
    expect(paths.some((path) => path.startsWith('res://vendor/'))).toBe(false);
  });

  it('lists a root once, so a later file is not seen', async () => {
    const first = await listResPaths(root);
    writeFileSync(join(projectDir, 'models', 'late.glb'), new Uint8Array([1]));

    expect(await listResPaths(root)).toEqual(first);
  });
});

describe('projectFileOf', () => {
  it('resolves a res:// path under the root', () => {
    expect(projectFileOf(root, 'res://models/tree.glb')).toBe(
      join(projectDir, 'models', 'tree.glb').replace(/\\/g, '/')
    );
  });

  it('refuses a path that escapes the root', () => {
    expect(projectFileOf(root, 'res://../secret.txt')).toBeNull();
  });

  it('refuses a path that is not res://', () => {
    expect(projectFileOf(root, join(tempDir, 'secret.txt'))).toBeNull();
  });
});

describe('fileExists', () => {
  it('is true for a file that exists', async () => {
    expect(await fileExists(join(projectDir, 'project.godot'))).toBe(true);
  });

  it('is false for a file that is absent', async () => {
    expect(await fileExists(join(tempDir, 'nope.tscn'))).toBe(false);
  });
});
