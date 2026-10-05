// @vitest-environment node
/** A scene's Godot project read from disk: the files under the nearest `project.godot`. */

import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fileExists,
  listProjectPaths,
  projectProviderFor,
  projectRootForDir,
  projectRootForFile,
  providerForRoot,
} from './diskProject';

let tempDir: string;
let projectDir: string;
let scenePath: string;
/** The project root, spelled with forward slashes as the walk spells it. */
let root: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-disk-project-'));
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
  root = projectDir.replace(/\\/g, '/');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('projectRootForFile', () => {
  it('finds the nearest ancestor directory that holds project.godot', async () => {
    expect(await projectRootForFile(scenePath)).toBe(root);
  });

  it('gives null for a scene with no project.godot above it', async () => {
    expect(await projectRootForFile(join(tempDir, 'loose', 'scene.tscn'))).toBeNull();
  });
});

describe('projectRootForDir', () => {
  it('stops at the directory itself when it holds project.godot', async () => {
    const own = join(tempDir, 'own', 'inner');
    mkdirSync(own, { recursive: true });
    writeFileSync(join(own, 'project.godot'), 'config_version=5\n');

    expect(await projectRootForDir(own)).toBe(own.replace(/\\/g, '/'));
  });
});

describe('projectProviderFor', () => {
  it('gives no provider for a scene with no project.godot above it', async () => {
    expect(await projectProviderFor(join(tempDir, 'loose', 'scene.tscn'))).toBeNull();
  });

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

  it('refuses a path that is not res://', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource(join(tempDir, 'secret.txt'), 'TextFile')).toBeNull();
  });

  it('hands back one provider for every scene of a project, so its verdicts serve the whole run', async () => {
    const other = join(projectDir, 'scenes', 'level.tscn');
    expect(await projectProviderFor(other)).toBe(await projectProviderFor(scenePath));
  });
});

describe('projectProviderFor stamp', () => {
  it('stamps a file with its modification time and size', async () => {
    const provider = await projectProviderFor(scenePath);
    const file = join(projectDir, 'models', 'tree.glb');
    const { mtimeMs, size } = statSync(file);

    expect(await provider!.stamp!('res://models/tree.glb')).toBe(`${mtimeMs}:${size}`);
  });

  it('changes when the file is rewritten', async () => {
    const provider = await projectProviderFor(scenePath);
    const file = join(projectDir, 'models', 'stamped.glb');
    writeFileSync(file, new Uint8Array([1]));
    const before = await provider!.stamp!('res://models/stamped.glb');
    writeFileSync(file, new Uint8Array([1, 2]));

    expect(await provider!.stamp!('res://models/stamped.glb')).not.toBe(before);
  });

  it('gives null for a file the project does not hold', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.stamp!('res://models/missing.glb')).toBeNull();
  });

  it('gives null for a path that escapes the project root', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.stamp!('res://../secret.txt')).toBeNull();
  });
});

describe('projectProviderFor listFiles', () => {
  let listedDir: string;

  beforeAll(() => {
    listedDir = join(tempDir, 'listed');
    const files: Record<string, string> = {
      'project.godot': 'config_version=5\n',
      'scenes/level.tscn': '[gd_scene format=3]\n',
      'bin/a.gdextension': '',
      'addons/x/bin/B.GDExtension': '',
      '.godot/c.gdextension': '',
      'ignored/.gdignore': '',
      'ignored/d.gdextension': '',
      'nested/project.godot': 'config_version=5\n',
      'nested/e.gdextension': '',
    };
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(listedDir, file)), { recursive: true });
      writeFileSync(join(listedDir, file), text);
    }
    // A link back up the tree: the walk follows it once and does not loop.
    symlinkSync(join(listedDir, 'addons'), join(listedDir, 'addons', 'x', 'loop'), 'dir');
  });

  it("lists each GDExtension the editor's scan finds, in any case, and none it skips", async () => {
    const provider = await projectProviderFor(join(listedDir, 'scenes', 'level.tscn'));
    const listed = await provider!.listFiles!('gdextension');

    expect(listed).toContain('res://bin/a.gdextension');
    expect(listed).toContain('res://addons/x/bin/B.GDExtension');
    expect(listed!.filter((path) => !path.startsWith('res://addons/x/loop/')).sort()).toEqual([
      'res://addons/x/bin/B.GDExtension',
      'res://bin/a.gdextension',
    ]);
  });

  it('lists the project once per run, since a run sees one state of it', async () => {
    const provider = await projectProviderFor(join(listedDir, 'scenes', 'level.tscn'));
    const first = await provider!.listFiles!('gdextension');
    writeFileSync(join(listedDir, 'bin', 'late.gdextension'), '');

    expect(await provider!.listFiles!('gdextension')).toEqual(first);
  });
});

describe('providerForRoot', () => {
  it('hands back one provider for a root, so its verdicts are shared', () => {
    expect(providerForRoot(root)).toBe(providerForRoot(root));
  });
});

describe('listProjectPaths', () => {
  it('lists every project file as a res:// path, sorted', async () => {
    const paths = await listProjectPaths(root);

    expect(paths).toContain('res://project.godot');
    expect(paths).toContain('res://models/tree.glb');
    expect(paths).toContain('res://scenes/level.tscn');
    expect([...paths]).toEqual([...paths].sort());
  });

  it('skips the .godot data directory and a nested project, as the editor scan does', async () => {
    const paths = await listProjectPaths(root);

    expect(paths.some((path) => path.startsWith('res://.godot/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('res://vendor/'))).toBe(false);
  });

  it('lists a root once, so a later file is not seen', async () => {
    const first = await listProjectPaths(root);
    writeFileSync(join(projectDir, 'models', 'late.glb'), new Uint8Array([1]));

    expect(await listProjectPaths(root)).toEqual(first);
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
